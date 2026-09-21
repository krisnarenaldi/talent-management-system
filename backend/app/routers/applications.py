from datetime import date, datetime, timedelta, timezone
from pydantic import BaseModel

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select

from app.core.dependencies import get_db, get_current_user, require_role
from app.models.application import (
    APPLICATION_STATUSES,
    AIScreeningResult,
    Application,
    StageHistory,
    STAGE_NAMES,
    TERMINAL_STATUSES,
    VALID_TRANSITIONS,
    FAIL_RESULTS,
)
from app.models.notification import Notification
from app.models.blacklist import Blacklist
from app.models.candidate import Candidate
from app.models.employee import Employee
from app.models.position import Position
from app.schemas.application import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationStageDetail,
    ApplicationBulkUploadResponse,
    StageHistoryCreate,
    StageHistoryResponse,
)
from app.services import employee_service
from app.services.storage_service import get_storage_service
from app.core.arq_pool import get_redis_pool

storage_service = get_storage_service()

router = APIRouter()


def _check_candidate_blacklisted(db: Session, candidate_id: str) -> Blacklist | None:
    """Cek apakah kandidat ada di blacklist (aktif + disetujui). Return record blacklist jika ya, None jika tidak."""
    return db.execute(
        select(Blacklist).where(
            Blacklist.candidate_id == candidate_id,
            Blacklist.is_active == True,
            Blacklist.is_approved == True,
        )
    ).scalar_one_or_none()


# ── List ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ApplicationResponse])
def list_applications(
    position_id: str | None = Query(None),
    status_filter: str | None = Query(None),
    current_stage: str | None = Query(None),
    recruiter_id: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = (
        db.query(Application)
        .join(Candidate, Application.candidate_id == Candidate.id)
        .options(
            joinedload(Application.position).joinedload(Position.client),
            joinedload(Application.recruiter),
            joinedload(Application.stage_histories),
        )
    )
    if position_id:
        query = query.filter(Application.position_id == position_id)
    if status_filter:
        query = query.filter(Application.status == status_filter)
    if current_stage:
        query = query.filter(Application.current_stage == current_stage)
    if recruiter_id:
        query = query.filter(Application.recruiter_id == recruiter_id)
    if start_date:
        query = query.filter(Application.created_at >= start_date)
    if end_date:
        query = query.filter(Application.created_at <= end_date + timedelta(days=1))
    return query.offset(skip).limit(limit).all()


# ── Create ───────────────────────────────────────────────────────────────────

@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_application(
    payload: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    # Validasi kandidat
    candidate = db.query(Candidate).filter(Candidate.id == payload.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")

    # Cek apakah kandidat sudah menjadi karyawan aktif
    active_employee = db.query(Employee).filter(
        Employee.candidate_id == payload.candidate_id,
        Employee.employee_status == "aktif",
    ).first()
    if active_employee:
        raise HTTPException(
            status_code=400,
            detail="Kandidat ini sudah menjadi karyawan aktif dan tidak dapat dibuatkan lamaran baru."
        )

    # Cek apakah kandidat ada di blacklist (aktif + disetujui)
    # Jika force_blacklisted=True, proses tetap dilanjutkan (hanya warning di frontend)
    if not payload.force_blacklisted:
        bl_entry = _check_candidate_blacklisted(db, str(payload.candidate_id))
        if bl_entry:
            raise HTTPException(
                status_code=400,
                detail=f"Kandidat ini sedang dalam daftar blacklist dan tidak dapat diproses. "
                       f"Alasan: {bl_entry.reason or 'Tidak ada alasan'}. "
                       f"Silakan cabut blacklist terlebih dahulu jika ingin memproses kandidat ini."
            )

    # Validasi posisi
    position = db.query(Position).filter(Position.id == payload.position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position tidak ditemukan")

    # Cek duplikasi lamaran aktif ke posisi sama
    existing = db.query(Application).filter(
        Application.candidate_id == payload.candidate_id,
        Application.position_id == payload.position_id,
        Application.status == "active",
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Kandidat sudah memiliki lamaran aktif untuk posisi ini (ID: {existing.id})",
        )

    application = Application(
        candidate_id=payload.candidate_id,
        position_id=payload.position_id,
        recruiter_id=payload.recruiter_id,
        current_stage=payload.current_stage,
    )
    db.add(application)
    db.flush()

    initial_history = StageHistory(
        application_id=application.id,
        stage_name=payload.current_stage,
        result=None,
        notes="Lamaran dibuat",
        updated_by=current_user.id,
    )
    db.add(initial_history)

    db.commit()
    db.refresh(application)

    fresh = (
        db.query(Application)
        .options(
            joinedload(Application.candidate),
            joinedload(Application.position).joinedload(Position.client),
            joinedload(Application.recruiter),
            joinedload(Application.stage_histories),
        )
        .filter(Application.id == application.id)
        .first()
    )
    if fresh:
        fresh.stage_histories = sorted(
            fresh.stage_histories,
            key=lambda x: x.created_at or datetime.min.replace(tzinfo=timezone.utc),
        )
    return fresh


# ── New Application Metadata ────────────────────────────────────────────────

@router.get("/new", response_model=dict)
def get_new_application_metadata(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return metadata for creating a new application."""
    return {
        "default_stage": "Dijadwalkan_Interview",
        "default_status": "active",
        "stage_names": list(STAGE_NAMES),
        "valid_transitions": VALID_TRANSITIONS,
    }


@router.get("/new/stages", response_model=list[str])
def get_new_application_stages(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return available stages for a new application."""
    return list(STAGE_NAMES)


# ── Pending Review (AI Screening) ───────────────────────────────────────────
# NOTE: Rute statik ini HARUS didaftarkan sebelum GET /{application_id}.
# FastAPI mencocokkan route berdasarkan urutan pendaftaran — jika /{application_id}
# terdaftar lebih dulu, request ke /pending-review akan tertangkap oleh route dinamis
# dengan application_id = "pending-review", dan return 404.

@router.get("/pending-review", response_model=list[dict])
def list_pending_reviews(
    status: list[str] = Query(default=["siap_review", "menunggu_screening_ai", "sedang_diproses", "error"]),
    uploaded_by: str | None = Query(None),
    position_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Daftar AI screening result yang siap direview maupun sedang antri.
    HR hanya melihat miliknya sendiri; Manager/Admin melihat semua.
    """
    query = (
        db.query(AIScreeningResult)
        .options(
            joinedload(AIScreeningResult.position).joinedload(Position.client),
            joinedload(AIScreeningResult.uploader),
        )
        .filter(AIScreeningResult.status.in_(status))
    )
    # HR hanya lihat hasil upload sendiri
    if current_user.role == "hr" and not uploaded_by:
        uploaded_by = str(current_user.id)
    if uploaded_by:
        query = query.filter(AIScreeningResult.uploaded_by == uploaded_by)
    if position_id:
        query = query.filter(AIScreeningResult.position_id == position_id)

    results = query.order_by(AIScreeningResult.created_at.asc()).all()

    return [
        {
            "id": str(r.id),
            "cv_file_url": r.cv_file_url,
            "cv_drive_item_id": r.cv_drive_item_id,
            "position_title": r.position.title if r.position else None,
            "client_name": r.position.client_name if r.position else None,
            "uploaded_by_name": r.uploader.name if r.uploader else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "ai_score": r.ai_score,
            "ai_notes": r.ai_notes,
            "extracted_json": r.extracted_json,
            "status": r.status,
        }
        for r in results
    ]


# ── Screening Detail & Review ────────────────────────────────────────────────
# NOTE: Rute /screening/{id} dan /screening/{id}/review HARUS terdaftar sebelum
# GET /{application_id}. Tanpa ini FastAPI akan mencocokkan path "screening"
# sebagai application_id dan return 404 "Lamaran tidak ditemukan".


@router.get("/screening/{screening_id}", response_model=dict)
def get_screening_result(
    screening_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """Ambil detail satu AI screening result."""
    screening_id = screening_id.strip()
    screening = (
        db.query(AIScreeningResult)
        .options(
            joinedload(AIScreeningResult.position).joinedload(Position.client),
            joinedload(AIScreeningResult.uploader),
        )
        .filter(AIScreeningResult.id == screening_id)
        .first()
    )
    if not screening:
        raise HTTPException(status_code=404, detail="AI screening result tidak ditemukan")
    return {
        "id": str(screening.id),
        "application_id": str(screening.application_id) if screening.application_id else None,
        "candidate_id": str(screening.candidate_id) if screening.candidate_id else None,
        "position_id": str(screening.position_id) if screening.position_id else None,
        "uploaded_by": str(screening.uploaded_by) if screening.uploaded_by else None,
        "cv_file_url": screening.cv_file_url,
        "cv_drive_item_id": screening.cv_drive_item_id,
        "ai_score": screening.ai_score,
        "ai_notes": screening.ai_notes,
        "extracted_json": screening.extracted_json,
        "status": screening.status,
        "reviewed_by": str(screening.reviewed_by) if screening.reviewed_by else None,
        "reviewed_at": screening.reviewed_at.isoformat() if screening.reviewed_at else None,
        "created_at": screening.created_at.isoformat() if screening.created_at else None,
        "updated_at": screening.updated_at.isoformat() if screening.updated_at else None,
        "position_title": screening.position.title if screening.position else None,
        "client_name": screening.position.client_name if screening.position else None,
        "uploaded_by_name": screening.uploader.name if screening.uploader else None,
    }


class ScreeningReviewPayload(BaseModel):
    status: str = "sudah_direview"
    # reviewed_by TIDAK diterima dari payload — selalu diambil dari current_user.id
    # untuk mencegah HR memalsukan identity reviewer (misal berpura-pura Manager yang review)
    candidate_id: str | None = None
    application_id: str | None = None
    notes: str | None = None


@router.patch("/screening/{screening_id}/review", response_model=dict)
def review_screening_result(
    screening_id: str,
    payload: ScreeningReviewPayload,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    HR mereview hasil screening AI.
    - Update status → sudah_direview
    - Link candidate_id dan/atau application_id
    - Simpan catatan HR
    """
    import uuid as _uuid

    screening_id = screening_id.strip()
    screening = db.query(AIScreeningResult).filter(AIScreeningResult.id == screening_id).first()
    if not screening:
        raise HTTPException(status_code=404, detail="AI screening result tidak ditemukan")

    screening.status = payload.status
    screening.reviewed_by = current_user.id  # selalu dari user yang login, tidak dari payload
    screening.reviewed_at = datetime.now(timezone.utc)
    if payload.candidate_id:
        screening.candidate_id = _uuid.UUID(payload.candidate_id)
    if payload.application_id:
        screening.application_id = _uuid.UUID(payload.application_id)
    if payload.notes:
        screening.ai_notes = payload.notes

    db.commit()
    db.refresh(screening)

    # Buat notifikasi ke uploader jika bukan diri sendiri
    if screening.uploaded_by and str(screening.uploaded_by) != str(current_user.id):
        notif = Notification(
            user_id=screening.uploaded_by,
            type="ai_screening_reviewed",
            message=f"CV untuk posisi {screening.position.title if screening.position else 'posisi'} telah direview oleh {current_user.name}",
            link=f"/applications/pending-review/{screening.id}",
        )
        db.add(notif)
        db.commit()

    return {
        "id": str(screening.id),
        "status": screening.status,
        "candidate_id": str(screening.candidate_id) if screening.candidate_id else None,
        "application_id": str(screening.application_id) if screening.application_id else None,
        "reviewed_by": str(screening.reviewed_by) if screening.reviewed_by else None,
        "reviewed_at": screening.reviewed_at.isoformat() if screening.reviewed_at else None,
    }


@router.post("/screening/{screening_id}/retry", response_model=dict)
async def retry_screening(
    screening_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Re-enqueue CV screening yang gagal (status='error') ke arq worker.
    Reset status ke 'menunggu_screening_ai' lalu kirim job baru.
    """
    screening_id = screening_id.strip()
    screening = db.query(AIScreeningResult).filter(AIScreeningResult.id == screening_id).first()
    if not screening:
        raise HTTPException(status_code=404, detail="AI screening result tidak ditemukan")
    if screening.status != "error":
        raise HTTPException(
            status_code=400,
            detail=f"Hanya screening dengan status 'error' yang bisa di-retry (saat ini: '{screening.status}')",
        )

    screening.status = "menunggu_screening_ai"
    screening.ai_notes = None
    screening.ai_score = None
    screening.extracted_json = None
    db.commit()

    redis = await get_redis_pool()
    await redis.enqueue_job("process_cv_screening", str(screening.id))

    return {"id": str(screening.id), "status": screening.status, "message": "Re-enqueued untuk diproses ulang"}


# ── Retry semua error dalam satu batch ───────────────────────────────────────

@router.post("/screening/retry-all-errors", response_model=dict)
async def retry_all_error_screenings(
    position_id: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Re-enqueue semua CV berstatus 'error' milik user (HR) atau semua (Manager/Admin).
    """
    query = db.query(AIScreeningResult).filter(AIScreeningResult.status == "error")
    if current_user.role == "hr":
        query = query.filter(AIScreeningResult.uploaded_by == current_user.id)
    if position_id:
        query = query.filter(AIScreeningResult.position_id == position_id)

    screenings = query.all()
    if not screenings:
        return {"retried": 0, "message": "Tidak ada CV gagal yang ditemukan"}

    redis = await get_redis_pool()
    for s in screenings:
        s.status = "menunggu_screening_ai"
        s.ai_notes = None
        s.ai_score = None
        s.extracted_json = None
        await redis.enqueue_job("process_cv_screening", str(s.id))

    db.commit()
    return {"retried": len(screenings), "message": f"{len(screenings)} CV di-enqueue ulang untuk diproses"}


# ── Delete Screening ─────────────────────────────────────────────────────────

@router.delete("/screening/{screening_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_screening(
    screening_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Hapus satu AI screening result (beserta data yang terkait di storage bila ada).
    HR hanya boleh menghapus miliknya sendiri; Manager/Admin bisa menghapus semua.
    """
    screening = db.query(AIScreeningResult).filter(AIScreeningResult.id == screening_id.strip()).first()
    if not screening:
        raise HTTPException(status_code=404, detail="AI screening result tidak ditemukan")
    if current_user.role == "hr" and str(screening.uploaded_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Anda tidak memiliki izin untuk menghapus data ini")
    db.delete(screening)
    db.commit()


# ── Detail ───────────────────────────────────────────────────────────────────

@router.get("/{application_id}", response_model=ApplicationStageDetail)
def get_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    application_id = application_id.strip()
    application = (
        db.query(Application)
        .options(
            joinedload(Application.candidate),
            joinedload(Application.position).joinedload(Position.client),
            joinedload(Application.recruiter),
            joinedload(Application.stage_histories).joinedload(StageHistory.handler),
            joinedload(Application.ai_screening_result),
        )
        .filter(Application.id == application_id)
        .first()
    )
    if application:
        application.stage_histories = sorted(
            application.stage_histories,
            key=lambda x: x.created_at or datetime.min.replace(tzinfo=timezone.utc),
        )
    if not application:
        raise HTTPException(status_code=404, detail="Lamaran tidak ditemukan")

    # Build ai_screening dict
    ai_screening = None
    if application.ai_screening_result:
        sr = application.ai_screening_result
        ai_screening = {
            "ai_score": sr.ai_score,
            "ai_screening_status": sr.status,
            "score": sr.ai_score,
            "notes": sr.ai_notes,
            "extracted_summary": sr.extracted_json,
        }

    return {
        "id": str(application.id),
        "candidate_id": str(application.candidate_id),
        "candidate_name": application.candidate.full_name if application.candidate else None,
        "position_id": str(application.position_id) if application.position_id else None,
        "position_title": application.position.title if application.position else None,
        "client_name": application.position.client_name if application.position else None,
        "recruiter_id": str(application.recruiter_id) if application.recruiter_id else None,
        "recruiter_name": application.recruiter.name if application.recruiter else None,
        "current_stage": application.current_stage,
        "status": application.status,
        "last_result": application.last_result,
        "cv_submitted_to_pm_date": application.cv_submitted_to_pm_date,
        "created_at": application.created_at.isoformat() if application.created_at else None,
        "updated_at": application.updated_at.isoformat() if application.updated_at else None,
        "ai_score": ai_screening["score"] if ai_screening else None,
        "ai_screening_status": ai_screening["ai_screening_status"] if ai_screening else None,
        "ai_screening": ai_screening,
        "stage_history": [
            {
                "id": str(h.id),
                "application_id": str(h.application_id),
                "stage_name": h.stage_name,
                "scheduled_date": str(h.scheduled_date) if h.scheduled_date else None,
                "actual_date": str(h.actual_date) if h.actual_date else None,
                "result": h.result,
                "salary_current_input": str(h.salary_current_input) if h.salary_current_input else None,
                "salary_expected_input": str(h.salary_expected_input) if h.salary_expected_input else None,
                "notes": h.notes,
                "updated_by": str(h.updated_by) if h.updated_by else None,
                "handler_id": str(h.handler_id) if h.handler_id else None,
                "handler_name": h.handler.name if h.handler else None,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            }
            for h in application.stage_histories
        ],
        "next_possible_stages": VALID_TRANSITIONS.get(application.current_stage, []),
    }


# ── Stage History List ───────────────────────────────────────────────────────

@router.get("/{application_id}/stages/", response_model=list[StageHistoryResponse])
@router.get("/{application_id}/stages", response_model=list[StageHistoryResponse])
def list_stage_history(
    application_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    application_id = application_id.strip()
    db.query(Application).filter(Application.id == application_id).first() or _raise_404("Lamaran tidak ditemukan")
    return (
        db.query(StageHistory)
        .filter(StageHistory.application_id == application_id)
        .order_by(StageHistory.created_at.asc())
        .all()
    )


# ── Update Stage ─────────────────────────────────────────────────────────────

@router.patch("/{application_id}/stages/", response_model=ApplicationStageDetail)
@router.patch("/{application_id}/stages", response_model=ApplicationStageDetail)
def update_stage(
    application_id: str,
    payload: StageHistoryCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    application_id = application_id.strip()
    application = (
        db.query(Application)
        .options(joinedload(Application.candidate), joinedload(Application.position).joinedload(Position.client), joinedload(Application.recruiter))
        .filter(Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Lamaran tidak ditemukan")

    # Cek apakah kandidat ada di blacklist (aktif + disetujui) — kecuali untuk Rejected/Withdrawn
    if payload.stage_name not in ("Rejected", "Withdrawn"):
        bl_entry = _check_candidate_blacklisted(db, str(application.candidate_id))
        if bl_entry:
            raise HTTPException(
                status_code=400,
                detail=f"Kandidat ini sedang dalam daftar blacklist dan tidak dapat diproses ke tahap '{payload.stage_name}'. "
                       f"Alasan blacklist: {bl_entry.reason or 'Tidak ada alasan'}. "
                       f"Silakan cabut blacklist terlebih dahulu jika ingin melanjutkan."
            )

    # Tidak ada lagi ownership lock — semua HR/Manager bisa tangani tahapan

    # Validasi: jika sudah di status terminal, tidak boleh update stage lagi
    if application.status in TERMINAL_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Lamaran sudah dalam status '{application.status}' dan tidak dapat di-update. "
                   f"Silakan buat lamaran baru jika perlu.",
        )

    # Validasi transisi
    is_same_stage = payload.stage_name == application.current_stage
    # For Existing / terminal stages, allowed is ONLY same stage (for notes updates)
    if application.current_stage in ("Rejected", "Withdrawn", "Existing"):
        allowed: list[str] = []
    else:
        allowed = VALID_TRANSITIONS.get(application.current_stage, []) + ["Rejected", "Withdrawn"]
    if not is_same_stage and payload.stage_name not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transisi tidak valid dari '{application.current_stage}' ke '{payload.stage_name}'. "
                   f"Stages yang mungkin: {allowed + [application.current_stage + ' (same stage)']}",
        )

    # Guard: jika current stage sudah punya result FAIL, hanya boleh ke Rejected/Withdrawn
    if not is_same_stage and payload.stage_name not in ("Rejected", "Withdrawn"):
        current_last_result = application.last_result
        if current_last_result and current_last_result in FAIL_RESULTS:
            raise HTTPException(
                status_code=400,
                detail=f"Tahap '{application.current_stage}' sudah ditandai '{current_last_result}'. "
                       f"Kandidat tidak dapat maju ke tahap berikutnya. "
                       f"Pilih 'Rejected' atau 'Withdrawn' untuk menutup lamaran ini.",
            )

    # Simpan history (handler_id = user yang sedang melakukan update tahapan ini)
    history = StageHistory(
        application_id=application_id,
        stage_name=payload.stage_name,
        scheduled_date=payload.scheduled_date,
        actual_date=payload.scheduled_date,  # same day by default
        result=payload.result,
        salary_current_input=payload.salary_current_input,
        salary_expected_input=payload.salary_expected_input,
        notes=payload.notes,
        updated_by=current_user.id,
        handler_id=current_user.id,
    )
    db.add(history)

    # Update application (hanya jika berbeda stage)
    if not is_same_stage:
        application.current_stage = payload.stage_name
        if payload.stage_name in ("Rejected", "Withdrawn"):
            application.status = payload.stage_name.lower()
        elif payload.stage_name == "Existing":
            application.status = "hired"
            # Trigger auto-create employee (TASK-05.2)
            employee_service.create_from_application(db, application_id)
    db.commit()
    db.refresh(application)

    # Reload dengan stage_history
    fresh = (
        db.query(Application)
        .options(
            joinedload(Application.candidate),
            joinedload(Application.position).joinedload(Position.client),
            joinedload(Application.recruiter),
            joinedload(Application.stage_histories).joinedload(StageHistory.handler),
        )
        .filter(Application.id == application_id)
        .first()
    )
    if fresh:
        fresh.stage_histories = sorted(
            fresh.stage_histories,
            key=lambda x: x.created_at or datetime.min.replace(tzinfo=timezone.utc),
        )
    return fresh


# ── Assign Recruiter ─────────────────────────────────────────────────────────

class AssignRecruiterPayload(BaseModel):
    recruiter_id: str


@router.patch("/{application_id}/assign-recruiter", response_model=ApplicationStageDetail)
def assign_recruiter(
    application_id: str,
    payload: AssignRecruiterPayload,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """Pindahkan recruiter (pemegang) utama lamaran ke HR/Manager lain."""
    from app.models.user import User

    application_id = application_id.strip()
    application = (
        db.query(Application)
        .options(
            joinedload(Application.candidate),
            joinedload(Application.position).joinedload(Position.client),
            joinedload(Application.recruiter),
            joinedload(Application.stage_histories),
        )
        .filter(Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Lamaran tidak ditemukan")

    new_recruiter = db.query(User).filter(User.id == payload.recruiter_id, User.is_active == True).first()
    if not new_recruiter:
        raise HTTPException(status_code=404, detail="User tidak ditemukan atau tidak aktif")
    if new_recruiter.role not in ("hr", "manager", "admin"):
        raise HTTPException(status_code=400, detail="Recruiter harus memiliki role HR, Manager, atau Admin")

    application.recruiter_id = new_recruiter.id
    db.commit()
    db.refresh(application)

    fresh = (
        db.query(Application)
        .options(
            joinedload(Application.candidate),
            joinedload(Application.position).joinedload(Position.client),
            joinedload(Application.recruiter),
            joinedload(Application.stage_histories),
        )
        .filter(Application.id == application_id)
        .first()
    )
    if fresh:
        fresh.stage_histories = sorted(
            fresh.stage_histories,
            key=lambda x: x.created_at or datetime.min.replace(tzinfo=timezone.utc),
        )
    return fresh


# ── Bulk Upload CV ───────────────────────────────────────────────────────────

@router.post("/bulk-upload-cv", response_model=ApplicationBulkUploadResponse, status_code=status.HTTP_201_CREATED)
async def bulk_upload_cv(
    position_id: str = Form(...),
    source_channel: str = Form(""),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Upload banyak CV sekaligus untuk satu posisi.
    HR + Manager only. Setiap file di-enqueue ke arq worker via Redis.
    Return immediately — tidak tunggu proses selesai.
    """
    import uuid as _uuid

    # Validasi posisi
    position = db.query(Position).options(joinedload(Position.client)).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position tidak ditemukan")
    if not position.is_active:
        raise HTTPException(status_code=400, detail="Position tidak aktif")

    # Validasi tipe file
    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"File '{f.filename}' bukan PDF")

    client_name = position.client_name or "unknown"
    folder = f"{position_id}/{client_name}/cv_uploads"
    created_ids: list[str] = []

    redis = await get_redis_pool()

    for f in files:
        content = await f.read()
        if len(content) == 0:
            continue

        # Upload file ke storage (local atau OneDrive)
        upload_result = await storage_service.upload(
            file_content=content,
            filename=f.filename,
            folder=folder,
        )

        # Buat record ai_screening_result
        screening = AIScreeningResult(
            application_id=None,
            candidate_id=None,
            position_id=_uuid.UUID(position_id),
            uploaded_by=current_user.id,
            cv_file_url=upload_result["file_url"],
            cv_drive_item_id=upload_result["drive_item_id"],
            source_channel=source_channel or None,
            status="menunggu_screening_ai",
            ai_score=None,
            extracted_json=None,
            ai_notes=None,
            reviewed_by=None,
            reviewed_at=None,
        )
        db.add(screening)
        db.flush()
        created_ids.append(str(screening.id))

        # Enqueue ke arq worker — tidak ada HTTP keluar, tidak ada shared secret
        await redis.enqueue_job("process_cv_screening", str(screening.id))

    db.commit()

    return ApplicationBulkUploadResponse(
        position_id=position.id,
        position_title=position.title,
        client_name=client_name,
        total_files=len(created_ids),
        created_screening_result_ids=created_ids,
        n8n_triggered=False,
    )


# ── Helpers ──────────────────────────────────────────────────────────────────

def _raise_404(msg: str) -> None:
    raise HTTPException(status_code=404, detail=msg)

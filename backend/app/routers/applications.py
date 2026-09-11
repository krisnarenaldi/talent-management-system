from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
)
from app.models.blacklist import Blacklist
from app.models.candidate import Candidate
from app.models.employee import Employee
from app.models.position import Position
from app.schemas.application import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationStageDetail,
    StageHistoryCreate,
    StageHistoryResponse,
)
from app.services import employee_service

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

    # Cek apakah kandidat ada di blacklist (aktif + disetujui)
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
        raise HTTPException(status_code=409, detail="Kandidat sudah memiliki lamaran aktif untuk posisi ini")

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
            joinedload(Application.stage_histories),
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
    return application


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

    # Validasi Ownership untuk role HR
    if current_user.role == "hr" and application.recruiter_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Anda tidak memiliki akses untuk mengedit lamaran yang ditugaskan ke recruiter lain."
        )

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

    # Simpan history
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


# ── Helpers ──────────────────────────────────────────────────────────────────

def _raise_404(msg: str) -> None:
    raise HTTPException(status_code=404, detail=msg)

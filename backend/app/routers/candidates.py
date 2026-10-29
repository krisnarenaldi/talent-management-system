import logging
import uuid
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload, selectinload

logger = logging.getLogger(__name__)

from app.core.dependencies import get_db, get_current_user, require_role
from app.models.blacklist import Blacklist
from app.models.candidate import Candidate, CandidateEducation, CandidateExperience, CandidateDocument
from app.models.candidate_project import CandidateProject
from app.models.application import Application, StageHistory
from app.models.employee import Employee
from app.schemas.candidate import (
    BulkAssignRequest,
    BulkAssignResponse,
    BulkUploadResponse,
    CandidateCreate,
    CandidateFlagsPatch,
    CandidateProjectResponse,
    CandidateProjectUpdate,
    CandidateResponse,
    CandidateTalentPoolUpdate,
    CandidateUpdate,
    CandidateWithWarnings,
    DocumentResponse,
    EducationCreate,
    EducationResponse,
    EducationUpdate,
    ExperienceCreate,
    ExperienceResponse,
    ExperienceUpdate,
)
from app.services import candidate_service
from app.core.phone_utils import normalize_phone as _normalize_phone
from app.services.ai_service import generate_project_drafts
from app.services.storage_service import get_storage_service
from app.services.usage_logger import log_openai_usage
from app.core.arq_pool import get_redis_pool

router = APIRouter()

# Dokumen wajib untuk status "lengkap"
REQUIRED_DOC_TYPES = {"Foto", "KTP", "Ijazah", "Transkrip", "CV_asli", "Sertifikat"}


def _recalc_completeness(candidate_id: str, db: Session) -> str:
    """Hitung kelengkapan berdasarkan dokumen yang ada."""
    docs = (
        db.query(CandidateDocument)
        .filter(
            CandidateDocument.candidate_id == candidate_id,
            CandidateDocument.is_deleted == False,
        )
        .all()
    )
    types_present = {d.doc_type for d in docs}
    required_present = REQUIRED_DOC_TYPES.issubset(types_present)
    return "lengkap" if required_present else "belum_lengkap"


# ── Static file serving (local storage) ───────────────────────────────────────

@router.get("/files/{path:path}")
async def serve_uploaded_file(path: str):
    """Serve uploaded files from local storage."""
    from app.core.config import settings
    upload_root = Path(settings.UPLOAD_DIR)
    file_path = (upload_root / path).resolve()
    # Block directory traversal
    if not str(file_path).startswith(str(upload_root.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(file_path))


# ── List ─────────────────────────────────────────────────────────────────────

@router.get("/cities", response_model=list[str])
def list_candidate_cities(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Ambil daftar kota unik dari kolom domicile kandidat."""
    from sqlalchemy import distinct

    rows = (
        db.query(distinct(Candidate.domicile))
        .filter(Candidate.domicile.isnot(None), Candidate.domicile != "", Candidate.is_deleted == False)
        .all()
    )
    cities = sorted({r[0].strip() for r in rows if r[0]})
    return cities


@router.get("", response_model=list[CandidateResponse])
def list_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    source_channel: str | None = Query(None),
    completeness_status: str | None = Query(None),
    city: str | None = Query(None),
    experience_level: str | None = Query(None),
    education: str | None = Query(None),
    min_current_salary: Decimal | None = Query(None),
    max_current_salary: Decimal | None = Query(None),
    min_expected_salary: Decimal | None = Query(None),
    max_expected_salary: Decimal | None = Query(None),
    pool_status: str | None = Query(None, description="Filter by talent pool status: 'database', 'talent_pool', 'future_lead', or 'all' (default)"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from sqlalchemy import or_, String, func, select

    query = (
        db.query(Candidate)
        .options(
            selectinload(Candidate.educations),
            selectinload(Candidate.experiences),
            selectinload(Candidate.applications).joinedload(Application.position),
        )
        .filter(Candidate.is_deleted == False)
    )
    
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Candidate.full_name.ilike(pattern),
                Candidate.email.ilike(pattern),
                Candidate.phone.ilike(pattern),
                Candidate.domicile.ilike(pattern),
                Candidate.notes.ilike(pattern),
                Candidate.skills.cast(String).ilike(pattern),
                Candidate.educations.any(
                    or_(
                        CandidateEducation.institution.ilike(pattern),
                        CandidateEducation.major.ilike(pattern)
                    )
                ),
                Candidate.experiences.any(
                    or_(
                        CandidateExperience.company_name.ilike(pattern),
                        CandidateExperience.job_title.ilike(pattern),
                        CandidateExperience.description.ilike(pattern)
                    )
                ),
                Candidate.applications.any(
                    Application.stage_histories.any(
                        StageHistory.notes.ilike(pattern)
                    )
                ),
            )
        )
        
    if source_channel:
        query = query.filter(Candidate.source_channel == source_channel)
        
    if completeness_status:
        query = query.filter(Candidate.completeness_status == completeness_status)
        
    if city:
        city_lower = city.lower()
        jabotabek = ["jakarta", "bogor", "depok", "tangerang", "bekasi"]
        conditions = [Candidate.domicile.ilike(f"%{c}%") for c in jabotabek]
        if city_lower == "jabotabek":
            query = query.filter(or_(*conditions))
        elif city_lower == "non_jabotabek":
            query = query.filter(~or_(*conditions))
        else:
            query = query.filter(Candidate.domicile.ilike(f"%{city}%"))
            
    if experience_level:
        exp_stmt = select(
            CandidateExperience.candidate_id,
            func.sum(
                func.coalesce(CandidateExperience.end_date, func.current_date()) - CandidateExperience.start_date
            ).label("total_days")
        ).group_by(CandidateExperience.candidate_id).subquery()

        query = query.outerjoin(exp_stmt, Candidate.id == exp_stmt.c.candidate_id)

        if experience_level == "junior":
            query = query.filter(or_(exp_stmt.c.total_days == None, exp_stmt.c.total_days <= 1095))
        elif experience_level == "intermediate":
            query = query.filter(exp_stmt.c.total_days > 1095, exp_stmt.c.total_days <= 1825)
        elif experience_level == "senior":
            query = query.filter(exp_stmt.c.total_days > 1825)
            
    if education:
        query = query.filter(
            Candidate.educations.any(
                or_(
                    CandidateEducation.institution.ilike(f"%{education}%"),
                    CandidateEducation.major.ilike(f"%{education}%")
                )
            )
        )

    if min_current_salary is not None:
        query = query.filter(Candidate.current_salary >= min_current_salary)
    if max_current_salary is not None:
        query = query.filter(Candidate.current_salary <= max_current_salary)
    if min_expected_salary is not None:
        query = query.filter(Candidate.expected_salary >= min_expected_salary)
    if max_expected_salary is not None:
        query = query.filter(Candidate.expected_salary <= max_expected_salary)

    if pool_status and pool_status != "all":
        query = query.filter(Candidate.pool_status == pool_status)

    # Exclude candidates who are already active employees
    query = query.filter(
        ~Candidate.id.in_(
            db.query(Employee.candidate_id).filter(Employee.employee_status == "aktif")
        )
    )

    candidates = query.offset(skip).limit(limit).all()
    # Re-compute & persist freshness, and collect blacklist status before commit.
    # Also pre-compute derived display fields (last_education, applied_positions,
    # experience_level) from eagerly-loaded relationships before db.commit()
    # expires the ORM attributes.
    blacklisted_ids: set[str] = set()
    derived: dict[str, dict] = {}
    for c in candidates:
        new_status = _recalc_completeness(str(c.id), db)
        if c.completeness_status != new_status:
            c.completeness_status = new_status
        # Determine blacklist status (collect IDs before commit expires objects)
        bl_exists = db.query(Blacklist).filter(
            Blacklist.candidate_id == c.id,
            Blacklist.is_active == True,
            Blacklist.is_approved == True,
        ).first()
        if bl_exists:
            blacklisted_ids.add(str(c.id))

        # ── Last education (paling terakhir berdasarkan graduation_year) ──
        last_edu = None
        if c.educations:
            # Pilih pendidikan dengan graduation_year terbesar; jika tidak ada
            # tahun, fallback ke urutan pertama.
            with_year = [e for e in c.educations if e.graduation_year is not None]
            if with_year:
                last_edu_obj = max(with_year, key=lambda e: e.graduation_year)
            else:
                last_edu_obj = c.educations[0]
            last_edu = {
                "institution": last_edu_obj.institution,
                "major": last_edu_obj.major,
                "graduation_year": last_edu_obj.graduation_year,
            }

        # ── Posisi yang dilamar (dari relasi applications) ──
        applied_positions = [
            app.position.title
            for app in c.applications
            if app.position and app.position.title
        ]

        # ── Level pengalaman (Junior / Intermediate / Senior) ──
        total_days = 0
        has_experience = False
        for exp in c.experiences:
            if exp.start_date is None:
                continue
            has_experience = True
            end = exp.end_date or date.today()
            delta = end - exp.start_date
            if delta.days > 0:
                total_days += delta.days

        if not has_experience:
            experience_level = "junior"
        elif total_days <= 1095:          # <= 3 tahun
            experience_level = "junior"
        elif total_days <= 1825:          # 3 - 5 tahun
            experience_level = "intermediate"
        else:                             # > 5 tahun
            experience_level = "senior"

        derived[str(c.id)] = {
            "last_education": last_edu,
            "applied_positions": applied_positions,
            "experience_level": experience_level,
        }

    db.commit()
    # Re-apply is_blacklisted after commit (db.commit() expires all ORM attributes)
    for c in candidates:
        c.is_blacklisted = str(c.id) in blacklisted_ids
        info = derived.get(str(c.id), {})
        c.last_education = info.get("last_education")
        c.applied_positions = info.get("applied_positions", [])
        c.experience_level = info.get("experience_level")
    return candidates


# ── Create ───────────────────────────────────────────────────────────────────

@router.post("", response_model=CandidateWithWarnings, status_code=status.HTTP_201_CREATED)
def create_candidate(
    payload: CandidateCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    # Normalise phone number before duplicate check and save
    payload.phone = _normalize_phone(payload.phone) or None

    # Duplikat check
    dup = candidate_service.check_duplicate(db, payload.email, payload.phone, payload.identity_no)
    if dup["is_duplicate"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Kandidat sudah ada (ID: {dup['existing_id']})",
        )

    # Blacklist check
    bl = candidate_service.check_blacklist(db, payload.email, payload.phone, payload.identity_no)

    candidate = Candidate(**payload.model_dump())
    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    return CandidateWithWarnings(
        candidate=CandidateResponse.model_validate(candidate),
        is_duplicate=dup["is_duplicate"],
        duplicate_candidate_id=dup["existing_id"],
        is_blacklisted=bl["is_blacklisted"],
        blacklist_entries=bl["blacklist_entries"],
    )


# ── Bulk Upload ──────────────────────────────────────────────────────────────

@router.post("/bulk-upload", response_model=BulkUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def bulk_upload_candidates(
    files: list[UploadFile] = File(...),
    source_channel: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Bulk upload CV files ke database tanpa mengaitkan dengan posisi.

    - Maximal 20 file per request
    - Format: PDF atau DOCX
    - Ukuran maksimal 5MB per file
    - Setiap file diupload ke storage (folder: candidates/raw_cv/)
    - Membuat record ai_screening_result dengan status 'menunggu_ekstraksi'
    - Enqueue arq job 'process_cv_ingestion' untuk ekstraksi data asinkron
    """
    MAX_FILES = 20
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    ALLOWED_EXTENSIONS = {".pdf", ".docx"}

    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maksimal {MAX_FILES} file per request",
        )

    storage = get_storage_service()
    screening_ids: list[str] = []
    errors: list[str] = []

    # Satu batch_id UUID untuk seluruh sesi upload ini —
    # digunakan oleh notifikasi agar hanya menghitung CV dalam batch ini saja.
    import uuid as _uuid
    batch_id = _uuid.uuid4()

    for file in files:
        try:
            # Validate extension
            ext = Path(file.filename or "").suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                errors.append(f"{file.filename}: format tidak didukung (hanya PDF atau DOCX)")
                continue

            # Read file content
            content = await file.read()
            if len(content) > MAX_FILE_SIZE:
                errors.append(f"{file.filename}: ukuran melebihi 5MB")
                continue

            # Upload to storage
            folder = "candidates/raw_cv"
            result = await storage.upload(
                file_content=content,
                filename=file.filename or "cv.pdf",
                folder=folder,
            )

            # Create ai_screening_result record (tanpa position_id)
            from app.models.application import AIScreeningResult
            screening = AIScreeningResult(
                application_id=None,
                candidate_id=None,
                position_id=None,
                uploaded_by=current_user.id,
                batch_id=batch_id,
                cv_file_url=result.get("file_url"),
                cv_drive_item_id=result.get("drive_item_id"),
                source_channel=source_channel,
                status="menunggu_ekstraksi",
            )
            db.add(screening)
            db.commit()
            db.refresh(screening)

            screening_ids.append(str(screening.id))

        except Exception as exc:
            errors.append(f"{file.filename}: {str(exc)}")
            continue

    if not screening_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal mengupload file. Errors: {'; '.join(errors)}",
        )

    # Enqueue arq jobs for async processing
    try:
        redis = await get_redis_pool()
        for sid in screening_ids:
            await redis.enqueue_job("process_cv_ingestion", sid)
    except Exception as exc:
        logger.warning("Gagal enqueue arq job: %s", exc)

    db.commit()

    return BulkUploadResponse(
        screening_ids=screening_ids,
        total_files=len(screening_ids),
        message=f"{len(screening_ids)} file successfully queued for ingestion" + (f". {len(errors)} errors: {'; '.join(errors)}" if errors else ""),
    )


# ── Failed / Pending Ingestion Reviews ─────────────────────────────────────

@router.get("/pending-review", response_model=list[dict])
def list_candidate_pending_reviews(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Daftar CV kandidat yang gagal diproses (error) atau menunggu ekstraksi pada alur ingestion talent pool.
    """
    from app.models.application import AIScreeningResult
    from app.routers.applications import _normalize_extracted_json

    query = (
        db.query(AIScreeningResult)
        .filter(
            AIScreeningResult.position_id.is_(None),
            AIScreeningResult.status.in_([
                "error", "menunggu_ekstraksi", "sedang_diproses",
                "duplikat", "blacklisted",
            ]),
        )
    )

    if current_user.role == "hr":
        query = query.filter(AIScreeningResult.uploaded_by == current_user.id)

    results = query.order_by(AIScreeningResult.created_at.desc(), AIScreeningResult.id.desc()).all()

    return [
        {
            "id": str(r.id),
            "candidate_id": str(r.candidate_id) if r.candidate_id else None,
            "cv_file_url": r.cv_file_url,
            "cv_drive_item_id": r.cv_drive_item_id,
            "source_channel": r.source_channel,
            "uploaded_by_name": r.uploader.name if r.uploader else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "ai_notes": r.ai_notes,
            "extracted_json": _normalize_extracted_json(r.extracted_json),
            "status": r.status,
        }
        for r in results
    ]


@router.delete("/pending-review/{screening_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_candidate_screening(
    screening_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Hapus item screening kandidat yang gagal / pending review.
    """
    from app.models.application import AIScreeningResult

    screening = db.query(AIScreeningResult).filter(
        AIScreeningResult.id == screening_id.strip(),
        AIScreeningResult.position_id.is_(None),
    ).first()

    if not screening:
        raise HTTPException(status_code=404, detail="Data screening tidak ditemukan")

    if current_user.role == "hr" and str(screening.uploaded_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Anda tidak memiliki izin untuk menghapus data ini")

    db.delete(screening)
    db.commit()


@router.post("/pending-review/retry-all-errors", response_model=dict)
async def retry_all_candidate_errors(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Re-enqueue semua CV kandidat berstatus 'error'.
    """
    from app.models.application import AIScreeningResult

    query = db.query(AIScreeningResult).filter(
        AIScreeningResult.position_id.is_(None),
        AIScreeningResult.status == "error",
    )
    if current_user.role == "hr":
        query = query.filter(AIScreeningResult.uploaded_by == current_user.id)

    screenings = query.all()
    if not screenings:
        return {"retried": 0, "message": "Tidak ada CV gagal yang ditemukan"}

    redis = await get_redis_pool()
    for s in screenings:
        s.status = "menunggu_ekstraksi"
        s.ai_notes = None
        s.extracted_json = None
        await redis.enqueue_job("process_cv_ingestion", str(s.id))

    db.commit()
    return {"retried": len(screenings), "message": f"{len(screenings)} file CV di-enqueue ulang untuk diproses"}


# ── Talent Pool ────────────────────────────────────────────────────────────

@router.patch("/{candidate_id}/talent-pool", response_model=CandidateResponse)
async def update_talent_pool(
    candidate_id: str,
    payload: CandidateTalentPoolUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Update talent pool status untuk kandidat.
    """
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")

    # Validasi pool_status
    if payload.pool_status not in ("database", "talent_pool", "future_lead"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="pool_status harus berupa 'database', 'talent_pool', atau 'future_lead'",
        )

    # Update field
    candidate.pool_status = payload.pool_status
    candidate.talent_pool_reason = payload.talent_pool_reason
    candidate.talent_pool_notes = payload.talent_pool_notes
    candidate.talent_pool_updated_at = datetime.now(timezone.utc)
    candidate.talent_pool_updated_by = current_user.id

    db.commit()
    db.refresh(candidate)
    return candidate



# ── Bulk Assign ────────────────────────────────────────────────────────────

@router.post("/bulk-assign", response_model=BulkAssignResponse)
async def bulk_assign_candidates(
    payload: BulkAssignRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Bulk assign candidates to a position.
    """
    # Enforce RBAC: HR cannot trigger AI screening
    effective_run_ai = payload.run_ai_screening
    if getattr(current_user, "role", None) == "hr":
        effective_run_ai = False

    # Verify position exists
    from app.models.position import Position
    position = db.query(Position).filter(Position.id == payload.position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")

    # PIC pewawancara mengikuti PIC yang sudah ditugaskan pada posisi.
    client_user_name = position.resolve_pic_name(payload.client_user_name)
    if payload.client_user_name and client_user_name is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"PIC '{payload.client_user_name}' tidak terdaftar pada posisi '{position.title}'. "
                f"PIC yang tersedia: {', '.join(position.pic_names) or '(belum ada)'}."
            ),
        )

    now = datetime.now(timezone.utc)
    six_months_ago = now - timedelta(days=180)  # 6 bulan = 180 hari

    success_count = 0
    skipped_details = []
    matching_job_ids: list[str] = []

    for candidate_id_str in payload.candidate_ids:
        try:
            candidate_id = uuid.UUID(candidate_id_str) if isinstance(candidate_id_str, str) else candidate_id_str
        except Exception:
            skipped_details.append({"candidate_id": candidate_id_str, "reason": "Invalid candidate ID format"})
            continue

        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            skipped_details.append({"candidate_id": str(candidate_id), "reason": "Candidate not found"})
            continue

        # Blacklist check
        bl_result = candidate_service.check_blacklist(
            db,
            email=candidate.email,
            phone=candidate.phone,
            identity_no=candidate.identity_no
        )
        if bl_result["is_blacklisted"]:
            skipped_details.append({
                "candidate_id": str(candidate_id),
                "reason": f"Blacklisted: {', '.join([e['reason'] for e in bl_result['blacklist_entries']])}"
            })
            continue

        # Cooldown check: rejected on same position in last 6 months
        rejected_recent = db.query(Application).filter(
            Application.candidate_id == candidate_id,
            Application.position_id == payload.position_id,
            Application.status == "rejected",
            Application.updated_at >= six_months_ago
        ).first()
        if rejected_recent:
            skipped_details.append({
                "candidate_id": str(candidate_id),
                "reason": "Cooldown: rejected on this position in the last 6 months"
            })
            continue

        # Existing active application
        existing_active = db.query(Application).filter(
            Application.candidate_id == candidate_id,
            Application.position_id == payload.position_id,
            Application.status == "active"
        ).first()
        if existing_active:
            skipped_details.append({
                "candidate_id": str(candidate_id),
                "reason": "Active application already exists for this position"
            })
            continue

        # Create Application
        application = Application(
            candidate_id=candidate_id,
            position_id=payload.position_id,
            current_stage="Dijadwalkan_Interview",
            status="active",
            recruiter_id=current_user.id,
            client_user_name=client_user_name,
            client_user_id=payload.client_user_id if payload.client_user_id else None,
        )
        db.add(application)
        db.flush()  # obtain application.id

        # Create initial StageHistory
        stage_history = StageHistory(
            application_id=application.id,
            stage_name="Dijadwalkan_Interview",
            notes="Initial assignment via bulk assign",
            updated_by=current_user.id,
        )
        db.add(stage_history)

        # Enqueue AI scoring job jika diminta (hanya manager/admin yang bisa set run_ai_screening=True)
        if effective_run_ai:
            matching_job_ids.append(str(application.id))

        success_count += 1

    db.commit()

    # Enqueue setelah commit agar record Application sudah tersimpan di DB.
    if matching_job_ids:
        try:
            redis = await get_redis_pool()
            for app_id in matching_job_ids:
                await redis.enqueue_job("process_position_matching", app_id)
        except Exception as exc:
            logger.warning("Gagal enqueue arq job process_position_matching: %s", exc)

    message = f"{success_count} candidates successfully assigned, {len(skipped_details)} skipped."
    return BulkAssignResponse(
        success_count=success_count,
        skipped_count=len(skipped_details),
        skipped_details=skipped_details,
        message=message,
    )


# ── Detail ───────────────────────────────────────────────────────────────────

@router.get("/{candidate_id}", response_model=CandidateResponse)
def get_candidate(candidate_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    candidate = (
        db.query(Candidate)
        .options(
            joinedload(Candidate.educations),
            joinedload(Candidate.experiences),
            joinedload(Candidate.blacklists).joinedload(Blacklist.status_type),
        )
        .filter(Candidate.id == candidate_id)
        .first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")
    # Override stored status dengan computed status dari dokumen
    candidate.completeness_status = _recalc_completeness(candidate_id, db)
    # Set is_blacklisted secara eksplisit — field ini tidak ada di kolom DB,
    # harus dihitung dari relasi blacklist. Tanpa ini selalu mengembalikan False (schema default).
    candidate.is_blacklisted = db.query(Blacklist).filter(
        Blacklist.candidate_id == candidate.id,
        Blacklist.is_active == True,
        Blacklist.is_approved == True,
    ).first() is not None
    return candidate


@router.post("/{candidate_id}/completeness/recalculate", response_model=dict)
def recalculate_completeness(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    status = _recalc_completeness(candidate_id, db)
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")
    candidate.completeness_status = status
    db.commit()
    db.refresh(candidate)
    return {"completeness_status": status}


# ── Update ───────────────────────────────────────────────────────────────────

@router.put("/{candidate_id}", response_model=CandidateResponse)
def update_candidate(
    candidate_id: str,
    payload: CandidateUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")

    # Reduplicate check (hanya jika field berubah)
    if payload.email != candidate.email or payload.phone != candidate.phone or payload.identity_no != candidate.identity_no:
        dup = candidate_service.check_duplicate(
            db,
            payload.email,
            payload.phone,
            payload.identity_no,
            exclude_candidate_id=str(candidate_id),
        )
        if dup["is_duplicate"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email/phone/NIK sudah digunakan kandidat lain (ID: {dup['existing_id']})",
            )

    # Normalise phone if included in update
    if "phone" in payload.model_dump(exclude_unset=True):
        payload.phone = _normalize_phone(payload.phone) or None

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(candidate, key, value)
    db.commit()
    db.refresh(candidate)
    return candidate


# ── Soft Delete (Admin only) ─────────────────────────────────────────────────

@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")
    candidate.is_deleted = True
    db.commit()


# ── PATCH flags ──────────────────────────────────────────────────────────────

@router.patch("/{candidate_id}/flags", response_model=CandidateResponse)
def patch_flags(
    candidate_id: str,
    payload: CandidateFlagsPatch,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")

    data = payload.model_dump(exclude_unset=True)
    if "completeness_status" in data and data["completeness_status"] not in ("lengkap", "belum_lengkap"):
        raise HTTPException(status_code=422, detail="completeness_status harus 'lengkap' atau 'belum_lengkap'")
    if "contact_status" in data and data["contact_status"] not in ("aktif", "tidak_bisa_dihubungi"):
        raise HTTPException(status_code=422, detail="contact_status harus 'aktif' atau 'tidak_bisa_dihubungi'")

    for key, value in data.items():
        setattr(candidate, key, value)
    db.commit()
    db.refresh(candidate)
    return candidate


# ── Education CRUD ───────────────────────────────────────────────────────────

@router.get("/{candidate_id}/education", response_model=list[EducationResponse])
@router.get("/{candidate_id}/education/", response_model=list[EducationResponse])
def list_education(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    db.query(Candidate).filter(Candidate.id == candidate_id).first() or _raise_404("Kandidat tidak ditemukan")
    return db.query(CandidateEducation).filter(CandidateEducation.candidate_id == candidate_id).all()


@router.post("/{candidate_id}/education", response_model=EducationResponse, status_code=status.HTTP_201_CREATED)
@router.post("/{candidate_id}/education/", response_model=EducationResponse, status_code=status.HTTP_201_CREATED)
def add_education(
    candidate_id: str,
    payload: EducationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    db.query(Candidate).filter(Candidate.id == candidate_id).first() or _raise_404("Kandidat tidak ditemukan")
    edu = CandidateEducation(candidate_id=candidate_id, **payload.model_dump())
    db.add(edu)
    db.commit()
    db.refresh(edu)
    return edu


@router.put("/{candidate_id}/education/{edu_id}", response_model=EducationResponse)
@router.put("/{candidate_id}/education/{edu_id}/", response_model=EducationResponse)
def update_education(
    candidate_id: str,
    edu_id: str,
    payload: EducationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    edu = db.query(CandidateEducation).filter(
        CandidateEducation.id == edu_id,
        CandidateEducation.candidate_id == candidate_id,
    ).first()
    if not edu:
        raise HTTPException(status_code=404, detail="Data pendidikan tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(edu, key, value)
    db.commit()
    db.refresh(edu)
    return edu


@router.delete("/{candidate_id}/education/{edu_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/{candidate_id}/education/{edu_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_education(
    candidate_id: str,
    edu_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    edu = db.query(CandidateEducation).filter(
        CandidateEducation.id == edu_id,
        CandidateEducation.candidate_id == candidate_id,
    ).first()
    if not edu:
        raise HTTPException(status_code=404, detail="Data pendidikan tidak ditemukan")
    db.delete(edu)
    db.commit()


# ── Experience CRUD ──────────────────────────────────────────────────────────

@router.get("/{candidate_id}/experience", response_model=list[ExperienceResponse])
@router.get("/{candidate_id}/experience/", response_model=list[ExperienceResponse])
def list_experience(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    db.query(Candidate).filter(Candidate.id == candidate_id).first() or _raise_404("Kandidat tidak ditemukan")
    return db.query(CandidateExperience).filter(CandidateExperience.candidate_id == candidate_id).all()


@router.post("/{candidate_id}/experience", response_model=ExperienceResponse, status_code=status.HTTP_201_CREATED)
@router.post("/{candidate_id}/experience/", response_model=ExperienceResponse, status_code=status.HTTP_201_CREATED)
def add_experience(
    candidate_id: str,
    payload: ExperienceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    db.query(Candidate).filter(Candidate.id == candidate_id).first() or _raise_404("Kandidat tidak ditemukan")
    exp = CandidateExperience(candidate_id=candidate_id, **payload.model_dump())
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


@router.put("/{candidate_id}/experience/{exp_id}", response_model=ExperienceResponse)
@router.put("/{candidate_id}/experience/{exp_id}/", response_model=ExperienceResponse)
def update_experience(
    candidate_id: str,
    exp_id: str,
    payload: ExperienceUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    exp = db.query(CandidateExperience).filter(
        CandidateExperience.id == exp_id,
        CandidateExperience.candidate_id == candidate_id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Pengalaman kerja tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(exp, key, value)
    db.commit()
    db.refresh(exp)
    return exp


@router.delete("/{candidate_id}/experience/{exp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_experience(
    candidate_id: str,
    exp_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    exp = db.query(CandidateExperience).filter(
        CandidateExperience.id == exp_id,
        CandidateExperience.candidate_id == candidate_id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Pengalaman kerja tidak ditemukan")
    db.delete(exp)
    db.commit()


# ── Upload Latest Data (PDF extraction & candidate update) ───────────────────

@router.post("/{candidate_id}/upload-latest-data", status_code=status.HTTP_200_OK)
async def upload_latest_data(
    candidate_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Upload PDF data terbaru kandidat (hasil form interview).
    Sistem akan mengekstrak teks dari PDF, mengirimnya ke AI,
    lalu memperbarui data kandidat (pengalaman kerja + tools).
    """
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS = {".pdf"}

    ext = (file.filename or "").lower().rsplit(".", 1)
    ext = f".{ext[-1]}" if len(ext) > 1 else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hanya file PDF yang diizinkan.",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ukuran file melebihi 10MB.",
        )

    candidate = db.query(Candidate).filter(
        Candidate.id == candidate_id,
        Candidate.is_deleted == False,
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")

    # ── Ekstrak teks dari PDF menggunakan PyMuPDF ──
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=content, filetype="pdf")
        extracted_text = ""
        for page_idx, page in enumerate(doc):
            extracted_text += f"\n--- HALAMAN {page_idx + 1} ---\n" + page.get_text()
        doc.close()
    except Exception as exc:
        logger.error("Gagal mengekstrak teks PDF: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Gagal membaca isi file PDF. Pastikan file tidak terpassword.",
        )

    if not extracted_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="PDF tidak mengandung teks yang dapat dibaca.",
        )

    # ── Kirim ke AI untuk ekstraksi terstruktur ──
    LATEST_DATA_PROMPT = """Kamu adalah sistem ekstraksi data HR yang sangat teliti, ahli dalam mengekstrak dokumen CV/Resume lengkap ke dalam JSON terstruktur.
Dokumen yang diberikan mungkin memiliki banyak halaman (Halaman 1: Cover, Halaman 2: Data Pribadi & Pendidikan, Halaman 3+: Pengalaman Kerja / Working Experience, Halaman berikutnya: Skills & Sertifikat).

TUGAS UTAMA:
Ekstrak SELURUH entri dari bagian "Working Experience" / "Pengalaman Kerja". JANGAN SAMPAI ADA PERUSAHAAN YANG TERLEWAT.
Setiap entri pengalaman kerja biasanya memiliki:
- Periode (contoh: "January 2026 - Present", "October 2023 – Jan 2026", "Jul 2022 – Sep 2024", "2018 - 2020")
- Company / Perusahaan (contoh: "PT Dasa Aprilindo Sentosa", "PT Median Talenta Raya", "PT. Sinergi Digital Teknologi")
- Position / Posisi (contoh: "IT Senior Quality Assurance Analyst", "Frontend Developer")
- Tools: DAFTAR TOOLS/SOFTWARE/TEKNOLOGI YANG DIGUNAKAN DI PERUSAHAAN TERSEBUT (contoh: ["Postman", "LoadRunner", "NeoLoad", "Jira", "Ms. Excel"]). Nilai ini spesifik per pengalaman!
- Job description / Deskripsi pekerjaan (kumpulkan bullet points / teks deskripsi pekerjaan)

EKSTRAK JUGA:
1. Data pribadi:
   - nama lengkap (full_name)
   - email
   - nomor HP/telepon (phone)
   - jenis kelamin (gender: "Laki-laki" jika Male/Pria/Laki-laki, atau "Perempuan" jika Female/Wanita/Perempuan)
   - status pernikahan (marital_status: "Menikah" jika Married/Menikah/Kawin, "Belum Menikah" jika Single/Belum Menikah/Lajang, "Cerai Hidup", atau "Cerai Mati")
2. Riwayat pendidikan: nama institusi/universitas, jurusan (major), tahun masuk, tahun lulus, IPK/GPA.
3. Skills: semua keahlian teknis (programming language, database, framework, testing tools, soft skills) yang disebutkan di CV.

Format JSON yang DIHARUSKAN (kembalikan SATU objek JSON murni):
{
  "personal": {
    "full_name": "string | null",
    "email": "string | null",
    "phone": "string | null",
    "gender": "Laki-laki | Perempuan | null",
    "marital_status": "Belum Menikah | Menikah | Cerai Hidup | Cerai Mati | null"
  },
  "skills": ["skill1", "skill2"],
  "educations": [
    {
      "institution": "nama universitas / institusi",
      "major": "jurusan",
      "graduation_year": 2017,
      "gpa": 3.61
    }
  ],
  "experiences": [
    {
      "company_name": "nama perusahaan",
      "job_title": "posisi/jabatan",
      "period": "teks periode asli",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD atau null jika Present/Sekarang",
      "description": "deskripsi pekerjaan lengkap",
      "tools": ["tool1", "tool2", "tool3"]
    }
  ]
}

Aturan Ketat:
- BACA SELURUH TEKS DOKUMEN SAMPAI SELESAI, jangan hanya membaca halaman 1 atau 2.
- Field "experiences" HARUS berupa array dari semua entri pengalaman kerja yang ditemukan di dokumen. Jangan kembalikan array kosong jika ada teks Working Experience / Pengalaman Kerja.
- Tanggal mulai (start_date) diisi format YYYY-MM-DD (jika hanya bulan & tahun, misal Oct 2023 -> 2023-10-01).
- Tanggal selesai (end_date) diisi format YYYY-MM-DD atau null jika "Present" / "Sekarang".
- Tools pada tiap pengalaman HARUS dipecah menjadi array string (pisahkan jika di teks memakai koma / kata "and").
- Output HARUS berupa JSON murni tanpa markdown fence (```json ... ```) dan tanpa teks tambahan sebelum/sesudah.

Teks dokumen kandidat:
"""

    try:
        from openai import OpenAI
        from app.core.config import settings as app_settings
        client = OpenAI(api_key=app_settings.OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Kamu adalah sistem ekstraksi data HR yang mengembalikan JSON murni tanpa markdown."},
                {"role": "user", "content": LATEST_DATA_PROMPT + extracted_text[:16000]},
            ],
            temperature=0,
            response_format={"type": "json_object"},
        )
        raw_json = response.choices[0].message.content or "{}"
        log_openai_usage(
            db,
            prompt_tokens=response.usage.prompt_tokens if response.usage else 0,
            completion_tokens=response.usage.completion_tokens if response.usage else 0,
            model="gpt-4o-mini",
            call_type="candidate_cv_extract",
        )
    except Exception as exc:
        logger.error("Gagal memanggil AI untuk ekstraksi: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gagal memproses PDF dengan AI. Coba lagi nanti.",
        )

    # ── Parse JSON hasil AI ──
    import json as _json
    try:
        extracted = _json.loads(raw_json)
    except _json.JSONDecodeError:
        logger.error("AI mengembalikan JSON tidak valid: %s", raw_json[:500])
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI mengembalikan data tidak valid.",
        )

    updated_fields: list[str] = []

    # ── Update data pribadi kandidat ──
    ai_personal = extracted.get("personal") or {}
    if isinstance(ai_personal, dict):
        if ai_personal.get("full_name") and (not candidate.full_name or candidate.full_name == "Unknown"):
            candidate.full_name = ai_personal["full_name"].strip()
            updated_fields.append("nama")
        if ai_personal.get("email") and not candidate.email:
            candidate.email = ai_personal["email"].strip()
            updated_fields.append("email")
        if ai_personal.get("phone"):
            normalized_p = _normalize_phone(ai_personal["phone"])
            if normalized_p and not candidate.phone:
                candidate.phone = normalized_p
                updated_fields.append("telepon")
        if ai_personal.get("gender"):
            raw_g = str(ai_personal["gender"]).strip().lower()
            norm_g = None
            if "laki" in raw_g or "pria" in raw_g or "male" in raw_g or raw_g == "m" or "man" in raw_g:
                norm_g = "Laki-laki"
            elif "perempuan" in raw_g or "wanita" in raw_g or "female" in raw_g or raw_g == "f" or "woman" in raw_g:
                norm_g = "Perempuan"
            else:
                norm_g = ai_personal["gender"].strip()
            if norm_g and candidate.gender != norm_g:
                candidate.gender = norm_g
                updated_fields.append("gender")

        if ai_personal.get("marital_status"):
            raw_m = str(ai_personal["marital_status"]).strip().lower()
            norm_m = None
            if "belum" in raw_m or "single" in raw_m or "lajang" in raw_m:
                norm_m = "Belum Menikah"
            elif "cerai hidup" in raw_m or "divorced" in raw_m:
                norm_m = "Cerai Hidup"
            elif "cerai mati" in raw_m or "widowed" in raw_m:
                norm_m = "Cerai Mati"
            elif "nikah" in raw_m or "married" in raw_m or "kawin" in raw_m:
                norm_m = "Menikah"
            else:
                norm_m = ai_personal["marital_status"].strip()
            if norm_m and candidate.marital_status != norm_m:
                candidate.marital_status = norm_m
                updated_fields.append("status pernikahan")

    # ── Update skills kandidat (merge / replace) ──
    ai_skills = extracted.get("skills") or []
    if ai_skills and isinstance(ai_skills, list):
        existing_skills = candidate.skills or []
        clean_ai_skills = [str(s).strip() for s in ai_skills if str(s).strip()]
        merged_skills = list(dict.fromkeys(existing_skills + [s for s in clean_ai_skills if s not in existing_skills]))
        candidate.skills = merged_skills
        updated_fields.append("skills")

    # ── Update riwayat pendidikan ──
    ai_educations = extracted.get("educations") or []
    if ai_educations and isinstance(ai_educations, list):
        existing_edus = db.query(CandidateEducation).filter(
            CandidateEducation.candidate_id == candidate_id
        ).all()
        edu_lookup = {
            (e.institution or "").strip().lower(): e
            for e in existing_edus
        }
        edus_updated = 0
        edus_created = 0

        for ai_edu in ai_educations:
            if not isinstance(ai_edu, dict):
                continue
            institution = (ai_edu.get("institution") or "").strip()
            if not institution:
                continue

            major = (ai_edu.get("major") or "").strip() or None
            grad_year = None
            if ai_edu.get("graduation_year"):
                try:
                    grad_year = int(ai_edu["graduation_year"])
                except (ValueError, TypeError):
                    pass

            gpa = None
            if ai_edu.get("gpa"):
                try:
                    from decimal import Decimal
                    gpa = Decimal(str(ai_edu["gpa"]).replace(",", "."))
                except Exception:
                    pass

            existing_e = edu_lookup.get(institution.lower())
            if existing_e:
                if major and not existing_e.major:
                    existing_e.major = major
                if grad_year and not existing_e.graduation_year:
                    existing_e.graduation_year = grad_year
                if gpa and not existing_e.gpa:
                    existing_e.gpa = gpa
                edus_updated += 1
            else:
                new_edu = CandidateEducation(
                    candidate_id=candidate_id,
                    institution=institution,
                    major=major,
                    graduation_year=grad_year,
                    gpa=gpa,
                )
                db.add(new_edu)
                edus_created += 1

        if edus_updated or edus_created:
            updated_fields.append(f"pendidikan ({edus_updated} diupdate, {edus_created} ditambahkan)")

    # ── Update pengalaman kerja (Replace dengan data terbaru dari CV) ──
    ai_experiences = extracted.get("experiences") or []
    if ai_experiences and isinstance(ai_experiences, list):
        from app.core.date_utils import parse_date_str, parse_period_range

        # Filter entri yang memiliki nama perusahaan
        valid_experiences = [
            exp for exp in ai_experiences
            if isinstance(exp, dict) and (exp.get("company_name") or "").strip()
        ]

        # Hanya hapus dan ganti jika AI berhasil mengekstrak setidaknya satu pengalaman kerja yang valid
        if valid_experiences:
            # Hapus data pengalaman kerja lama
            db.query(CandidateExperience).filter(
                CandidateExperience.candidate_id == candidate_id
            ).delete()

            for ai_exp in valid_experiences:
                company = (ai_exp.get("company_name") or "").strip()
                tools_raw = ai_exp.get("tools") or []
                tools = [t.strip() for t in tools_raw if isinstance(t, str) and t.strip()]

                # Tangani tanggal periode secara fleksibel (support dua konvensi field: EN & ID)
                period = ai_exp.get("period") or ai_exp.get("periode")
                start_raw = ai_exp.get("start_date") or ai_exp.get("mulai")
                end_raw = ai_exp.get("end_date") or ai_exp.get("selesai")
                start_date, end_date = None, None
                if period:
                    start_date, end_date = parse_period_range(period)
                if not start_date and start_raw:
                    start_date = parse_date_str(start_raw)
                if not end_date and end_raw:
                    end_date = parse_date_str(end_raw)

                description = (ai_exp.get("description") or "").strip() or None
                job_title = (ai_exp.get("job_title") or "").strip() or None

                new_exp = CandidateExperience(
                    candidate_id=candidate_id,
                    company_name=company,
                    job_title=job_title,
                    start_date=start_date,
                    end_date=end_date,
                    description=description,
                    tools=tools if tools else None,
                )
                db.add(new_exp)

            updated_fields.append(f"pengalaman kerja ({len(valid_experiences)} entri terbaru disimpan)")

    db.commit()

    return {
        "success": True,
        "message": f"Data kandidat berhasil diperbarui. Field yang diupdate: {', '.join(updated_fields) if updated_fields else 'Tidak ada perubahan'}.",
        "updated_fields": updated_fields,
    }


# ── Helpers ──────────────────────────────────────────────────────────────────

def _raise_404(msg: str) -> None:
    raise HTTPException(status_code=404, detail=msg)


# ── Document CRUD ─────────────────────────────────────────────────────────────

@router.get("/{candidate_id}/documents", response_model=list[DocumentResponse])
@router.get("/{candidate_id}/documents/", response_model=list[DocumentResponse])
def list_documents(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    db.query(Candidate).filter(Candidate.id == candidate_id).first() or _raise_404("Kandidat tidak ditemukan")
    return (
        db.query(CandidateDocument)
        .filter(CandidateDocument.candidate_id == candidate_id, CandidateDocument.is_deleted == False)
        .all()
    )


@router.post("/{candidate_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
@router.post("/{candidate_id}/documents/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    candidate_id: str,
    doc_type: str = Query(..., description="KTP/Ijazah/Transkrip/CV_asli/Foto/Sertifikat/Dokumen_Onboarding/BPJS_TK/BPJS_Kesehatan/NPWP"),
    label: str | None = Query(None, description="Keterangan tambahan, mis. 'Ijazah S1 UI', 'Sertifikat AWS 2024'"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    # Validasi kandidat
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # max 10MB
        raise HTTPException(status_code=413, detail="Ukuran file maksimal 10MB")

    folder = f"Candidates/{candidate_id}"
    storage = get_storage_service()
    result = await storage.upload(
        file_content=content,
        filename=file.filename or f"{doc_type}.pdf",
        folder=folder,
    )

    doc = CandidateDocument(
        candidate_id=candidate_id,
        doc_type=doc_type,
        label=label or None,
        file_url=result["file_url"],
        drive_item_id=None,  # local storage — drive_item_id tidak dipakai
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Recalculate kelengkapan kandidat
    new_status = _recalc_completeness(candidate_id, db)
    if candidate.completeness_status != new_status:
        candidate.completeness_status = new_status
        db.commit()

    return doc


@router.get("/{candidate_id}/documents/{doc_id}/download-url", response_model=dict)
async def get_download_url(
    candidate_id: str,
    doc_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    doc = db.query(CandidateDocument).filter(
        CandidateDocument.id == doc_id,
        CandidateDocument.candidate_id == candidate_id,
        CandidateDocument.is_deleted == False,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    if not doc.file_url:
        raise HTTPException(status_code=400, detail="File belum diupload")

    storage = get_storage_service()
    # Local storage: file_url sudah berupa path relatif, return langsung
    if doc.drive_item_id:
        url = await storage.get_download_url(doc.drive_item_id)
    else:
        url = doc.file_url
    return {"download_url": url}


@router.patch("/{candidate_id}/documents/{doc_id}/verify", response_model=DocumentResponse)
def toggle_verify_document(
    candidate_id: str,
    doc_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    doc = db.query(CandidateDocument).filter(
        CandidateDocument.id == doc_id,
        CandidateDocument.candidate_id == candidate_id,
        CandidateDocument.is_deleted == False,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    doc.is_verified = not doc.is_verified
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{candidate_id}/projects", response_model=list[CandidateProjectResponse])
def list_candidate_projects(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Ambil semua project milik kandidat."""
    db.query(Candidate).filter(Candidate.id == candidate_id).first() or _raise_404("Kandidat tidak ditemukan")
    return (
        db.query(CandidateProject)
        .filter(CandidateProject.candidate_id == candidate_id)
        .order_by(CandidateProject.created_at.asc())
        .all()
    )


@router.post("/{candidate_id}/ai/draft-projects", response_model=list[CandidateProjectResponse])
def generate_candidate_project_drafts(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Generate draft project list dari pengalaman kandidat via LLM.
    - Jika sudah ada project tersimpan di DB → kembalikan itu.
    - Jika belum ada → panggil AI, simpan hasilnya, kembalikan.
    """
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")

    existing = (
        db.query(CandidateProject)
        .filter(CandidateProject.candidate_id == candidate_id)
        .all()
    )
    if existing:
        return existing

    result = generate_project_drafts(candidate, db)
    drafts = result.get("drafts", [])

    saved: list[CandidateProject] = []
    for draft in drafts:
        project = CandidateProject(
            candidate_id=candidate_id,
            project_name=draft.get("project_name", "Proyek"),
            role=draft.get("role"),
            summary=draft.get("summary"),
            impact=draft.get("impact"),
            tech_stack=draft.get("tech_stack") or [],
            duration=draft.get("duration"),
            is_draft=True,
        )
        db.add(project)
        saved.append(project)

    db.commit()
    for p in saved:
        db.refresh(p)
    return saved


@router.patch("/{candidate_id}/projects/{project_id}", response_model=CandidateProjectResponse)
def update_candidate_project(
    candidate_id: str,
    project_id: str,
    payload: CandidateProjectUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """Update field project (termasuk set is_draft=False untuk approve)."""
    project = db.query(CandidateProject).filter(
        CandidateProject.id == project_id,
        CandidateProject.candidate_id == candidate_id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{candidate_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    candidate_id: str,
    doc_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    doc = db.query(CandidateDocument).filter(
        CandidateDocument.id == doc_id,
        CandidateDocument.candidate_id == candidate_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    doc.is_deleted = True
    storage = get_storage_service()
    # Hapus file fisik untuk local storage
    if not doc.drive_item_id and doc.file_url:
        try:
            await storage.delete(doc.file_url)
        except Exception:
            pass
    # Hapus dari OneDrive jika ada drive_item_id (migration scenario)
    elif doc.drive_item_id:
        try:
            await storage.delete_file(doc.drive_item_id)
        except Exception:
            pass  # biarkan soft-delete lokal meskipun hapus cloud gagal
    db.commit()

    # Recalculate kelengkapan kandidat
    new_status = _recalc_completeness(candidate_id, db)
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if candidate:
        if doc.doc_type == "Foto":
            candidate.photo_url = None
        if candidate.completeness_status != new_status:
            candidate.completeness_status = new_status
        db.commit()


from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, get_current_user, require_role
from app.models.application import (
    APPLICATION_STATUSES,
    AIScreeningResult,
    Application,
    StageHistory,
    STAGE_NAMES,
)
from app.models.candidate import Candidate
from app.models.employee import Employee
from app.schemas.application import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationStageDetail,
    StageHistoryCreate,
    StageHistoryResponse,
)
from app.services import employee_service

router = APIRouter()

# Validasi transisi: stage saat ini -> stage tujuan yang diperbolehkan
VALID_TRANSITIONS = {
    "Dijadwalkan_Interview": ["Konfirmasi_Kehadiran"],
    "Konfirmasi_Kehadiran": ["Interview_HR"],
    "Interview_HR": ["Psikotest", "Interview_User"],
    "Psikotest": ["Interview_User"],
    "Interview_User": ["Offering", "Rejected"],
    "Offering": ["Tanda_Tangan_Kontrak"],
    "Tanda_Tangan_Kontrak": ["Onboarding"],
    "Onboarding": ["Existing"],
}


def _get_next_possible_stages(current_stage: str) -> list[str]:
    transitions = VALID_TRANSITIONS.get(current_stage, [])
    return transitions + ["Rejected", "Withdrawn"]


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
            joinedload(Application.position).joinedload(__import__("app.models.position", fromlist=["Position"]).Position.client),
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

    # Validasi posisi
    from app.models.position import Position
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
    db.commit()
    db.refresh(application)
    return application


# ── Detail ───────────────────────────────────────────────────────────────────

@router.get("/{application_id}", response_model=ApplicationStageDetail)
def get_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    application = (
        db.query(Application)
        .options(
            joinedload(Application.candidate),
            joinedload(Application.position),
            joinedload(Application.recruiter),
            joinedload(Application.stage_histories).order_by(StageHistory.created_at.asc()),
        )
        .filter(Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Lamaran tidak ditemukan")
    return application


# ── Stage History List ───────────────────────────────────────────────────────

@router.get("/{application_id}/stages/", response_model=list[StageHistoryResponse])
def list_stage_history(
    application_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    db.query(Application).filter(Application.id == application_id).first() or _raise_404("Lamaran tidak ditemukan")
    return (
        db.query(StageHistory)
        .filter(StageHistory.application_id == application_id)
        .order_by(StageHistory.created_at.asc())
        .all()
    )


# ── Update Stage ─────────────────────────────────────────────────────────────

@router.patch("/{application_id}/stages/", response_model=ApplicationStageDetail)
def update_stage(
    application_id: str,
    payload: StageHistoryCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    application = (
        db.query(Application)
        .options(joinedload(Application.candidate), joinedload(Application.position), joinedload(Application.recruiter))
        .filter(Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Lamaran tidak ditemukan")

    # Validasi transisi
    allowed = VALID_TRANSITIONS.get(application.current_stage, []) + ["Rejected", "Withdrawn"]
    if payload.stage_name not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transisi tidak valid dari '{application.current_stage}' ke '{payload.stage_name}'. "
                   f"Stages yang mungkin: {allowed}",
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

    # Update application
    application.current_stage = payload.stage_name
    if payload.stage_name in ("Rejected", "Withdrawn"):
        application.status = payload.stage_name.lower()
    elif payload.stage_name == "Existing":
        application.status = "hired"
        # Trigger auto-create employee (TASK-05.2)
        employee_service.create_from_application(db, application_id)
    elif payload.stage_name == "Interview_HR" and payload.result == "pass":
        # Jika hasil interview HR = pass, lanjut ke psikotest atau user interview
        pass
    db.commit()
    db.refresh(application)

    # Reload dengan stage_history
    fresh = (
        db.query(Application)
        .options(
            joinedload(Application.candidate),
            joinedload(Application.position),
            joinedload(Application.recruiter),
            joinedload(Application.stage_histories).order_by(StageHistory.created_at.asc()),
        )
        .filter(Application.id == application_id)
        .first()
    )
    return fresh


# ── Helpers ──────────────────────────────────────────────────────────────────

def _raise_404(msg: str) -> None:
    raise HTTPException(status_code=404, detail=msg)

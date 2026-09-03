from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, require_role

router = APIRouter()


@router.get("/")
def list_applications(current_user=Depends(get_current_user)):
    # TODO: TASK-05.1 — filter posisi, status, tahapan, recruiter, periode
    return {"message": "TODO: list applications"}


@router.post("/")
def create_application(current_user=Depends(require_role("hr", "manager", "admin"))):
    return {"message": "TODO: create application"}


@router.get("/{application_id}")
def get_application(application_id: str, current_user=Depends(get_current_user)):
    return {"message": f"TODO: get application {application_id}"}


# --- Stages ---
@router.get("/{application_id}/stages/")
def list_stage_history(application_id: str, current_user=Depends(get_current_user)):
    return {"message": "TODO: list stage history"}


@router.patch("/{application_id}/stages/")
def update_stage(application_id: str, current_user=Depends(require_role("hr", "manager", "admin"))):
    # TODO: TASK-05.1
    # - validasi transisi tahapan
    # - simpan ke stage_history
    # - jika Existing → auto-create employee
    return {"message": "TODO: update stage"}

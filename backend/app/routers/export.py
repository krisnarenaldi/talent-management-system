from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, require_role

router = APIRouter()


@router.get("/candidates")
def export_candidates(current_user=Depends(require_role("hr", "manager", "admin"))):
    # TODO: TASK-07.1 — generate Excel dengan openpyxl, stream response
    return {"message": "TODO: export candidates Excel"}


@router.get("/pipeline")
def export_pipeline(current_user=Depends(require_role("hr", "manager", "admin"))):
    return {"message": "TODO: export pipeline Excel"}


@router.get("/incomplete")
def export_incomplete(current_user=Depends(require_role("hr", "manager", "admin"))):
    return {"message": "TODO: export incomplete candidates"}

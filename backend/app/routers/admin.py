from fastapi import APIRouter, Depends

from app.core.dependencies import require_role

router = APIRouter()


# --- Blacklist Status Types ---
@router.get("/blacklist-status-types/")
def list_blacklist_status_types(current_user=Depends(require_role("admin", "manager"))):
    return {"message": "TODO: list blacklist status types"}


@router.post("/blacklist-status-types/")
def create_blacklist_status_type(current_user=Depends(require_role("admin"))):
    return {"message": "TODO"}


@router.put("/blacklist-status-types/{type_id}")
def update_blacklist_status_type(type_id: str, current_user=Depends(require_role("admin"))):
    return {"message": "TODO"}


# --- Agreement Types ---
@router.get("/agreement-types/")
def list_agreement_types(current_user=Depends(require_role("admin", "hr", "manager"))):
    return {"message": "TODO: list agreement types"}


@router.post("/agreement-types/")
def create_agreement_type(current_user=Depends(require_role("admin"))):
    return {"message": "TODO"}


@router.put("/agreement-types/{type_id}")
def update_agreement_type(type_id: str, current_user=Depends(require_role("admin"))):
    return {"message": "TODO"}

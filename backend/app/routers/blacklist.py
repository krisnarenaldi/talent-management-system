from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, require_role

router = APIRouter()


@router.get("/")
def list_blacklist(current_user=Depends(get_current_user)):
    return {"message": "TODO: list blacklist"}


@router.post("/")
def add_to_blacklist(current_user=Depends(require_role("hr", "manager", "admin"))):
    return {"message": "TODO: add to blacklist"}


@router.patch("/{blacklist_id}/approve")
def approve_blacklist(blacklist_id: str, current_user=Depends(require_role("manager"))):
    return {"message": f"TODO: approve blacklist {blacklist_id}"}


@router.patch("/{blacklist_id}/revoke")
def revoke_blacklist(blacklist_id: str, current_user=Depends(require_role("manager"))):
    return {"message": f"TODO: revoke blacklist {blacklist_id}"}


@router.get("/check")
def check_blacklist(
    email: str | None = None,
    phone: str | None = None,
    identity_no: str | None = None,
    current_user=Depends(get_current_user),
):
    return {"message": "TODO: check blacklist match"}

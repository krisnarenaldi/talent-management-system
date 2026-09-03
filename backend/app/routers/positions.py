from fastapi import APIRouter, Depends

from app.core.dependencies import require_role

router = APIRouter()


@router.get("/")
def list_positions(current_user=Depends(require_role("admin", "hr", "manager"))):
    return {"message": "TODO: list positions"}


@router.post("/")
def create_position(current_user=Depends(require_role("admin"))):
    return {"message": "TODO: create position"}


@router.put("/{position_id}")
def update_position(position_id: str, current_user=Depends(require_role("admin"))):
    return {"message": f"TODO: update position {position_id}"}

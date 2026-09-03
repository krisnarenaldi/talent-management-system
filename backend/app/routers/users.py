from fastapi import APIRouter, Depends

from app.core.dependencies import require_role

router = APIRouter()


@router.get("/")
def list_users(current_user=Depends(require_role("admin"))):
    # TODO: TASK-02.2 — implementasi penuh
    return {"message": "TODO: list users"}


@router.post("/")
def create_user(current_user=Depends(require_role("admin"))):
    return {"message": "TODO: create user"}


@router.put("/{user_id}")
def update_user(user_id: str, current_user=Depends(require_role("admin"))):
    return {"message": f"TODO: update user {user_id}"}


@router.delete("/{user_id}")
def delete_user(user_id: str, current_user=Depends(require_role("admin"))):
    return {"message": f"TODO: deactivate user {user_id}"}

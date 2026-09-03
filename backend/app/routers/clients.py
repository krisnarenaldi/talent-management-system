from fastapi import APIRouter, Depends

from app.core.dependencies import require_role

router = APIRouter()


@router.get("/")
def list_clients(current_user=Depends(require_role("admin", "hr", "manager"))):
    # TODO: TASK-03.1
    return {"message": "TODO: list clients"}


@router.post("/")
def create_client(current_user=Depends(require_role("admin"))):
    return {"message": "TODO: create client"}


@router.put("/{client_id}")
def update_client(client_id: str, current_user=Depends(require_role("admin"))):
    return {"message": f"TODO: update client {client_id}"}


@router.delete("/{client_id}")
def delete_client(client_id: str, current_user=Depends(require_role("admin"))):
    return {"message": f"TODO: delete client {client_id}"}

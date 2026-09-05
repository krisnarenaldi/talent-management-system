from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_role
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientResponse, ClientUpdate

router = APIRouter()


@router.get("", response_model=list[ClientResponse])
def list_clients(
    search: str | None = Query(None),
    is_active: bool | None = Query(None, description="Filter: hanya aktif / hanya nonaktif"),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "hr", "manager")),
):
    query = db.query(Client)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Client.name.ilike(pattern)) | (Client.pic_name.ilike(pattern))
        )
    if is_active is not None:
        query = query.filter(Client.is_active == is_active)
    return query.all()


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    client = Client(**payload.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: str,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(client, key, value)
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client tidak ditemukan")
    client.is_active = False
    db.commit()

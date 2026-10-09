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
    current_user=Depends(require_role("hr", "manager", "admin")),
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
    current_user=Depends(require_role("admin")),  # create: admin only
):
    if payload.pic_contact:
        new_contacts = [c.strip() for c in payload.pic_contact.split(";") if c.strip()]
        if new_contacts:
            existing_clients = db.query(Client).filter(Client.pic_contact != None).all()
            for existing in existing_clients:
                existing_contacts = [c.strip().lower() for c in existing.pic_contact.split(";") if c.strip()]
                for nc in new_contacts:
                    if nc.lower() in existing_contacts:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Nomor kontak PIC sudah digunakan oleh klien lain: {nc}",
                        )
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
    current_user=Depends(require_role("admin", "manager")),  # edit: admin + manager
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client tidak ditemukan")

    if payload.pic_contact:
        new_contacts = [c.strip() for c in payload.pic_contact.split(";") if c.strip()]
        if new_contacts:
            existing_clients = (
                db.query(Client)
                .filter(Client.pic_contact != None, Client.id != client_id)
                .all()
            )
            for existing in existing_clients:
                existing_contacts = [c.strip().lower() for c in existing.pic_contact.split(";") if c.strip()]
                for nc in new_contacts:
                    if nc.lower() in existing_contacts:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Nomor kontak PIC sudah digunakan oleh klien lain: {nc}",
                        )

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(client, key, value)
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),  # deactivate: admin only
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client tidak ditemukan")
    client.is_active = False
    db.commit()

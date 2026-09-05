from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_role
from app.models.blacklist import BlacklistStatusType
from app.schemas.blacklist_status_type import BlacklistStatusTypeCreate, BlacklistStatusTypeResponse, BlacklistStatusTypeUpdate

router = APIRouter()


@router.get("", response_model=list[BlacklistStatusTypeResponse])
def list_blacklist_status_types(
    is_active: bool | None = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    query = db.query(BlacklistStatusType)
    if is_active is not None:
        query = query.filter(BlacklistStatusType.is_active == is_active)
    return query.all()


@router.post("", response_model=BlacklistStatusTypeResponse, status_code=status.HTTP_201_CREATED)
def create_blacklist_status_type(
    payload: BlacklistStatusTypeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    existing = db.query(BlacklistStatusType).filter(BlacklistStatusType.label == payload.label).first()
    if existing:
        raise HTTPException(status_code=409, detail="Jenis status blacklist sudah ada")
    status_type = BlacklistStatusType(**payload.model_dump())
    db.add(status_type)
    db.commit()
    db.refresh(status_type)
    return status_type


@router.put("/{status_type_id}", response_model=BlacklistStatusTypeResponse)
def update_blacklist_status_type(
    status_type_id: str,
    payload: BlacklistStatusTypeUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    status_type = db.query(BlacklistStatusType).filter(BlacklistStatusType.id == status_type_id).first()
    if not status_type:
        raise HTTPException(status_code=404, detail="Jenis status tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(status_type, key, value)
    db.commit()
    db.refresh(status_type)
    return status_type


@router.delete("/{status_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blacklist_status_type(
    status_type_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    status_type = db.query(BlacklistStatusType).filter(BlacklistStatusType.id == status_type_id).first()
    if not status_type:
        raise HTTPException(status_code=404, detail="Jenis status tidak ditemukan")
    status_type.is_active = False
    db.commit()

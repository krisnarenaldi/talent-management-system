from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_role
from app.models.employee import AgreementType
from app.schemas.agreement_type import AgreementTypeCreate, AgreementTypeResponse, AgreementTypeUpdate

router = APIRouter()


@router.get("", response_model=list[AgreementTypeResponse])
def list_agreement_types(
    is_active: bool | None = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    query = db.query(AgreementType)
    if is_active is not None:
        query = query.filter(AgreementType.is_active == is_active)
    return query.all()


@router.post("", response_model=AgreementTypeResponse, status_code=status.HTTP_201_CREATED)
def create_agreement_type(
    payload: AgreementTypeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    existing = db.query(AgreementType).filter(AgreementType.label == payload.label).first()
    if existing:
        raise HTTPException(status_code=409, detail="Jenis perjanjian sudah ada")
    agreement_type = AgreementType(**payload.model_dump())
    db.add(agreement_type)
    db.commit()
    db.refresh(agreement_type)
    return agreement_type


@router.put("/{agreement_type_id}", response_model=AgreementTypeResponse)
def update_agreement_type(
    agreement_type_id: str,
    payload: AgreementTypeUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    agreement_type = db.query(AgreementType).filter(AgreementType.id == agreement_type_id).first()
    if not agreement_type:
        raise HTTPException(status_code=404, detail="Jenis perjanjian tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(agreement_type, key, value)
    db.commit()
    db.refresh(agreement_type)
    return agreement_type


@router.delete("/{agreement_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agreement_type(
    agreement_type_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    agreement_type = db.query(AgreementType).filter(AgreementType.id == agreement_type_id).first()
    if not agreement_type:
        raise HTTPException(status_code=404, detail="Jenis perjanjian tidak ditemukan")
    agreement_type.is_active = False
    db.commit()

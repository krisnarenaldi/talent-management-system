from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, require_role
from app.models.client import Client
from app.models.position import Position
from app.schemas.position import PositionCreate, PositionResponse, PositionUpdate

router = APIRouter()


@router.get("", response_model=list[PositionResponse])
def list_positions(
    client_id: str | None = Query(None),
    is_active: bool | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "hr", "manager")),
):
    query = db.query(Position).join(Client, Position.client_id == Client.id).options(
        joinedload(Position.client)
    )
    if client_id:
        query = query.filter(Position.client_id == client_id)
    if is_active is not None:
        query = query.filter(Position.is_active == is_active)
    if search:
        pattern = f"%{search}%"
        query = query.filter(Position.title.ilike(pattern))
    return query.all()


@router.post("", response_model=PositionResponse, status_code=status.HTTP_201_CREATED)
def create_position(
    payload: PositionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    from app.models.client import Client

    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client tidak ditemukan")
    position = Position(**payload.model_dump())
    db.add(position)
    db.commit()
    db.refresh(position)
    return position


@router.put("/{position_id}", response_model=PositionResponse)
def update_position(
    position_id: str,
    payload: PositionUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    from app.models.client import Client

    position = db.query(Position).join(Client).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(position, key, value)
    db.commit()
    db.refresh(position)
    return position

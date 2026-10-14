from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, require_role
from app.models.client import Client
from app.models.position import Position
from app.schemas.position import PositionCreate, PositionResponse, PositionUpdate, PositionsByClientResponse

router = APIRouter()


@router.get("/by-client", response_model=list[PositionsByClientResponse])
def list_positions_by_client(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    rows = (
        db.query(
            Client.id.label("client_id"),
            Client.name.label("client_name"),
            func.count(Position.id).label("total_positions"),
            func.max(Position.created_at).label("last_created_at"),
        )
        .outerjoin(Position, Position.client_id == Client.id)
        .group_by(Client.id, Client.name)
        .order_by(Client.name)
        .all()
    )
    return [
        {
            "client_id": row.client_id,
            "client_name": row.client_name,
            "total_positions": row.total_positions,
            "last_created_at": row.last_created_at,
        }
        for row in rows
    ]


@router.get("", response_model=list[PositionResponse])
def list_positions(
    client_id: str | None = Query(None),
    is_active: bool | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
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
    current_user=Depends(require_role("admin", "manager")),  # create: admin + manager
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
    current_user=Depends(require_role("admin", "manager")),  # edit: admin + manager
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

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_role
from app.models.candidate import SourceChannel
from app.schemas.source_channel import SourceChannelCreate, SourceChannelResponse, SourceChannelUpdate

router = APIRouter()


@router.get("/source-channels", response_model=list[SourceChannelResponse])
def list_source_channels(
    is_active: bool | None = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    query = db.query(SourceChannel)
    if is_active is not None:
        query = query.filter(SourceChannel.is_active == is_active)
    return query.order_by(SourceChannel.label.asc()).all()


@router.post("/source-channels", response_model=SourceChannelResponse, status_code=status.HTTP_201_CREATED)
def create_source_channel(
    payload: SourceChannelCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    existing = db.query(SourceChannel).filter(SourceChannel.label == payload.label).first()
    if existing:
        raise HTTPException(status_code=409, detail="Channel sudah ada")
    channel = SourceChannel(label=payload.label)
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return channel


@router.put("/source-channels/{channel_id}", response_model=SourceChannelResponse)
def update_source_channel(
    channel_id: str,
    payload: SourceChannelUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    channel = db.query(SourceChannel).filter(SourceChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(channel, key, value)
    db.commit()
    db.refresh(channel)
    return channel


@router.delete("/source-channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source_channel(
    channel_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    channel = db.query(SourceChannel).filter(SourceChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel tidak ditemukan")
    db.delete(channel)
    db.commit()

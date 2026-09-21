from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user, require_role
from app.models.notification import Notification
from app.models.user import User
from app.core.pydantic_utils import AutoStrUUID

router = APIRouter()


class NotificationResponse(BaseModel):
    id: AutoStrUUID
    user_id: AutoStrUUID
    type: str
    message: str
    link: str | None
    is_read: bool
    created_at: datetime | None

    class Config:
        from_attributes = True


@router.get("", response_model=list[NotificationResponse])
@router.get("/", response_model=list[NotificationResponse])
def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return notifikasi milik user yang login, diurutkan terbaru. Default 50 terbaru."""
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tandai satu notifikasi sebagai sudah dibaca."""
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notifikasi tidak ditemukan")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.patch("/read-all", response_model=list[NotificationResponse])
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tandai semua notifikasi user sebagai sudah dibaca."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )

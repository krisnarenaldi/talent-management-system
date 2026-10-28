from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_db, require_role
from app.models.app_setting import AppSetting
from app.models.candidate import SourceChannel
from app.schemas.source_channel import SourceChannelCreate, SourceChannelResponse, SourceChannelUpdate

router = APIRouter()

_BUDGET_KEY = "openai_budget_usd"


# ── AI Budget settings ────────────────────────────────────────────────────────

class AIBudgetResponse(BaseModel):
    budget_usd: float


class AIBudgetUpdate(BaseModel):
    budget_usd: float = Field(..., gt=0, description="Nominal top-up kredit OpenAI (USD)")


@router.get("/ai-budget", response_model=AIBudgetResponse, summary="Ambil nominal budget OpenAI")
def get_ai_budget(
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "manager")),
):
    """Kembalikan nominal budget OpenAI yang tersimpan (atau default dari config)."""
    row = db.query(AppSetting).filter(AppSetting.key == _BUDGET_KEY).first()
    if row:
        return AIBudgetResponse(budget_usd=float(row.value))
    return AIBudgetResponse(budget_usd=settings.OPENAI_BUDGET_USD)


@router.put("/ai-budget", response_model=AIBudgetResponse, summary="Update nominal budget OpenAI")
def update_ai_budget(
    payload: AIBudgetUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin")),
):
    """Simpan nominal top-up terbaru ke database. Hanya admin."""
    row = db.query(AppSetting).filter(AppSetting.key == _BUDGET_KEY).first()
    if row:
        row.value = str(payload.budget_usd)
    else:
        db.add(AppSetting(key=_BUDGET_KEY, value=str(payload.budget_usd)))
    db.commit()
    return AIBudgetResponse(budget_usd=payload.budget_usd)


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
    normalized = payload.label.strip().title()
    existing = db.query(SourceChannel).filter(func.lower(SourceChannel.label) == normalized.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Channel sudah ada")
    channel = SourceChannel(label=normalized)
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
    updates = payload.model_dump(exclude_unset=True)
    if "label" in updates:
        normalized = updates["label"].strip().title()
        duplicate = (
            db.query(SourceChannel)
            .filter(
                func.lower(SourceChannel.label) == normalized.lower(),
                SourceChannel.id != channel_id,
            )
            .first()
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="Channel sudah ada")
        updates["label"] = normalized
    for key, value in updates.items():
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

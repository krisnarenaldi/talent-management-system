from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.core.pydantic_utils import AutoStrUUID


class PositionCreate(BaseModel):
    client_id: str
    title: str
    requirement: str | None = None
    employment_type: str | None = None
    contract_duration_months: int | None = None
    is_active: bool = True
    ai_scoring_config: dict[str, Any] | None = None


class PositionUpdate(BaseModel):
    title: str | None = None
    requirement: str | None = None
    employment_type: str | None = None
    contract_duration_months: int | None = None
    is_active: bool | None = None
    ai_scoring_config: dict[str, Any] | None = None


class PositionResponse(BaseModel):
    id: AutoStrUUID
    client_id: AutoStrUUID
    client_name: str
    title: str
    requirement: str | None
    employment_type: str | None
    contract_duration_months: int | None
    is_active: bool
    ai_scoring_config: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

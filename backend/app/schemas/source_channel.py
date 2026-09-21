from datetime import datetime

from pydantic import BaseModel

from app.core.pydantic_utils import AutoStrUUID


class SourceChannelCreate(BaseModel):
    label: str


class SourceChannelUpdate(BaseModel):
    label: str | None = None
    is_active: bool | None = None


class SourceChannelResponse(BaseModel):
    id: AutoStrUUID
    label: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

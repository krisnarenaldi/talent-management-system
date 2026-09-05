from datetime import datetime

from pydantic import BaseModel

from app.core.pydantic_utils import AutoStrUUID


class ClientCreate(BaseModel):
    name: str
    industry: str | None = None
    pic_name: str | None = None
    pic_contact: str | None = None


class ClientUpdate(BaseModel):
    name: str | None = None
    industry: str | None = None
    pic_name: str | None = None
    pic_contact: str | None = None
    is_active: bool | None = None


class ClientResponse(BaseModel):
    id: AutoStrUUID
    name: str
    industry: str | None
    pic_name: str | None
    pic_contact: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

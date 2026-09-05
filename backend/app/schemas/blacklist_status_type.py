from pydantic import BaseModel

from app.core.pydantic_utils import AutoStrUUID


class BlacklistStatusTypeCreate(BaseModel):
    label: str
    is_active: bool = True


class BlacklistStatusTypeUpdate(BaseModel):
    label: str | None = None
    is_active: bool | None = None


class BlacklistStatusTypeResponse(BaseModel):
    id: AutoStrUUID
    label: str
    is_active: bool

    class Config:
        from_attributes = True

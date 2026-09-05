from pydantic import BaseModel

from app.core.pydantic_utils import AutoStrUUID


class AgreementTypeCreate(BaseModel):
    label: str
    is_active: bool = True


class AgreementTypeUpdate(BaseModel):
    label: str | None = None
    is_active: bool | None = None


class AgreementTypeResponse(BaseModel):
    id: AutoStrUUID
    label: str
    is_active: bool

    class Config:
        from_attributes = True

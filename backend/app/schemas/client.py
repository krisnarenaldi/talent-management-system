from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.phone_utils import normalize_phone
from app.core.pydantic_utils import AutoStrUUID


class ClientPic(BaseModel):
    """Satu baris PIC (Person In Charge) dari sebuah klien."""

    name: str = Field(min_length=1, max_length=255, description="Nama PIC")
    contact: str | None = Field(default=None, description="Kontak PIC (nomor HP/WA)")

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("contact")
    @classmethod
    def normalize_contact(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = normalize_phone(value)
        return normalized or None


class ClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    industry: str | None = Field(default=None, max_length=255)
    pic_name: str | None = None
    pic_contact: str | None = None
    pics: list[ClientPic] | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Nama klien tidak boleh kosong")
        return cleaned


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=255)
    pic_name: str | None = None
    pic_contact: str | None = None
    pics: list[ClientPic] | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Nama klien tidak boleh kosong")
        return cleaned


class ClientResponse(BaseModel):
    id: AutoStrUUID
    name: str
    industry: str | None
    pic_name: str | None
    pic_contact: str | None
    pics: list[ClientPic] = Field(default_factory=list)
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @field_validator("pics", mode="before")
    @classmethod
    def default_pics(cls, value: object) -> object:
        """Kolom ``pics`` boleh NULL untuk data lama — normalisasi jadi list kosong."""
        return value if value is not None else []

    class Config:
        from_attributes = True

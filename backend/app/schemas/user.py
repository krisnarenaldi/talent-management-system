from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.core.pydantic_utils import AutoStrUUID


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    role: str  # admin / hr / manager — akan divalidasi di service
    password: str  # plain text, akan di-hash di server


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None  # jika diisi, akan di-hash ulang


class UserResponse(BaseModel):
    id: AutoStrUUID
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.core.pydantic_utils import AutoStrUUID


class BlacklistCreate(BaseModel):
    candidate_id: AutoStrUUID
    status_type_id: AutoStrUUID
    reason: str | None = None
    notes: str | None = None
    blacklisted_date: date | None = None


class BlacklistApproval(BaseModel):
    approved_by: Optional[AutoStrUUID] = None


class BlacklistResponse(BaseModel):
    id: AutoStrUUID
    candidate_id: AutoStrUUID
    status_type_id: AutoStrUUID
    reason: str | None
    notes: str | None
    blacklisted_date: date | None
    pic_user_id: AutoStrUUID | None
    is_approved: bool
    approved_by: AutoStrUUID | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class BlacklistWithCandidate(BlacklistResponse):
    candidate_name: str
    candidate_email: str | None
    candidate_phone: str | None
    status_type_label: str

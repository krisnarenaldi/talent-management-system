from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, model_validator
from app.core.pydantic_utils import AutoStrUUID


class BlacklistCreate(BaseModel):
    candidate_id: Optional[AutoStrUUID] = None
    employee_id: Optional[AutoStrUUID] = None
    status_type_id: AutoStrUUID
    reason: str | None = None
    notes: str | None = None
    blacklisted_date: date | None = None
    pic_user_id: Optional[AutoStrUUID] = None

    @model_validator(mode="after")
    def at_least_one_target(self) -> "BlacklistCreate":
        if not self.candidate_id and not self.employee_id:
            raise ValueError("Either candidate_id or employee_id must be provided")
        return self


class BlacklistApproval(BaseModel):
    approved_by: Optional[AutoStrUUID] = None


class BlacklistResponse(BaseModel):
    id: AutoStrUUID
    candidate_id: Optional[AutoStrUUID] = None
    employee_id: Optional[AutoStrUUID] = None
    status_type_id: AutoStrUUID
    reason: str | None
    notes: str | None
    blacklisted_date: date | None
    pic_user_id: AutoStrUUID | None
    is_approved: bool
    approved_by: AutoStrUUID | None
    is_active: bool
    created_at: datetime
    # Target details (only one will be populated)
    candidate_name: str | None = None
    candidate_email: str | None = None
    candidate_phone: str | None = None
    employee_name: str | None = None
    employee_email: str | None = None
    employee_phone: str | None = None
    pic_name: str | None = None
    status_type_label: str
    # Computed target fields for frontend convenience
    target_name: str
    target_email: str | None
    target_phone: str | None
    target_type: str

    class Config:
        from_attributes = True

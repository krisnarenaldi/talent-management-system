from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.core.pydantic_utils import AutoStrUUID


class EducationCreate(BaseModel):
    institution: str | None = None
    major: str | None = None
    graduation_year: int | None = None
    gpa: Decimal | None = None


class EducationUpdate(BaseModel):
    institution: str | None = None
    major: str | None = None
    graduation_year: int | None = None
    gpa: Decimal | None = None


class EducationResponse(BaseModel):
    id: AutoStrUUID
    institution: str | None
    major: str | None
    graduation_year: int | None
    gpa: Decimal | None

    class Config:
        from_attributes = True


class ExperienceCreate(BaseModel):
    company_name: str | None = None
    job_title: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    description: str | None = None


class ExperienceUpdate(BaseModel):
    company_name: str | None = None
    job_title: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    description: str | None = None


class ExperienceResponse(BaseModel):
    id: AutoStrUUID
    company_name: str | None
    job_title: str | None
    start_date: datetime | None
    end_date: datetime | None
    description: str | None

    class Config:
        from_attributes = True


class CandidateCreate(BaseModel):
    full_name: str
    email: str | None = None
    phone: str | None = None
    identity_no: str | None = None
    domicile: str | None = None
    source_channel: str | None = None
    current_salary: Decimal | None = None
    expected_salary: Decimal | None = None
    notice_period_days: int | None = None


class CandidateUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    identity_no: str | None = None
    domicile: str | None = None
    source_channel: str | None = None
    current_salary: Decimal | None = None
    expected_salary: Decimal | None = None
    notice_period_days: int | None = None
    notes: str | None = None


class CandidateFlagsPatch(BaseModel):
    completeness_status: Optional[str] = None
    contact_status: Optional[str] = None


class CandidateResponse(BaseModel):
    id: AutoStrUUID
    full_name: str
    email: str | None
    phone: str | None
    identity_no: str | None
    domicile: str | None
    photo_url: str | None
    source_channel: str | None
    current_salary: Decimal | None
    expected_salary: Decimal | None
    notice_period_days: int | None
    completeness_status: str
    contact_status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CandidateWithWarnings(BaseModel):
    candidate: CandidateResponse
    is_duplicate: bool
    duplicate_candidate_id: AutoStrUUID | None
    is_blacklisted: bool
    blacklist_entries: list[dict]


# ── Document ─────────────────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: AutoStrUUID
    candidate_id: AutoStrUUID
    doc_type: str
    file_url: str | None
    drive_item_id: str | None
    is_verified: bool
    is_deleted: bool
    uploaded_at: datetime

    class Config:
        from_attributes = True

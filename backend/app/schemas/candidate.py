from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field

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


class LastEducationResponse(BaseModel):
    institution: str | None = None
    major: str | None = None
    graduation_year: int | None = None


class ExperienceCreate(BaseModel):
    company_name: str | None = None
    job_title: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    description: str | None = None
    tools: List[str] | None = None


class ExperienceUpdate(BaseModel):
    company_name: str | None = None
    job_title: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    description: str | None = None
    tools: List[str] | None = None


class ExperienceResponse(BaseModel):
    id: AutoStrUUID
    company_name: str | None
    job_title: str | None
    start_date: datetime | None
    end_date: datetime | None
    description: str | None
    tools: List[str] | None = None

    class Config:
        from_attributes = True


class CandidateCreate(BaseModel):
    full_name: str
    email: str | None = None
    phone: str | None = None
    identity_no: str | None = None
    birth_date: datetime | None = None
    birth_place: str | None = None
    gender: str | None = None
    blood_type: str | None = None
    marital_status: str | None = None
    domicile: str | None = None
    photo_url: str | None = None
    source_channel: str | None = None
    current_salary: Decimal | None = None
    expected_salary: Decimal | None = None
    notice_period_days: int | None = None
    pool_status: str = "database"
    talent_pool_reason: str | None = None
    talent_pool_notes: str | None = None
    notes: str | None = None
    skills: List[str] | None = None


class CandidateUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    identity_no: str | None = None
    birth_date: datetime | None = None
    birth_place: str | None = None
    gender: str | None = None
    blood_type: str | None = None
    marital_status: str | None = None
    domicile: str | None = None
    photo_url: str | None = None
    source_channel: str | None = None
    current_salary: Decimal | None = None
    expected_salary: Decimal | None = None
    notice_period_days: int | None = None
    pool_status: str | None = None
    talent_pool_reason: str | None = None
    talent_pool_notes: str | None = None
    notes: str | None = None
    skills: List[str] | None = None


class CandidateFlagsPatch(BaseModel):
    completeness_status: Optional[str] = None
    contact_status: Optional[str] = None


class CandidateTalentPoolUpdate(BaseModel):
    pool_status: str = Field(..., description="'database' | 'talent_pool' | 'future_lead'")
    talent_pool_reason: str | None = None
    talent_pool_notes: str | None = None


class BulkTalentPoolUpdateRequest(BaseModel):
    candidate_ids: List[AutoStrUUID]
    pool_status: str = Field(..., description="'database' | 'talent_pool' | 'future_lead'")
    talent_pool_reason: str | None = None
    talent_pool_notes: str | None = None


class BulkAssignRequest(BaseModel):
    candidate_ids: List[AutoStrUUID]
    position_id: AutoStrUUID
    client_user_name: str | None = None
    client_user_id: AutoStrUUID | None = None
    run_ai_screening: bool = False


class BulkUploadResponse(BaseModel):
    """Response schema for bulk CV upload endpoint."""
    screening_ids: List[AutoStrUUID]
    total_files: int
    message: str


class BulkAssignResponse(BaseModel):
    """Response schema for bulk assign endpoint."""
    success_count: int
    skipped_count: int
    skipped_details: List[dict]  # each dict: candidate_id, reason
    message: str


class CandidateResponse(BaseModel):
    id: AutoStrUUID
    full_name: str
    email: str | None
    phone: str | None
    identity_no: str | None
    birth_date: datetime | None
    birth_place: str | None
    gender: str | None
    blood_type: str | None
    marital_status: str | None
    domicile: str | None
    photo_url: str | None
    source_channel: str | None
    current_salary: Decimal | None
    expected_salary: Decimal | None
    notice_period_days: int | None
    completeness_status: str
    contact_status: str
    pool_status: str = "database"
    talent_pool_reason: str | None = None
    talent_pool_notes: str | None = None
    talent_pool_updated_at: datetime | None = None
    talent_pool_updated_by: AutoStrUUID | None = None
    notes: str | None
    skills: List[str] | None
    is_blacklisted: bool = False
    created_at: datetime
    updated_at: datetime
    last_education: LastEducationResponse | None = None
    applied_positions: list[str] = Field(default_factory=list)
    experience_level: str | None = None

    class Config:
        from_attributes = True


class CandidateWithWarnings(BaseModel):
    candidate: CandidateResponse
    is_duplicate: bool
    duplicate_candidate_id: AutoStrUUID | None
    is_blacklisted: bool
    blacklist_entries: list[dict]


# ── CandidateProject ──────────────────────────────────────────────────────────

class CandidateProjectCreate(BaseModel):
    project_name: str
    role: str | None = None
    summary: str | None = None
    impact: str | None = None
    tech_stack: List[str] | None = None
    duration: str | None = None
    is_draft: bool = True


class CandidateProjectUpdate(BaseModel):
    project_name: str | None = None
    role: str | None = None
    summary: str | None = None
    impact: str | None = None
    tech_stack: List[str] | None = None
    duration: str | None = None
    is_draft: bool | None = None


class CandidateProjectResponse(BaseModel):
    id: AutoStrUUID
    candidate_id: AutoStrUUID
    project_name: str
    role: str | None
    summary: str | None
    impact: str | None
    tech_stack: List[str] | None
    duration: str | None
    is_draft: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Document ─────────────────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: AutoStrUUID
    candidate_id: AutoStrUUID
    doc_type: str
    label: str | None
    file_url: str | None
    drive_item_id: str | None
    is_verified: bool
    is_deleted: bool
    uploaded_at: datetime

    class Config:
        from_attributes = True

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.core.pydantic_utils import AutoStrUUID


class PositionCreate(BaseModel):
    client_id: str
    title: str
    requirement: str | None = None
    job_description: str | None = None
    employment_type: str | None = None
    contract_duration_months: int = 0
    salary_budget: Decimal | None = None
    location: str | None = None
    client_user_names: list[str] = Field(
        default_factory=list,
        min_length=1,
        description="Nama PIC klien penanggung jawab posisi (wajib, harus berasal dari master PIC klien)",
    )
    is_active: bool = True
    ai_scoring_config: dict[str, Any] | None = None


class PositionUpdate(BaseModel):
    title: str | None = None
    requirement: str | None = None
    job_description: str | None = None
    employment_type: str | None = None
    contract_duration_months: int | None = 0
    salary_budget: Decimal | None = None
    location: str | None = None
    client_user_names: list[str] | None = Field(
        default=None,
        min_length=1,
        description="Nama PIC klien penanggung jawab posisi (wajib, harus berasal dari master PIC klien)",
    )
    is_active: bool | None = None
    ai_scoring_config: dict[str, Any] | None = None


class PositionResponse(BaseModel):
    id: AutoStrUUID
    client_id: AutoStrUUID
    client_name: str
    title: str
    requirement: str | None
    job_description: str | None
    employment_type: str | None
    contract_duration_months: int | None
    salary_budget: Decimal | None = None
    location: str | None = None
    client_user_names: list[str] = Field(default_factory=list)
    is_active: bool
    ai_scoring_config: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PositionsByClientResponse(BaseModel):
    client_id: AutoStrUUID
    client_name: str
    total_positions: int
    last_created_at: datetime | None

    class Config:
        from_attributes = True


# ── Recommend Candidates ──────────────────────────────────────────────────

class RecommendCandidatesRequest(BaseModel):
    """Request untuk AI Sourcing & Matching."""
    source: str = Field(default="all", description="Sumber kandidat: 'talent_pool', 'database', atau 'all'")
    client_user_name: Optional[str] = Field(default=None, description="Nama PIC User dari sisi client")


class RecommendCandidateItem(BaseModel):
    """Item kandidat rekomendasi."""
    candidate_id: AutoStrUUID
    full_name: str
    skills: list[str] = Field(default_factory=list)
    experience_years: float
    expected_salary: Optional[Decimal] = None
    domicile: Optional[str] = None
    pool_status: str
    ai_score: Optional[int] = None
    ai_notes: Optional[str] = None


class RecommendCandidatesResponse(BaseModel):
    """Response untuk AI Sourcing & Matching."""
    position_id: AutoStrUUID
    candidates: list[RecommendCandidateItem]
    message: str


# ── Extract Criteria (AI) ───────────────────────────────────────────────────

class ExtractCriteriaRequest(BaseModel):
    """Request ekstraksi kriteria posisi dari teks deskripsi lowongan."""

    text: str = Field(min_length=20, description="Teks requirement / job description posisi")


class ExtractCriteriaResponse(BaseModel):
    """Hasil ekstraksi kriteria posisi."""

    salary_budget: Decimal | None = None
    location: str | None = None
    required_skills: list[str] = Field(default_factory=list)
    min_experience_years: int | None = None
    message: str

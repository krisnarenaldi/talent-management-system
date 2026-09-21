from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

from app.core.pydantic_utils import AutoStrUUID


class StageHistoryCreate(BaseModel):
    stage_name: str                              # nama tahapan tujuan
    scheduled_date: date | None = None
    result: str | None = None                    # pass/fail/lolos/negosiasi/reschedule/lanjut
    salary_current_input: Decimal | None = None
    salary_expected_input: Decimal | None = None
    notes: str | None = None


class StageHistoryResponse(BaseModel):
    id: AutoStrUUID
    application_id: AutoStrUUID
    stage_name: str
    scheduled_date: date | None
    actual_date: date | None
    result: str | None
    salary_current_input: Decimal | None
    salary_expected_input: Decimal | None
    notes: str | None
    updated_by: AutoStrUUID | None
    handler_id: AutoStrUUID | None = None
    handler_name: str | None = None
    created_at: datetime | None

    @field_validator("created_at", mode="before")
    @classmethod
    def normalize_created_at(cls, value):
        if value in (None, ""):
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")) if isinstance(value, str) else value
        except (TypeError, ValueError):
            return None

    class Config:
        from_attributes = True


class ApplicationCreate(BaseModel):
    candidate_id: str
    position_id: str
    recruiter_id: str | None = None
    current_stage: str = "Dijadwalkan_Interview"
    force_blacklisted: bool = False


class ApplicationUpdate(BaseModel):
    recruiter_id: str | None = None
    cv_submitted_to_pm_date: date | None = None


class AIScreeningInfo(BaseModel):
    ai_score: float | None = None
    ai_screening_status: str | None = None

    class Config:
        from_attributes = True


class ApplicationResponse(BaseModel):
    id: AutoStrUUID
    candidate_id: AutoStrUUID
    candidate_name: str | None
    position_id: AutoStrUUID
    position_title: str | None
    client_name: str | None
    recruiter_id: AutoStrUUID | None
    recruiter_name: str | None
    current_stage: str
    status: str
    last_result: str | None = None
    cv_submitted_to_pm_date: date | None
    created_at: datetime | None
    updated_at: datetime | None
    ai_score: float | None = None
    ai_screening_status: str | None = None
    ai_screening: AIScreeningInfo | None = None

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def normalize_datetime(cls, value):
        if value in (None, ""):
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")) if isinstance(value, str) else value
        except (TypeError, ValueError):
            return None

    class Config:
        from_attributes = True


class ApplicationStageDetail(ApplicationResponse):
    stage_history: list[StageHistoryResponse]
    next_possible_stages: list[str]


class ApplicationCVItem(BaseModel):
    filename: str
    content: bytes = Field(..., min_length=1)

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, v: str) -> str:
        if not v.lower().endswith(".pdf"):
            raise ValueError("Hanya file PDF yang diizinkan")
        return v


class ApplicationBulkUploadResponse(BaseModel):
    position_id: AutoStrUUID
    position_title: str
    client_name: str | None
    total_files: int
    created_screening_result_ids: list[AutoStrUUID]
    # Legacy field — dipertahankan untuk kompatibilitas response frontend
    # Setelah migrasi ke arq, nilai selalu False (trigger via Redis, bukan HTTP n8n)
    n8n_triggered: bool = False

    class Config:
        from_attributes = True

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

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
    updated_by: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ApplicationCreate(BaseModel):
    candidate_id: str
    position_id: str
    recruiter_id: str | None = None
    current_stage: str = "Dijadwalkan_Interview"


class ApplicationUpdate(BaseModel):
    recruiter_id: str | None = None
    cv_submitted_to_pm_date: date | None = None


class ApplicationResponse(BaseModel):
    id: AutoStrUUID
    candidate_id: AutoStrUUID
    candidate_name: str
    position_id: AutoStrUUID
    position_title: str
    client_name: str
    recruiter_id: str | None
    recruiter_name: str | None
    current_stage: str
    status: str
    cv_submitted_to_pm_date: date | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApplicationStageDetail(ApplicationResponse):
    stage_history: list[StageHistoryResponse]
    next_possible_stages: list[str]

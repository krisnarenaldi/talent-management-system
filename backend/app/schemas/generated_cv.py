"""
schemas/generated_cv.py — Pydantic schemas untuk TASK-10 Generate CV Standar
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.core.pydantic_utils import AutoStrUUID


# ── Request schemas ───────────────────────────────────────────────────────────

class CVGenerateRequest(BaseModel):
    """Body untuk POST /api/v1/applications/{id}/cv/generate"""

    language: Literal["ID", "EN"] = Field(
        default="ID",
        description="Bahasa summary CV: 'ID' (Indonesia) atau 'EN' (English)",
    )
    summary_text: Optional[str] = Field(
        default=None,
        description=(
            "Isi summary yang ditulis manual oleh HR. "
            "Jika diisi, summary_source otomatis menjadi 'HR' dan LLM tidak dipanggil."
        ),
    )
    force_regenerate: bool = Field(
        default=False,
        description=(
            "Paksa generate ulang meskipun CV masih fresh (tidak stale). "
            "Berguna saat HR ingin refresh summary atau template."
        ),
    )


# ── Response schemas ──────────────────────────────────────────────────────────

class CVResponse(BaseModel):
    """
    Representasi satu record GeneratedCV yang dikembalikan ke frontend.
    Semua UUID di-coerce ke string oleh AutoStrUUID.
    """

    id: AutoStrUUID
    candidate_id: AutoStrUUID
    application_id: Optional[AutoStrUUID] = None
    template_used: Optional[str] = None
    language: Optional[str] = None
    summary_source: Optional[str] = None   # "AI" | "HR"
    summary_text: Optional[str] = None
    file_url: Optional[str] = None
    drive_item_id: Optional[str] = None
    generated_at: datetime
    is_stale: bool = Field(
        default=False,
        description="True jika data kandidat sudah diupdate setelah CV ini digenerate.",
    )

    class Config:
        from_attributes = True


class CVGenerateResponse(CVResponse):
    """
    Response untuk POST generate — identik dengan CVResponse,
    tapi menyertakan field tambahan untuk informasi proses.
    """

    was_cached: bool = Field(
        default=False,
        description="True jika CV dikembalikan dari cache (tidak di-regenerate).",
    )
    message: str = Field(default="CV berhasil digenerate.")

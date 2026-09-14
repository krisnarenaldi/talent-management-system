"""
routers/ai_search.py — TASK-14: Natural Language Search
POST /api/v1/ai/search/  (Manager only)

Rate limit: 10 requests / minute per user (in-memory, resets on restart).
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_role
from app.models.user import User
from app.schemas.candidate import CandidateResponse
from app.services.ai_service import execute_structured_filters, translate_nl_to_filters

router = APIRouter()

# ── #8: Simple in-memory rate limiter ────────────────────────────────────────
# Stores timestamps of requests per user id.
_rate_lock = Lock()
_rate_store: dict[str, deque[float]] = defaultdict(deque)
_RATE_LIMIT = 10       # max requests
_RATE_WINDOW = 60.0    # seconds


def _check_rate_limit(user_id: str) -> None:
    """Raise HTTP 429 if user has exceeded the rate limit."""
    now = time.monotonic()
    with _rate_lock:
        dq = _rate_store[user_id]
        # evict timestamps outside the window
        while dq and dq[0] < now - _RATE_WINDOW:
            dq.popleft()
        if len(dq) >= _RATE_LIMIT:
            retry_after = int(_RATE_WINDOW - (now - dq[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Terlalu banyak permintaan. Anda dapat mencoba lagi dalam "
                    f"{retry_after} detik."
                ),
                headers={"Retry-After": str(retry_after)},
            )
        dq.append(now)


# ── Request / Response schemas ───────────────────────────────────────────────

class NLSearchRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500, description="Pertanyaan bahasa alami")


class NLSearchResponse(BaseModel):
    query: str
    filters_applied: dict
    description: str
    results: list[CandidateResponse]
    results_count: int   # jumlah hasil yang dikembalikan (≤ 100)
    has_more: bool       # True jika total match > 100


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=NLSearchResponse,
    summary="Cari kandidat dengan bahasa alami (Manager only)",
)
def natural_language_search(
    body: NLSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager")),
):
    """
    Terima query bahasa alami → terjemahkan ke filter via OpenAI →
    eksekusi filter ke database → return hasil kandidat.

    Hanya bisa diakses oleh role **manager**.
    Query di luar scope talent management ditolak dengan 422.
    Rate limit: 10 request / menit per user.
    """
    # ── Rate limit ───────────────────────────────────────────────────────────
    _check_rate_limit(str(current_user.id))

    result = translate_nl_to_filters(body.query)

    # ── Guard: out of scope ──────────────────────────────────────────────────
    if result.get("error") == "out_of_scope":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Pertanyaan Anda tidak berkaitan dengan pencarian kandidat. "
                "Saya hanya dapat membantu mencari kandidat berdasarkan skill, "
                "pengalaman, pendidikan, domisili, gaji, dan atribut rekrutmen lainnya."
            ),
        )

    # ── Guard: LLM tidak tersedia ────────────────────────────────────────────
    if result.get("error") == "llm_unavailable":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result.get("detail", "Layanan AI tidak tersedia saat ini."),
        )

    filters: dict = result.get("filters", {})
    description: str = result.get("description", "")

    candidates, total_count = execute_structured_filters(filters, db)

    return NLSearchResponse(
        query=body.query,
        filters_applied=filters,
        description=description,
        results=[CandidateResponse.model_validate(c) for c in candidates],
        results_count=len(candidates),
        has_more=total_count > 100,
    )

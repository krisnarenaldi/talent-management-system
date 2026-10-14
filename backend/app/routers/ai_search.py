"""
routers/ai_search.py — TASK-14: Natural Language Search
POST /api/v1/ai/search/  (Manager only)
GET  /api/v1/ai/usage    (Manager / Admin)

Rate limit: 10 requests / minute per user (in-memory, resets on restart).

Budget alerts: notifikasi dikirim ke semua manager+admin saat estimasi biaya
menyentuh 75% dan 90% dari OPENAI_BUDGET_USD. Maksimal 1 notifikasi per level
per hari agar tidak spam.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from datetime import date, datetime, timezone
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_db, get_current_user, require_role
from app.models.notification import Notification
from app.models.openai_usage_log import OpenAIUsageLog
from app.models.user import User
from app.schemas.candidate import CandidateResponse
from app.schemas.employee import EmployeeSearchResponse
from app.services.ai_service import execute_employee_filters, execute_structured_filters, translate_nl_to_filters

router = APIRouter()

# ── In-memory rate limiter ────────────────────────────────────────────────────
_rate_lock = Lock()
_rate_store: dict[str, deque[float]] = defaultdict(deque)
_RATE_LIMIT = 10       # max requests
_RATE_WINDOW = 60.0    # seconds


def _check_rate_limit(user_id: str) -> None:
    """Raise HTTP 429 jika user melampaui rate limit."""
    now = time.monotonic()
    with _rate_lock:
        dq = _rate_store[user_id]
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


# ── Pricing constants (USD per 1M tokens, GPT-4o mini) ───────────────────────
# https://openai.com/api/pricing — update jika model/harga berubah
_PRICE_INPUT_PER_M  = 0.150   # $0.150 / 1M input tokens
_PRICE_OUTPUT_PER_M = 0.600   # $0.600 / 1M output tokens

# Budget threshold — bisa override lewat env jika perlu (hardcode cukup untuk sekarang)
_BUDGET_USD = 20.0

# Threshold levels: (fraction, label_for_dedup)
_ALERT_LEVELS = [
    (0.90, "90pct"),
    (0.75, "75pct"),
]


def _estimate_cost_usd(prompt_tokens: int, completion_tokens: int) -> float:
    return (
        prompt_tokens    / 1_000_000 * _PRICE_INPUT_PER_M
        + completion_tokens / 1_000_000 * _PRICE_OUTPUT_PER_M
    )


# ── Budget alert logic ────────────────────────────────────────────────────────

def _maybe_send_budget_alerts(db: Session) -> None:
    """
    Hitung total estimasi biaya all-time. Jika menyentuh threshold (75% / 90%),
    kirim notifikasi ke semua manager+admin — maksimal 1x per threshold per hari.
    """
    # Agregasi total token all-time
    row = db.query(
        func.coalesce(func.sum(OpenAIUsageLog.prompt_tokens), 0),
        func.coalesce(func.sum(OpenAIUsageLog.completion_tokens), 0),
    ).one()
    total_prompt, total_completion = int(row[0]), int(row[1])
    total_cost = _estimate_cost_usd(total_prompt, total_completion)

    pct = total_cost / _BUDGET_USD if _BUDGET_USD > 0 else 0.0

    for threshold, level_key in _ALERT_LEVELS:
        if pct < threshold:
            continue

        # Cek apakah notifikasi untuk level ini sudah dikirim hari ini
        today_start = datetime.combine(date.today(), datetime.min.time()).replace(
            tzinfo=timezone.utc
        )
        notif_type = f"openai_budget_{level_key}"
        already_sent = (
            db.query(Notification)
            .filter(
                Notification.type == notif_type,
                Notification.created_at >= today_start,
            )
            .first()
        )
        if already_sent:
            break  # level yang lebih tinggi sudah ditangani, tidak perlu cek level bawah

        # Ambil semua manager dan admin aktif
        recipients = (
            db.query(User)
            .filter(User.role.in_(["manager", "admin"]), User.is_active == True)  # noqa: E712
            .all()
        )

        pct_display = int(threshold * 100)
        cost_display = f"${total_cost:.2f}"
        budget_display = f"${_BUDGET_USD:.0f}"
        message = (
            f"⚠️ Penggunaan OpenAI telah mencapai {pct_display}% dari budget "
            f"({cost_display} dari {budget_display}). Segera top up kredit OpenAI."
        )

        for user in recipients:
            db.add(Notification(
                user_id=user.id,
                type=notif_type,
                message=message,
                link="/search",
            ))

        db.commit()
        break  # hanya kirim 1 level per request (level tertinggi yang terlampaui)


# ── Request / Response schemas ────────────────────────────────────────────────

class NLSearchRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500, description="Pertanyaan bahasa alami")


class NLSearchResponse(BaseModel):
    query: str
    filters_applied: dict
    description: str
    results: list[CandidateResponse]
    results_count: int          # jumlah kandidat yang dikembalikan (≤ 100)
    has_more: bool              # True jika total kandidat match > 100
    employee_results: list[EmployeeSearchResponse] = []
    employee_results_count: int = 0
    employee_has_more: bool = False


class AIUsageResponse(BaseModel):
    # Token bulan ini
    month_prompt_tokens: int
    month_completion_tokens: int
    month_total_tokens: int
    month_cost_usd: float

    # Token all-time
    total_prompt_tokens: int
    total_completion_tokens: int
    total_total_tokens: int
    total_cost_usd: float

    # Budget info
    budget_usd: float
    budget_used_pct: float   # 0–100


# ── Endpoint: Natural Language Search ────────────────────────────────────────

@router.post(
    "",
    response_model=NLSearchResponse,
    summary="Cari kandidat dengan bahasa alami (Manager only)",
)
def natural_language_search(
    body: NLSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    """
    Terima query bahasa alami → terjemahkan ke filter via OpenAI →
    eksekusi filter ke database → return hasil kandidat.

    Bisa diakses oleh role **manager** dan **admin**.
    Query di luar scope talent management ditolak dengan 422.
    Rate limit: 10 request / menit per user.
    """
    _check_rate_limit(str(current_user.id))

    result = translate_nl_to_filters(body.query)

    # ── Catat token usage (termasuk saat out_of_scope) ───────────────────────
    token_usage: dict = result.get("token_usage") or {}
    if token_usage.get("prompt_tokens") or token_usage.get("completion_tokens"):
        db.add(OpenAIUsageLog(
            prompt_tokens=token_usage.get("prompt_tokens", 0),
            completion_tokens=token_usage.get("completion_tokens", 0),
            model=token_usage.get("model", settings.OPENAI_MODEL),
            user_id=current_user.id,
            call_type="nl_search",
        ))
        db.commit()

        # Cek budget alert setelah log tersimpan
        try:
            _maybe_send_budget_alerts(db)
        except Exception:
            pass  # jangan gagalkan request hanya karena notifikasi gagal

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
    employees, emp_total_count = execute_employee_filters(filters, db)

    # Map employee.candidate.skills ke EmployeeSearchResponse
    def _map_employee(emp) -> EmployeeSearchResponse:
        skills = emp.candidate.skills if emp.candidate else None
        data = EmployeeSearchResponse.model_validate(emp)
        data.skills = skills
        return data

    return NLSearchResponse(
        query=body.query,
        filters_applied=filters,
        description=description,
        results=[CandidateResponse.model_validate(c) for c in candidates],
        results_count=len(candidates),
        has_more=total_count > 100,
        employee_results=[_map_employee(e) for e in employees],
        employee_results_count=len(employees),
        employee_has_more=emp_total_count > 100,
    )


# ── Endpoint: Usage stats ─────────────────────────────────────────────────────

@router.get(
    "/usage",
    response_model=AIUsageResponse,
    summary="Statistik penggunaan token OpenAI (Manager / Admin)",
)
def get_ai_usage(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("manager", "admin")),
):
    """
    Mengembalikan agregasi token bulan ini dan all-time beserta estimasi biaya USD.
    Hanya bisa diakses oleh role **manager** dan **admin**.
    """
    # Batas awal bulan berjalan (UTC)
    now_utc = datetime.now(timezone.utc)
    month_start = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    def _agg(query_filter=None):
        q = db.query(
            func.coalesce(func.sum(OpenAIUsageLog.prompt_tokens), 0),
            func.coalesce(func.sum(OpenAIUsageLog.completion_tokens), 0),
        )
        if query_filter is not None:
            q = q.filter(query_filter)
        row = q.one()
        return int(row[0]), int(row[1])

    m_prompt, m_completion = _agg(OpenAIUsageLog.created_at >= month_start)
    t_prompt, t_completion = _agg()

    m_cost = _estimate_cost_usd(m_prompt, m_completion)
    t_cost = _estimate_cost_usd(t_prompt, t_completion)

    return AIUsageResponse(
        month_prompt_tokens=m_prompt,
        month_completion_tokens=m_completion,
        month_total_tokens=m_prompt + m_completion,
        month_cost_usd=round(m_cost, 6),
        total_prompt_tokens=t_prompt,
        total_completion_tokens=t_completion,
        total_total_tokens=t_prompt + t_completion,
        total_cost_usd=round(t_cost, 6),
        budget_usd=_BUDGET_USD,
        budget_used_pct=round(min(t_cost / _BUDGET_USD * 100, 100), 2) if _BUDGET_USD > 0 else 0.0,
    )

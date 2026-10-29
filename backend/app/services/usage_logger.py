"""
usage_logger.py — Helper untuk mencatat token usage OpenAI ke openai_usage_log.

Dipakai oleh semua service/router yang memanggil OpenAI agar usage terpusat.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def log_openai_usage(
    db: Any,
    *,
    prompt_tokens: int,
    completion_tokens: int,
    model: str,
    call_type: str,
    user_id: Any = None,
) -> None:
    """
    Catat penggunaan token OpenAI ke tabel openai_usage_log.
    Silent on error — jangan gagalkan proses utama hanya karena logging gagal.
    """
    if not prompt_tokens and not completion_tokens:
        return
    try:
        from app.models.openai_usage_log import OpenAIUsageLog
        db.add(OpenAIUsageLog(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            model=model,
            call_type=call_type,
            user_id=user_id,
        ))
        db.commit()
    except Exception:
        logger.warning("Gagal mencatat openai_usage_log (call_type=%s)", call_type, exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass

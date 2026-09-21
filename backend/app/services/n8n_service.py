"""
Trigger n8n workflows via webhook.
FastAPI → n8n: kirim payload, n8n kerjakan secara async, lalu callback ke /internal/*
"""

import asyncio
import logging
import uuid as _uuid

import httpx

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.application import AIScreeningResult

logger = logging.getLogger(__name__)

_MAX_RETRIES = 3
_RETRY_BACKOFF_BASE = 1.0


def _update_screening_status_error(screening_result_id: str, error_message: str) -> None:
    """
    Update status AIScreeningResult menjadi 'error' dan simpan pesan error ke ai_notes.
    Dipanggil saat trigger n8n gagal permanen (setelah semua retry habis).
    """
    try:
        db = SessionLocal()
        try:
            screening = (
                db.query(AIScreeningResult)
                .filter(AIScreeningResult.id == _uuid.UUID(screening_result_id))
                .first()
            )
            if screening:
                screening.status = "error"
                existing_notes = screening.ai_notes or ""
                prefix = "[TRIGGER n8n GAGAL] "
                if not existing_notes.startswith(prefix):
                    screening.ai_notes = prefix + error_message
                db.commit()
                logger.info(
                    "Status screening_id=%s diupdate menjadi 'error' karena trigger n8n gagal.",
                    screening_result_id,
                )
        finally:
            db.close()
    except Exception as exc:
        logger.error(
            "Gagal update status error screening_id=%s: %s",
            screening_result_id,
            exc,
        )


async def trigger_cv_parse(
    screening_result_id: str,
    drive_item_id: str,
    position_id: str,
    uploaded_by: str,
    source_channel: str = "",
) -> None:
    """
    Trigger n8n workflow CV Parser setelah CV diupload.
    n8n akan: download CV → ekstrak teks → kirim ke LLM → callback ke FastAPI.

    Catatan keamanan:
    - ai_scoring_config TIDAK dikirim dalam payload — n8n mengambilnya langsung dari
      FastAPI DB via GET /internal/scoring-config/{position_id} menggunakan X-Internal-Secret.
      Ini mencegah manipulasi scoring config dari luar melalui webhook body.
    - X-Webhook-Secret header dikirim agar n8n bisa memverifikasi bahwa request berasal
      dari sistem internal, bukan dari pihak luar yang menebak URL webhook.
    """
    if not settings.N8N_WEBHOOK_CV_PARSER:
        logger.warning(
            "N8N_WEBHOOK_CV_PARSER tidak dikonfigurasi — trigger diabaikan untuk screening %s",
            screening_result_id,
        )
        _update_screening_status_error(
            screening_result_id,
            "N8N_WEBHOOK_CV_PARSER tidak dikonfigurasi di environment variables.",
        )
        return

    headers: dict[str, str] = {}
    if settings.N8N_WEBHOOK_SECRET:
        headers["X-Webhook-Secret"] = settings.N8N_WEBHOOK_SECRET

    payload = {
        "screening_result_id": screening_result_id,
        "drive_item_id": drive_item_id,
        "position_id": position_id,
        "uploaded_by": uploaded_by,
        "source_channel": source_channel,
    }

    last_error: str | None = None

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    settings.N8N_WEBHOOK_CV_PARSER,
                    json=payload,
                    headers=headers,
                    timeout=15,
                )
            if resp.status_code >= 400:
                last_error = (
                    f"n8n mengembalikan HTTP {resp.status_code}: {resp.text[:300]}"
                )
                logger.error(
                    "Attempt %d/%d — n8n webhook error HTTP %s screening_id=%s: %s",
                    attempt, _MAX_RETRIES, resp.status_code,
                    screening_result_id, resp.text[:300],
                )
            else:
                logger.info(
                    "n8n CV parser triggered successfully screening_id=%s (attempt %d)",
                    screening_result_id, attempt,
                )
                return  # Sukses — keluar dari loop
        except httpx.TimeoutException:
            last_error = (
                f"Timeout menunggu n8n (>15s). URL={settings.N8N_WEBHOOK_CV_PARSER}. "
                "Pastikan container n8n berjalan dan endpoint /webhook/cv-parser "
                "telah dibuat di workflow n8n."
            )
            logger.error(
                "Attempt %d/%d — Timeout trigger n8n screening_id=%s. URL=%s",
                attempt, _MAX_RETRIES, screening_result_id,
                settings.N8N_WEBHOOK_CV_PARSER,
            )
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            logger.error(
                "Attempt %d/%d — Gagal trigger n8n screening_id=%s: %s",
                attempt, _MAX_RETRIES, screening_result_id, exc,
            )

        # Jika masih ada retry tersisa, tunggu sebelum coba lagi
        if attempt < _MAX_RETRIES:
            wait_s = _RETRY_BACKOFF_BASE * (2 ** (attempt - 1))  # 1s, 2s, 4s
            logger.info(
                "Menunggu %.1fs sebelum retry attempt %d untuk screening_id=%s",
                wait_s, attempt + 1, screening_result_id,
            )
            await asyncio.sleep(wait_s)

    # Semua retry habis — update status jadi error
    logger.critical(
        "Semua %d retry trigger n8n gagal untuk screening_id=%s. Final error: %s",
        _MAX_RETRIES, screening_result_id, last_error,
    )
    _update_screening_status_error(screening_result_id, last_error or "Unknown error")


async def trigger_ai_screening(application_id: str) -> None:
    """
    Trigger n8n workflow AI Screening setelah Application dibuat.
    n8n akan: ambil data kandidat + posisi → scoring LLM → callback ke FastAPI
    TODO: TASK-12
    """
    if not settings.N8N_WEBHOOK_AI_SCREENING:
        logger.warning("N8N_WEBHOOK_AI_SCREENING tidak dikonfigurasi — diabaikan application_id=%s", application_id)
        return

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                settings.N8N_WEBHOOK_AI_SCREENING,
                json={"application_id": application_id},
                timeout=15,
            )
        if resp.status_code >= 400:
            logger.error(
                "n8n AI screening webhook error HTTP %s application_id=%s: %s",
                resp.status_code, application_id, resp.text[:300],
            )
    except httpx.TimeoutException:
        logger.error(
            "Timeout trigger n8n AI screening application_id=%s. URL=%s",
            application_id, settings.N8N_WEBHOOK_AI_SCREENING,
        )
    except Exception as exc:
        logger.error(
            "Gagal trigger n8n AI screening application_id=%s: %s",
            application_id, exc,
        )

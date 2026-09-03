"""
Trigger n8n workflows via webhook.
FastAPI → n8n: kirim payload, n8n kerjakan secara async, lalu callback ke /internal/*
"""
import httpx

from app.core.config import settings


async def trigger_cv_parser(candidate_id: str, drive_item_id: str, doc_id: str) -> None:
    """
    Trigger n8n workflow CV Parser setelah CV diupload.
    n8n akan: download CV → ekstrak teks → kirim ke LLM → callback ke FastAPI
    TODO: TASK-11
    """
    if not settings.N8N_WEBHOOK_CV_PARSER:
        return  # n8n belum dikonfigurasi (Fase 1)

    async with httpx.AsyncClient() as client:
        await client.post(
            settings.N8N_WEBHOOK_CV_PARSER,
            json={
                "candidate_id": candidate_id,
                "drive_item_id": drive_item_id,
                "doc_id": doc_id,
            },
            timeout=10,
        )


async def trigger_ai_screening(application_id: str) -> None:
    """
    Trigger n8n workflow AI Screening setelah Application dibuat.
    n8n akan: ambil data kandidat + posisi → scoring LLM → callback ke FastAPI
    TODO: TASK-12
    """
    if not settings.N8N_WEBHOOK_AI_SCREENING:
        return

    async with httpx.AsyncClient() as client:
        await client.post(
            settings.N8N_WEBHOOK_AI_SCREENING,
            json={"application_id": application_id},
            timeout=10,
        )

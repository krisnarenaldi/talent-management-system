"""
Endpoint internal — hanya dipanggil oleh n8n (callback setelah async processing).
Diproteksi dengan X-Internal-Secret header.
Nginx memblokir akses ke /api/v1/internal/* dari internet.
"""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, verify_internal_secret
from app.models.application import AIScreeningResult
from app.models.notification import Notification
from app.models.position import Position
from app.services.cv_parser_service import download_cv_bytes_from_drive, extract_pdf_text

router = APIRouter()


# ── SEC-03: Pydantic schema untuk /parse-cv ───────────────────────────────────

class ParseCVPayload(BaseModel):
    drive_item_id: str = Field(..., min_length=1, max_length=500)


@router.post("/parse-cv")
async def parse_cv(
    payload: ParseCVPayload,
    _: None = Depends(verify_internal_secret),
):
    """
    n8n → FastAPI: extract teks dari CV PDF.
    Payload: { drive_item_id }
    Returns: { text: str }
    """
    try:
        file_bytes = await download_cv_bytes_from_drive(payload.drive_item_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal unduh file dari OneDrive: {e}")

    try:
        text = extract_pdf_text(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal parse PDF: {e}")

    return {"text": text}


# ── SEC-02 + SEC-05: Pydantic schema untuk /ai/extraction-result ─────────────

class ExtractionResultPayload(BaseModel):
    screening_result_id: str = Field(..., min_length=1)
    extracted_json: dict | None = None
    # SEC-05: ai_score divalidasi range 0-100 di layer Pydantic
    ai_score: float | None = Field(None, ge=0.0, le=100.0)
    ai_notes: str | None = None
    # SEC-02: status hanya boleh nilai yang dikenal — tidak bisa diisi arbitrary string
    status: Literal["siap_review", "error"]


@router.post("/ai/extraction-result")
def receive_extraction_result(
    payload: ExtractionResultPayload,
    db: Session = Depends(get_db),
    _=Depends(verify_internal_secret),
):
    """
    n8n → FastAPI: kirim hasil ekstraksi CV oleh AI.
    """
    screening = db.query(AIScreeningResult).filter(AIScreeningResult.id == payload.screening_result_id).first()
    if not screening:
        raise HTTPException(status_code=404, detail="Screening result tidak ditemukan")

    # Update fields
    screening.extracted_json = payload.extracted_json
    # SEC-05: clamp ai_score 0–100 sebagai defense-in-depth (sudah divalidasi Pydantic di atas)
    if payload.ai_score is not None:
        screening.ai_score = max(0.0, min(100.0, payload.ai_score))
    else:
        screening.ai_score = None
    screening.ai_notes = payload.ai_notes
    screening.status = payload.status

    # Jika status jadi siap_review: buat notif untuk uploader
    if payload.status == "siap_review" and screening.uploaded_by:
        notif = Notification(
            user_id=screening.uploaded_by,
            type="ai_screening_done",
            message="CV berhasil diproses AI dan siap untuk review.",
            link="/applications/pending-review",
        )
        db.add(notif)

    db.commit()
    return {"message": "OK"}


@router.post("/ai/screening-result")
def receive_screening_result(payload: dict):
    """
    n8n → FastAPI: kirim hasil AI scoring/matching kandidat.
    Payload: { application_id, match_score, ai_notes, model_used }
    TODO: TASK-12
    """
    return {"message": "TODO: simpan hasil AI screening"}


@router.get("/scoring-config/{position_id}")
def get_scoring_config(
    position_id: str,
    db: Session = Depends(get_db),
    _=Depends(verify_internal_secret),
):
    """
    n8n → FastAPI: ambil ai_scoring_config untuk suatu posisi dari DB.
    Dipanggil oleh workflow cv-parser.json (Step 1c) agar scoring config
    tidak bisa dimanipulasi melalui webhook body dari luar.
    Returns: { ai_scoring_config: dict | null }
    """
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Posisi tidak ditemukan")

    return {"ai_scoring_config": position.ai_scoring_config or {}}


@router.post("/contract-expiry-check")
def contract_expiry_check():
    """
    n8n cron → FastAPI: trigger pengecekan kontrak yang hampir habis.
    TODO: TASK-16
    """
    return {"message": "TODO: cek kontrak hampir habis"}

"""
Endpoint internal — hanya dipanggil oleh n8n (callback setelah async processing).
Diproteksi dengan X-Internal-Secret header.
Nginx memblokir akses ke /api/v1/internal/* dari internet.
"""
from fastapi import APIRouter, Depends

from app.core.dependencies import verify_internal_secret

router = APIRouter()


@router.post("/ai/extraction-result", dependencies=[Depends(verify_internal_secret)])
def receive_extraction_result(payload: dict):
    """
    n8n → FastAPI: kirim hasil ekstraksi CV oleh AI.
    Payload: { candidate_id, extracted_fields, model_used, application_id? }
    TODO: TASK-11
    """
    return {"message": "TODO: simpan hasil ekstraksi AI"}


@router.post("/ai/screening-result", dependencies=[Depends(verify_internal_secret)])
def receive_screening_result(payload: dict):
    """
    n8n → FastAPI: kirim hasil AI scoring/matching kandidat.
    Payload: { application_id, match_score, ai_notes, model_used }
    TODO: TASK-12
    """
    return {"message": "TODO: simpan hasil AI screening"}


@router.post("/contract-expiry-check", dependencies=[Depends(verify_internal_secret)])
def contract_expiry_check():
    """
    n8n cron → FastAPI: trigger pengecekan kontrak yang hampir habis.
    TODO: TASK-16
    """
    return {"message": "TODO: cek kontrak hampir habis"}

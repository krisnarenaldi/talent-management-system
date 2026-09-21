"""
routers/generated_cv.py — TASK-10: Generate CV Standar Altek
=============================================================

Endpoints:
  POST /api/v1/applications/{application_id}/cv/generate
      → Generate (atau kembalikan cache) CV standar untuk satu lamaran.

  GET  /api/v1/applications/{application_id}/cv/
      → List semua CV yang pernah digenerate untuk lamaran ini.

  POST /api/v1/candidates/{candidate_id}/cv/generate
      → Generate CV standalone (tanpa application context).

  GET  /api/v1/candidates/{candidate_id}/cv/
      → List semua CV kandidat lintas lamaran.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user, require_role
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.generated_cv import GeneratedCV
from app.models.position import Position
from app.schemas.generated_cv import CVGenerateRequest, CVGenerateResponse, CVResponse
from app.services import cv_generator_service
from app.services.cv_generator_service import _is_stale

logger = logging.getLogger(__name__)

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _cv_to_response(cv: GeneratedCV, candidate: Candidate) -> CVResponse:
    """Convert ORM → CVResponse, including computed is_stale."""
    data = CVResponse.model_validate(cv)
    data.is_stale = _is_stale(candidate, cv)
    return data


# ─────────────────────────────────────────────────────────────────────────────
# Application-scoped endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/applications/{application_id}/cv/generate",
    response_model=CVGenerateResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate CV standar untuk satu lamaran",
    tags=["CV"],
)
async def generate_cv_for_application(
    application_id: str,
    payload: CVGenerateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Generate CV standar Altek untuk kandidat yang terhubung ke lamaran ini.

    - Jika CV sudah ada dan masih fresh (tidak stale) → dikembalikan langsung (cache hit).
    - Jika stale atau belum pernah digenerate → generate ulang.
    - `force_regenerate=true` memaksa generate ulang tanpa cek staleness.
    - Jika `summary_text` diisi → disimpan sebagai summary HR (tidak di-overwrite oleh AI).
    """
    application_id = application_id.strip()

    # 1. Validasi application
    application = (
        db.query(Application)
        .filter(Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Lamaran tidak ditemukan")

    # 2. Validasi kandidat
    candidate = (
        db.query(Candidate)
        .filter(Candidate.id == application.candidate_id, Candidate.is_deleted == False)
        .first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan atau sudah dihapus")

    # 3. Ambil position title untuk cover page
    position_title: str | None = None
    if application.position_id:
        pos = db.query(Position).filter(Position.id == application.position_id).first()
        if pos:
            position_title = pos.title

    # 4. Cek apakah CV sudah ada dan fresh (sebelum memanggil async generate)
    existing_cv = (
        db.query(GeneratedCV)
        .filter(
            GeneratedCV.candidate_id == application.candidate_id,
            GeneratedCV.language == payload.language.upper(),
        )
        .order_by(GeneratedCV.generated_at.desc())
        .first()
    )
    is_fresh = (
        not payload.force_regenerate
        and not payload.summary_text  # jika ada summary baru, tetap regenerate
        and not _is_stale(candidate, existing_cv)
    )

    if is_fresh and existing_cv:
        logger.info("CV kandidat %s (%s) fresh — returning cache", candidate.id, payload.language)
        resp = CVGenerateResponse.model_validate(existing_cv)
        resp.is_stale = False
        resp.was_cached = True
        resp.message = "CV dikembalikan dari cache (data kandidat belum berubah)."
        return resp

    # 5. Generate
    try:
        cv = await cv_generator_service.generate_cv(
            db=db,
            candidate_id=str(application.candidate_id),
            application_id=application_id,
            language=payload.language,
            summary_text=payload.summary_text,
            position_title=position_title,
            force_regenerate=payload.force_regenerate,
        )
        db.commit()
        db.refresh(cv)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        db.rollback()
        logger.exception("Error saat generate CV untuk application %s: %s", application_id, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Gagal generate CV: {exc}",
        )

    resp = CVGenerateResponse.model_validate(cv)
    resp.is_stale = False
    resp.was_cached = False
    resp.message = "CV berhasil digenerate."
    return resp


@router.get(
    "/applications/{application_id}/cv/",
    response_model=list[CVResponse],
    summary="List CV yang sudah digenerate untuk satu lamaran",
    tags=["CV"],
)
def list_cvs_for_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Kembalikan semua record GeneratedCV yang terhubung ke lamaran ini,
    diurutkan dari yang paling baru.
    """
    application_id = application_id.strip()

    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Lamaran tidak ditemukan")

    candidate = db.query(Candidate).filter(Candidate.id == application.candidate_id).first()

    cvs = (
        db.query(GeneratedCV)
        .filter(GeneratedCV.candidate_id == application.candidate_id)
        .order_by(GeneratedCV.generated_at.desc())
        .all()
    )

    return [_cv_to_response(cv, candidate) for cv in cvs] if candidate else []


# ─────────────────────────────────────────────────────────────────────────────
# Candidate-scoped endpoints (standalone — tanpa application context)
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/candidates/{candidate_id}/cv/generate",
    response_model=CVGenerateResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate CV standar untuk kandidat (tanpa context lamaran)",
    tags=["CV"],
)
async def generate_cv_for_candidate(
    candidate_id: str,
    payload: CVGenerateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Generate CV standalone — berguna saat kandidat belum punya lamaran aktif
    tapi HR butuh CV-nya (mis. untuk dikirim ke klien pre-aplikasi).
    """
    candidate_id = candidate_id.strip()

    candidate = (
        db.query(Candidate)
        .filter(Candidate.id == candidate_id, Candidate.is_deleted == False)
        .first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan atau sudah dihapus")

    existing_cv = (
        db.query(GeneratedCV)
        .filter(
            GeneratedCV.candidate_id == candidate_id,
            GeneratedCV.language == payload.language.upper(),
        )
        .order_by(GeneratedCV.generated_at.desc())
        .first()
    )
    is_fresh = (
        not payload.force_regenerate
        and not payload.summary_text
        and not _is_stale(candidate, existing_cv)
    )

    if is_fresh and existing_cv:
        resp = CVGenerateResponse.model_validate(existing_cv)
        resp.is_stale = False
        resp.was_cached = True
        resp.message = "CV dikembalikan dari cache (data kandidat belum berubah)."
        return resp

    try:
        cv = await cv_generator_service.generate_cv(
            db=db,
            candidate_id=candidate_id,
            application_id=None,
            language=payload.language,
            summary_text=payload.summary_text,
            position_title=None,
            force_regenerate=payload.force_regenerate,
        )
        db.commit()
        db.refresh(cv)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        db.rollback()
        logger.exception("Error saat generate CV untuk kandidat %s: %s", candidate_id, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Gagal generate CV: {exc}",
        )

    resp = CVGenerateResponse.model_validate(cv)
    resp.is_stale = False
    resp.was_cached = False
    resp.message = "CV berhasil digenerate."
    return resp


@router.get(
    "/candidates/{candidate_id}/cv/",
    response_model=list[CVResponse],
    summary="List semua CV kandidat (semua bahasa & lamaran)",
    tags=["CV"],
)
def list_cvs_for_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    candidate_id = candidate_id.strip()

    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")

    cvs = (
        db.query(GeneratedCV)
        .filter(GeneratedCV.candidate_id == candidate_id)
        .order_by(GeneratedCV.generated_at.desc())
        .all()
    )

    return [_cv_to_response(cv, candidate) for cv in cvs]

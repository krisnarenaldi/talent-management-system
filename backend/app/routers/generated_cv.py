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

import io
import logging
import re
import zipfile
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_db, get_current_user, require_role
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.generated_cv import GeneratedCV
from app.models.position import Position
from app.schemas.generated_cv import (
    CVBatchDownloadRequest,
    CVGenerateRequest,
    CVGenerateResponse,
    CVResponse,
)
from app.services import cv_generator_service
from app.services.cv_generator_service import _is_stale
from app.services.onedrive_service import onedrive_service
from app.services.storage_service import UPLOAD_ROOT

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

    return [_cv_to_response(cv, candidate) for cv in cvs]

    return [_cv_to_response(cv, candidate) for cv in cvs] if candidate else []


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


@router.post(
    "/applications/batch-cv-zip",
    summary="Download batch CV Standar Altek dalam bentuk ZIP",
    tags=["CV"],
)
async def batch_download_cv_zip(
    payload: CVBatchDownloadRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Download ZIP berisi CV standar Altek untuk daftar aplikasi yang dipilih.
    Jika kandidat belum memiliki CV standar atau sudah stale:
    sistem akan men-generate CV standar on-the-fly dengan data seadanya.
    Maksimal 50 aplikasi per batch request.
    """
    app_ids = [aid.strip() for aid in payload.application_ids if aid.strip()]
    if not app_ids:
        raise HTTPException(status_code=400, detail="Daftar application_ids tidak boleh kosong")

    if len(app_ids) > 50:
        raise HTTPException(status_code=400, detail="Maksimal 50 CV per batch download")

    applications = (
        db.query(Application)
        .filter(Application.id.in_(app_ids))
        .all()
    )

    if not applications:
        raise HTTPException(status_code=404, detail="Tidak ada lamaran yang ditemukan")

    # Map by id to preserve order or lookup easily
    app_map = {str(app.id): app for app in applications}

    zip_buffer = io.BytesIO()
    failed_items = []
    used_filenames = set()
    processed_candidate_ids = set()

    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for app_id in app_ids:
            app = app_map.get(app_id)
            if not app:
                failed_items.append(f"Aplikasi ID {app_id}: Data tidak ditemukan di database.")
                continue

            cand_id_str = str(app.candidate_id)
            # Distinct candidate: Jika kandidat yang sama sudah dimasukkan ke ZIP
            # (misal karena melamar ke 2 posisi berbeda), lewati agar tidak ada file duplikat.
            if cand_id_str in processed_candidate_ids:
                continue
            processed_candidate_ids.add(cand_id_str)

            candidate = db.query(Candidate).filter(Candidate.id == app.candidate_id).first()
            if not candidate:
                failed_items.append(f"Aplikasi ID {app_id}: Kandidat tidak ditemukan.")
                continue

            position = db.query(Position).filter(Position.id == app.position_id).first()
            pos_title = position.title if position else "Posisi"
            cand_name = candidate.full_name or "Kandidat"

            try:
                # 1. Pastikan CV Standar ada dan up-to-date
                # generate_cv otomatis mengembalikan cache jika fresh, atau generate baru jika belum ada/stale
                cv = await cv_generator_service.generate_cv(
                    db=db,
                    candidate_id=str(candidate.id),
                    application_id=str(app.id),
                    language=payload.language,
                    position_title=pos_title,
                    force_regenerate=False,
                )
                db.commit()
                db.refresh(cv)

                # 2. Ambil bytes file PDF
                pdf_bytes: bytes | None = None
                if settings.STORAGE_BACKEND == "onedrive" and cv.drive_item_id:
                    pdf_bytes = await onedrive_service.download_file(cv.drive_item_id)
                elif cv.drive_item_id:
                    local_path = UPLOAD_ROOT / cv.drive_item_id
                    if local_path.exists():
                        pdf_bytes = local_path.read_bytes()
                elif cv.file_url:
                    # Fallback jika drive_item_id kosong tapi ada file_url lokal
                    rel_path = cv.file_url.replace("/api/v1/files/", "").replace("/api/v1/candidates/files/", "").lstrip("/")
                    local_path = UPLOAD_ROOT / rel_path
                    if local_path.exists():
                        pdf_bytes = local_path.read_bytes()

                if not pdf_bytes:
                    failed_items.append(f"{cand_name} ({pos_title}): Gagal mengambil file PDF yang tersimpan.")
                    continue

                # 3. Buat nama file rapi di dalam ZIP
                clean_pos = re.sub(r'[\\/*?:"<>|]', "", pos_title).strip()
                clean_name = re.sub(r'[\\/*?:"<>|]', "", cand_name).strip()
                base_zip_filename = f"CV Altek - {clean_name} - {clean_pos}.pdf"
                
                # Cegah nama file duplikat dalam 1 zip
                zip_filename = base_zip_filename
                counter = 1
                while zip_filename in used_filenames:
                    zip_filename = f"CV Altek - {clean_name} - {clean_pos} ({counter}).pdf"
                    counter += 1
                used_filenames.add(zip_filename)

                # 4. Tulis ke ZIP
                zf.writestr(zip_filename, pdf_bytes)

            except Exception as exc:
                db.rollback()
                logger.exception("Gagal memproses CV untuk aplikasi %s (%s): %s", app_id, cand_name, exc)
                failed_items.append(f"{cand_name} ({pos_title}): {str(exc)}")

        # Jika ada yang gagal, sertakan log file di dalam ZIP
        if failed_items:
            readme_text = "CATATAN DOWNLOAD BATCH CV ALTEK:\n"
            readme_text += "=" * 40 + "\n\n"
            readme_text += "Beberapa CV tidak berhasil digenerate/diunduh:\n"
            for item in failed_items:
                readme_text += f"- {item}\n"
            zf.writestr("_CATATAN_PROSES_CV.txt", readme_text.encode("utf-8"))

    zip_buffer.seek(0)
    zip_bytes = zip_buffer.getvalue()

    filename = f"CV_Altek_Batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    return StreamingResponse(
        iter([zip_bytes]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


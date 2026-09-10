from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, get_current_user, require_role
from app.models.blacklist import Blacklist
from app.models.candidate import Candidate, CandidateEducation, CandidateExperience, CandidateDocument
from app.schemas.candidate import (
    CandidateCreate,
    CandidateFlagsPatch,
    CandidateResponse,
    CandidateUpdate,
    CandidateWithWarnings,
    DocumentResponse,
    EducationCreate,
    EducationResponse,
    EducationUpdate,
    ExperienceCreate,
    ExperienceResponse,
    ExperienceUpdate,
)
from app.services import candidate_service
from app.services.storage_service import get_storage_service

router = APIRouter()

# Dokumen wajib untuk status "lengkap"
REQUIRED_DOC_TYPES = {"Foto", "KTP", "Ijazah", "Transkrip", "CV_asli", "Sertifikat"}


def _recalc_completeness(candidate_id: str, db: Session) -> str:
    """Hitung kelengkapan berdasarkan dokumen yang ada."""
    docs = (
        db.query(CandidateDocument)
        .filter(
            CandidateDocument.candidate_id == candidate_id,
            CandidateDocument.is_deleted == False,
        )
        .all()
    )
    types_present = {d.doc_type for d in docs}
    required_present = REQUIRED_DOC_TYPES.issubset(types_present)
    return "lengkap" if required_present else "belum_lengkap"


# ── Static file serving (local storage) ───────────────────────────────────────

@router.get("/files/{path:path}")
async def serve_uploaded_file(path: str):
    """Serve uploaded files from local storage."""
    from app.core.config import settings
    upload_root = Path(settings.UPLOAD_DIR)
    file_path = (upload_root / path).resolve()
    # Block directory traversal
    if not str(file_path).startswith(str(upload_root.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(file_path))


# ── List ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[CandidateResponse])
def list_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    source_channel: str | None = Query(None),
    completeness_status: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Candidate)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Candidate.full_name.ilike(pattern))
            | (Candidate.email.ilike(pattern))
            | (Candidate.phone.ilike(pattern))
        )
    if source_channel:
        query = query.filter(Candidate.source_channel == source_channel)
    if completeness_status:
        query = query.filter(Candidate.completeness_status == completeness_status)
    candidates = query.offset(skip).limit(limit).all()
    # Re-compute & persist freshness for each returned candidate
    for c in candidates:
        new_status = _recalc_completeness(str(c.id), db)
        if c.completeness_status != new_status:
            c.completeness_status = new_status
    db.commit()
    return candidates


# ── Create ───────────────────────────────────────────────────────────────────

@router.post("", response_model=CandidateWithWarnings, status_code=status.HTTP_201_CREATED)
def create_candidate(
    payload: CandidateCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    # Duplikat check
    dup = candidate_service.check_duplicate(db, payload.email, payload.phone, payload.identity_no)
    if dup["is_duplicate"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Kandidat sudah ada (ID: {dup['existing_id']})",
        )

    # Blacklist check
    bl = candidate_service.check_blacklist(db, payload.email, payload.phone, payload.identity_no)

    candidate = Candidate(**payload.model_dump())
    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    return CandidateWithWarnings(
        candidate=CandidateResponse.model_validate(candidate),
        is_duplicate=dup["is_duplicate"],
        duplicate_candidate_id=dup["existing_id"],
        is_blacklisted=bl["is_blacklisted"],
        blacklist_entries=bl["blacklist_entries"],
    )


# ── Detail ───────────────────────────────────────────────────────────────────

@router.get("/{candidate_id}", response_model=CandidateResponse)
def get_candidate(candidate_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    candidate = (
        db.query(Candidate)
        .options(
            joinedload(Candidate.educations),
            joinedload(Candidate.experiences),
            joinedload(Candidate.blacklists).joinedload(Blacklist.status_type),
        )
        .filter(Candidate.id == candidate_id)
        .first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")
    # Override stored status dengan computed status dari dokumen
    candidate.completeness_status = _recalc_completeness(candidate_id, db)
    return candidate


@router.post("/{candidate_id}/completeness/recalculate", response_model=dict)
def recalculate_completeness(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    status = _recalc_completeness(candidate_id, db)
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")
    candidate.completeness_status = status
    db.commit()
    db.refresh(candidate)
    return {"completeness_status": status}


# ── Update ───────────────────────────────────────────────────────────────────

@router.put("/{candidate_id}", response_model=CandidateResponse)
def update_candidate(
    candidate_id: str,
    payload: CandidateUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")

    # Reduplicate check (hanya jika field berubah)
    if payload.email != candidate.email or payload.phone != candidate.phone or payload.identity_no != candidate.identity_no:
        dup = candidate_service.check_duplicate(db, payload.email, payload.phone, payload.identity_no)
        if dup["is_duplicate"] and dup["existing_id"] != candidate_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email/phone/NIK sudah digunakan kandidat lain (ID: {dup['existing_id']})",
            )

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(candidate, key, value)
    db.commit()
    db.refresh(candidate)
    return candidate


# ── Soft Delete (Admin only) ─────────────────────────────────────────────────

@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")
    candidate.is_deleted = True
    db.commit()


# ── PATCH flags ──────────────────────────────────────────────────────────────

@router.patch("/{candidate_id}/flags", response_model=CandidateResponse)
def patch_flags(
    candidate_id: str,
    payload: CandidateFlagsPatch,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")

    data = payload.model_dump(exclude_unset=True)
    if "completeness_status" in data and data["completeness_status"] not in ("lengkap", "belum_lengkap"):
        raise HTTPException(status_code=422, detail="completeness_status harus 'lengkap' atau 'belum_lengkap'")
    if "contact_status" in data and data["contact_status"] not in ("aktif", "tidak_bisa_dihubungi"):
        raise HTTPException(status_code=422, detail="contact_status harus 'aktif' atau 'tidak_bisa_dihubungi'")

    for key, value in data.items():
        setattr(candidate, key, value)
    db.commit()
    db.refresh(candidate)
    return candidate


# ── Education CRUD ───────────────────────────────────────────────────────────

@router.get("/{candidate_id}/education", response_model=list[EducationResponse])
@router.get("/{candidate_id}/education/", response_model=list[EducationResponse])
def list_education(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    db.query(Candidate).filter(Candidate.id == candidate_id).first() or _raise_404("Kandidat tidak ditemukan")
    return db.query(CandidateEducation).filter(CandidateEducation.candidate_id == candidate_id).all()


@router.post("/{candidate_id}/education", response_model=EducationResponse, status_code=status.HTTP_201_CREATED)
@router.post("/{candidate_id}/education/", response_model=EducationResponse, status_code=status.HTTP_201_CREATED)
def add_education(
    candidate_id: str,
    payload: EducationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    db.query(Candidate).filter(Candidate.id == candidate_id).first() or _raise_404("Kandidat tidak ditemukan")
    edu = CandidateEducation(candidate_id=candidate_id, **payload.model_dump())
    db.add(edu)
    db.commit()
    db.refresh(edu)
    return edu


@router.put("/{candidate_id}/education/{edu_id}", response_model=EducationResponse)
@router.put("/{candidate_id}/education/{edu_id}/", response_model=EducationResponse)
def update_education(
    candidate_id: str,
    edu_id: str,
    payload: EducationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    edu = db.query(CandidateEducation).filter(
        CandidateEducation.id == edu_id,
        CandidateEducation.candidate_id == candidate_id,
    ).first()
    if not edu:
        raise HTTPException(status_code=404, detail="Data pendidikan tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(edu, key, value)
    db.commit()
    db.refresh(edu)
    return edu


@router.delete("/{candidate_id}/education/{edu_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/{candidate_id}/education/{edu_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_education(
    candidate_id: str,
    edu_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    edu = db.query(CandidateEducation).filter(
        CandidateEducation.id == edu_id,
        CandidateEducation.candidate_id == candidate_id,
    ).first()
    if not edu:
        raise HTTPException(status_code=404, detail="Data pendidikan tidak ditemukan")
    db.delete(edu)
    db.commit()


# ── Experience CRUD ──────────────────────────────────────────────────────────

@router.get("/{candidate_id}/experience", response_model=list[ExperienceResponse])
@router.get("/{candidate_id}/experience/", response_model=list[ExperienceResponse])
def list_experience(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    db.query(Candidate).filter(Candidate.id == candidate_id).first() or _raise_404("Kandidat tidak ditemukan")
    return db.query(CandidateExperience).filter(CandidateExperience.candidate_id == candidate_id).all()


@router.post("/{candidate_id}/experience", response_model=ExperienceResponse, status_code=status.HTTP_201_CREATED)
@router.post("/{candidate_id}/experience/", response_model=ExperienceResponse, status_code=status.HTTP_201_CREATED)
def add_experience(
    candidate_id: str,
    payload: ExperienceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    db.query(Candidate).filter(Candidate.id == candidate_id).first() or _raise_404("Kandidat tidak ditemukan")
    exp = CandidateExperience(candidate_id=candidate_id, **payload.model_dump())
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


@router.put("/{candidate_id}/experience/{exp_id}", response_model=ExperienceResponse)
@router.put("/{candidate_id}/experience/{exp_id}/", response_model=ExperienceResponse)
def update_experience(
    candidate_id: str,
    exp_id: str,
    payload: ExperienceUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    exp = db.query(CandidateExperience).filter(
        CandidateExperience.id == exp_id,
        CandidateExperience.candidate_id == candidate_id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Pengalaman kerja tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(exp, key, value)
    db.commit()
    db.refresh(exp)
    return exp


@router.delete("/{candidate_id}/experience/{exp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_experience(
    candidate_id: str,
    exp_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    exp = db.query(CandidateExperience).filter(
        CandidateExperience.id == exp_id,
        CandidateExperience.candidate_id == candidate_id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Pengalaman kerja tidak ditemukan")
    db.delete(exp)
    db.commit()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _raise_404(msg: str) -> None:
    raise HTTPException(status_code=404, detail=msg)


# ── Document CRUD ─────────────────────────────────────────────────────────────

@router.get("/{candidate_id}/documents", response_model=list[DocumentResponse])
@router.get("/{candidate_id}/documents/", response_model=list[DocumentResponse])
def list_documents(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    db.query(Candidate).filter(Candidate.id == candidate_id).first() or _raise_404("Kandidat tidak ditemukan")
    return (
        db.query(CandidateDocument)
        .filter(CandidateDocument.candidate_id == candidate_id, CandidateDocument.is_deleted == False)
        .all()
    )


@router.post("/{candidate_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
@router.post("/{candidate_id}/documents/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    candidate_id: str,
    doc_type: str = Query(..., description="KTP/Ijazah/Transkrip/CV_asli/Foto/Sertifikat/BPJS_TK/BPJS_Kesehatan/NPWP"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    # Validasi kandidat
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # max 10MB
        raise HTTPException(status_code=413, detail="Ukuran file maksimal 10MB")

    folder = f"Candidates/{candidate_id}"
    storage = get_storage_service()
    result = await storage.upload(
        file_content=content,
        filename=file.filename or f"{doc_type}.pdf",
        folder=folder,
    )

    doc = CandidateDocument(
        candidate_id=candidate_id,
        doc_type=doc_type,
        file_url=result["file_url"],
        drive_item_id=None,  # local storage — drive_item_id tidak dipakai
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Recalculate kelengkapan kandidat
    new_status = _recalc_completeness(candidate_id, db)
    if candidate.completeness_status != new_status:
        candidate.completeness_status = new_status
        db.commit()

    return doc


@router.get("/{candidate_id}/documents/{doc_id}/download-url", response_model=dict)
async def get_download_url(
    candidate_id: str,
    doc_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    doc = db.query(CandidateDocument).filter(
        CandidateDocument.id == doc_id,
        CandidateDocument.candidate_id == candidate_id,
        CandidateDocument.is_deleted == False,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    if not doc.file_url:
        raise HTTPException(status_code=400, detail="File belum diupload")

    storage = get_storage_service()
    # Local storage: file_url sudah berupa path relatif, return langsung
    if doc.drive_item_id:
        url = await storage.get_download_url(doc.drive_item_id)
    else:
        url = doc.file_url
    return {"download_url": url}


@router.patch("/{candidate_id}/documents/{doc_id}/verify", response_model=DocumentResponse)
def toggle_verify_document(
    candidate_id: str,
    doc_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    doc = db.query(CandidateDocument).filter(
        CandidateDocument.id == doc_id,
        CandidateDocument.candidate_id == candidate_id,
        CandidateDocument.is_deleted == False,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    doc.is_verified = not doc.is_verified
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/{candidate_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    candidate_id: str,
    doc_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    doc = db.query(CandidateDocument).filter(
        CandidateDocument.id == doc_id,
        CandidateDocument.candidate_id == candidate_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    doc.is_deleted = True
    storage = get_storage_service()
    # Hapus file fisik untuk local storage
    if not doc.drive_item_id and doc.file_url:
        try:
            await storage.delete(doc.file_url)
        except Exception:
            pass
    # Hapus dari OneDrive jika ada drive_item_id (migration scenario)
    elif doc.drive_item_id:
        try:
            await storage.delete_file(doc.drive_item_id)
        except Exception:
            pass  # biarkan soft-delete lokal meskipun hapus cloud gagal
    db.commit()

    # Recalculate kelengkapan kandidat
    new_status = _recalc_completeness(candidate_id, db)
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if candidate and candidate.completeness_status != new_status:
        candidate.completeness_status = new_status
        db.commit()


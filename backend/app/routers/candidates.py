from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, require_role

router = APIRouter()


@router.get("/")
def list_candidates(current_user=Depends(get_current_user)):
    # TODO: TASK-04.1 — pagination, search, filter
    return {"message": "TODO: list candidates"}


@router.post("/")
def create_candidate(current_user=Depends(require_role("hr", "manager", "admin"))):
    # TODO: TASK-04.1 — duplikat check + blacklist check
    return {"message": "TODO: create candidate"}


@router.get("/{candidate_id}")
def get_candidate(candidate_id: str, current_user=Depends(get_current_user)):
    return {"message": f"TODO: get candidate {candidate_id}"}


@router.put("/{candidate_id}")
def update_candidate(candidate_id: str, current_user=Depends(require_role("hr", "manager", "admin"))):
    return {"message": f"TODO: update candidate {candidate_id}"}


# --- Education ---
@router.get("/{candidate_id}/education/")
def list_education(candidate_id: str, current_user=Depends(get_current_user)):
    return {"message": "TODO"}


@router.post("/{candidate_id}/education/")
def add_education(candidate_id: str, current_user=Depends(require_role("hr", "manager", "admin"))):
    return {"message": "TODO"}


# --- Experience ---
@router.get("/{candidate_id}/experience/")
def list_experience(candidate_id: str, current_user=Depends(get_current_user)):
    return {"message": "TODO"}


@router.post("/{candidate_id}/experience/")
def add_experience(candidate_id: str, current_user=Depends(require_role("hr", "manager", "admin"))):
    return {"message": "TODO"}


# --- Documents ---
@router.get("/{candidate_id}/documents/")
def list_documents(candidate_id: str, current_user=Depends(get_current_user)):
    return {"message": "TODO: list documents"}


@router.post("/{candidate_id}/documents/")
def upload_document(candidate_id: str, current_user=Depends(require_role("hr", "manager", "admin"))):
    # TODO: TASK-04.2 — validasi MIME, upload ke OneDrive, simpan referensi
    return {"message": "TODO: upload document"}


@router.get("/{candidate_id}/documents/{doc_id}/download-url")
def get_download_url(candidate_id: str, doc_id: str, current_user=Depends(get_current_user)):
    # TODO: return pre-authenticated OneDrive URL
    return {"message": "TODO: get download URL"}


@router.delete("/{candidate_id}/documents/{doc_id}")
def delete_document(candidate_id: str, doc_id: str, current_user=Depends(require_role("hr", "manager", "admin"))):
    return {"message": "TODO: soft delete document"}

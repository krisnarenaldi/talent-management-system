from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, require_role
from app.models.generated_cv import GeneratedCV
from app.models.candidate import Candidate
from app.models.application import Application
from app.models.position import Position
from app.schemas.generated_cv import CVResponse
from app.services.cv_generator_service import _is_stale
from app.routers.agreement_types import router as agreement_types_router
from app.routers.blacklist_status_types import router as blacklist_status_types_router

router = APIRouter()

# Redirect admin-level endpoints ke router terpisah
router.include_router(agreement_types_router, prefix="/agreement-types", tags=["Agreement Types"])
router.include_router(blacklist_status_types_router, prefix="/blacklist-status-types", tags=["Blacklist Status Types"])


# ── Admin: list all generated CVs ────────────────────────────────────────────

class GeneratedCVAdminResponse(CVResponse):
    candidate_name: str | None = None
    position_title: str | None = None
    client_name: str | None = None


@router.get(
    "/generated-cvs",
    response_model=list[GeneratedCVAdminResponse],
    summary="[Admin] List semua generated CV di sistem",
    tags=["Admin"],
)
def list_all_generated_cvs(
    language: str | None = Query(None, description="Filter by language: ID atau EN"),
    summary_source: str | None = Query(None, description="Filter by summary_source: AI atau HR"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """
    Kembalikan semua record GeneratedCV di seluruh sistem, diurutkan terbaru.
    Di-join ke candidate dan application untuk menyertakan nama kandidat & posisi.
    Hanya Admin yang bisa mengakses endpoint ini.
    """
    query = (
        db.query(GeneratedCV)
        .options(
            joinedload(GeneratedCV.candidate),
        )
    )

    if language:
        query = query.filter(GeneratedCV.language == language.upper())
    if summary_source:
        query = query.filter(GeneratedCV.summary_source == summary_source.upper())

    cvs = query.order_by(GeneratedCV.generated_at.desc()).offset(skip).limit(limit).all()

    results: list[GeneratedCVAdminResponse] = []
    for cv in cvs:
        candidate: Candidate | None = cv.candidate
        position_title: str | None = None
        client_name: str | None = None

        if cv.application_id:
            app = (
                db.query(Application)
                .filter(Application.id == cv.application_id)
                .first()
            )
            if app and app.position_id:
                pos = (
                    db.query(Position)
                    .options(joinedload(Position.client))
                    .filter(Position.id == app.position_id)
                    .first()
                )
                if pos:
                    position_title = pos.title
                    client_name = pos.client_name

        item = GeneratedCVAdminResponse.model_validate(cv)
        item.is_stale = _is_stale(candidate, cv) if candidate else True
        item.candidate_name = candidate.full_name if candidate else None
        item.position_title = position_title
        item.client_name = client_name
        results.append(item)

    return results

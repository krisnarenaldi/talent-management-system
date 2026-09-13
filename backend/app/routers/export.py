import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role, get_db
from app.services.export_service import (
    _get_excel_response_for_candidates,
    _get_excel_response_for_pipeline,
    _get_excel_response_for_incomplete_candidates,
)

router = APIRouter()


def _parse_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Format tanggal tidak valid: {date_str}. Gunakan format YYYY-MM-DD")


def _parse_uuid(value: str | None, field_name: str = "position_id") -> str | None:
    if not value:
        return None
    try:
        uuid.UUID(value)
        return value
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Format {field_name} tidak valid: harus berupa UUID")


@router.get("/candidates")
def export_candidates(
    position_id: str | None = Query(None),
    completeness_status: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """Export candidates to Excel with optional filters."""
    try:
        excel_bytes = _get_excel_response_for_candidates(
            db,
            position_id=_parse_uuid(position_id),
            completeness_status=completeness_status,
            start_date=_parse_date(start_date),
            end_date=_parse_date(end_date),
        )
        filename = f"candidates_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return StreamingResponse(
            iter([excel_bytes]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal membuat file Excel: {str(e)}")


@router.get("/pipeline")
def export_pipeline(
    status_filter: str | None = Query(None),
    current_stage: str | None = Query(None),
    position_id: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """Export pipeline data to Excel with optional filters."""
    try:
        excel_bytes = _get_excel_response_for_pipeline(
            db,
            status_filter=status_filter,
            current_stage=current_stage,
            position_id=_parse_uuid(position_id),
            start_date=_parse_date(start_date),
            end_date=_parse_date(end_date),
        )
        filename = f"pipeline_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return StreamingResponse(
            iter([excel_bytes]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal membuat file Excel: {str(e)}")


@router.get("/incomplete")
def export_incomplete(
    position_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """Export incomplete candidates to Excel with optional filters."""
    try:
        excel_bytes = _get_excel_response_for_incomplete_candidates(
            db,
            position_id=_parse_uuid(position_id),
        )
        filename = f"incomplete_candidates_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return StreamingResponse(
            iter([excel_bytes]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal membuat file Excel: {str(e)}")

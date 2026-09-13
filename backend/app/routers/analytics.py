from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, require_role
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.employee import Employee, EmployeeContract
from app.models.position import Position

router = APIRouter()


@router.get("/summary")
async def analytics_summary(
    db: Session = Depends(get_db),
    _current_user=Depends(require_role("hr", "manager", "admin")),
):
    """Dashboard analytics summary.

    Returns:
      - total_active_candidates: count of candidates where is_deleted=False
      - pipeline_breakdown: list of {stage, count} grouped by current_stage for active applications
      - total_active_employees: count of employees with employee_status='aktif'
      - contracts_expiring_30d: count of active contracts ending within 30 days
    """
    today = date.today()
    thirty_days_later = today + timedelta(days=30)

    # Total kandidat aktif (is_deleted=False)
    total_active_candidates = (
        db.execute(select(func.count()).where(Candidate.is_deleted == False))
    ).scalar_one()

    # Pipeline breakdown — hanya aplikasi aktif (status='active')
    pipeline_rows = db.execute(
        select(Application.current_stage, func.count(Application.id))
        .where(Application.status == "active")
        .group_by(Application.current_stage)
        .order_by(Application.current_stage)
    ).all()
    pipeline_breakdown = [{"stage": row[0], "count": row[1]} for row in pipeline_rows]

    # Total karyawan aktif
    total_active_employees = (
        db.execute(
            select(func.count())
            .where(Employee.employee_status == "aktif")
        )
    ).scalar_one()

    # Kontrak habis dalam 30 hari
    contracts_expiring_30d = (
        db.execute(
            select(func.count())
            .select_from(EmployeeContract)
            .join(Employee)
            .where(
                EmployeeContract.status == "aktif",
                EmployeeContract.end_date >= today,
                EmployeeContract.end_date <= thirty_days_later,
                Employee.employee_status == "aktif",
            )
        )
    ).scalar_one()

    return {
        "total_active_candidates": total_active_candidates,
        "pipeline_breakdown": pipeline_breakdown,
        "total_active_employees": total_active_employees,
        "contracts_expiring_30d": contracts_expiring_30d,
    }


@router.get("/recent-applications")
async def recent_applications(
    limit: int = 5,
    db: Session = Depends(get_db),
    _current_user=Depends(require_role("hr", "manager", "admin")),
):
    """Top N applications terbaru untuk dashboard."""
    apps = (
        db.query(Application)
        .options(
            joinedload(Application.position).joinedload(Position.client),
            joinedload(Application.recruiter),
        )
        .order_by(Application.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(app.id),
            "candidate_name": app.candidate_name,
            "position_title": app.position_title,
            "client_name": app.client_name,
            "current_stage": app.current_stage,
            "status": app.status,
            "recruiter_name": app.recruiter_name,
            "created_at": app.created_at.isoformat() if app.created_at else None,
        }
        for app in apps
    ]


@router.get("/contracts-expiring")
async def contracts_expiring(
    limit: int = 5,
    db: Session = Depends(get_db),
    _current_user=Depends(require_role("hr", "manager", "admin")),
):
    """Top N kontrak yang hampir habis masa berlakunya (aktif, <= 30 hari)."""
    today = date.today()
    thirty_days_later = today + timedelta(days=30)

    contracts = (
        db.query(EmployeeContract, Employee.full_name, Employee.placement)
        .join(Employee, EmployeeContract.employee_id == Employee.id)
        .where(
            EmployeeContract.status == "aktif",
            EmployeeContract.end_date >= today,
            EmployeeContract.end_date <= thirty_days_later,
            Employee.employee_status == "aktif",
        )
        .order_by(EmployeeContract.end_date.asc())
        .limit(limit)
        .all()
    )

    return [
        {
            "contract_id": str(c[0].id),
            "employee_name": c[1],
            "placement": c[2],
            "end_date": c[0].end_date.isoformat() if c[0].end_date else None,
            "days_remaining": (c[0].end_date - today).days if c[0].end_date else None,
        }
        for c in contracts
    ]

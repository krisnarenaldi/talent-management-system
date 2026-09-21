from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, case, text
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, require_role
from app.models.application import Application, StageHistory
from app.models.candidate import Candidate
from app.models.client import Client
from app.models.employee import Employee, EmployeeContract
from app.models.position import Position
from app.models.user import User

router = APIRouter()


@router.get("/summary")
async def analytics_summary(
    db: Session = Depends(get_db),
    _current_user=Depends(require_role("hr", "manager", "admin")),
):
    """Dashboard analytics summary."""
    today = date.today()
    thirty_days_later = today + timedelta(days=30)

    total_active_candidates = (
        db.execute(select(func.count()).where(Candidate.is_deleted == False))
    ).scalar_one()

    pipeline_rows = db.execute(
        select(Application.current_stage, func.count(Application.id))
        .where(Application.status == "active")
        .group_by(Application.current_stage)
        .order_by(Application.current_stage)
    ).all()
    pipeline_breakdown = [{"stage": row[0], "count": row[1]} for row in pipeline_rows]

    total_active_employees = (
        db.execute(
            select(func.count())
            .where(Employee.employee_status == "aktif")
        )
    ).scalar_one()

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
    """Top N kontrak yang hampir habis masa berlakunya."""
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


@router.get("/pipeline-breakdown")
async def analytics_pipeline_breakdown(
    db: Session = Depends(get_db),
    _current_user=Depends(require_role("hr", "manager", "admin")),
    position_id: Optional[str] = Query(None),
    period_start: Optional[str] = Query(None, description="YYYY-MM"),
    period_end: Optional[str] = Query(None, description="YYYY-MM"),
):
    """Pipeline breakdown per stage, position, and month."""
    query = (
        select(
            Application.current_stage.label("stage"),
            Position.id.label("position_id"),
            Position.title.label("position_title"),
            Position.client.name.label("client_name"),
            func.to_char(Application.created_at, 'YYYY-MM').label("period"),
            func.count(Application.id).label("count"),
        )
        .join(Position, Application.position_id == Position.id)
        .outerjoin(Candidate, Application.candidate_id == Candidate.id)
    )
    if position_id:
        query = query.where(Position.id == position_id)
    if period_start:
        query = query.where(func.to_char(Application.created_at, 'YYYY-MM') >= period_start)
    if period_end:
        query = query.where(func.to_char(Application.created_at, 'YYYY-MM') <= period_end)
    query = query.group_by(
        Application.current_stage,
        Position.id,
        Position.title,
        Position.client.name,
        func.to_char(Application.created_at, 'YYYY-MM'),
    )
    query = query.order_by(
        func.to_char(Application.created_at, 'YYYY-MM').desc(),
        Application.current_stage,
    )
    rows = db.execute(query).all()
    return [
        {
            "stage": row.stage,
            "position_id": str(row.position_id) if row.position_id else None,
            "position_title": row.position_title,
            "client_name": row.client_name,
            "period": row.period,
            "count": row.count,
        }
        for row in rows
    ]


@router.get("/success-rate-by-position")
async def analytics_success_rate_by_position(
    db: Session = Depends(get_db),
    _current_user=Depends(require_role("hr", "manager", "admin")),
):
    """Success rate (lolos) per position based on Interview User stage using window function via text()."""
    # Using raw SQL text for row_number() over partition to avoid SQLAlchemy 2 attribute/label issues
    sql = text("""
        WITH ranked_interviews AS (
            SELECT 
                application_id,
                result,
                ROW_NUMBER() OVER (PARTITION BY application_id ORDER BY created_at DESC) as rn
            FROM stage_history
            WHERE stage_name = 'Interview_User'
        )
        SELECT 
            p.id AS position_id,
            p.title AS position_title,
            p.client_name AS client_name,
            COUNT(ri.application_id) AS total_applications,
            SUM(CASE WHEN ri.result IN ('Lanjut', 'Lolos', 'Ok') THEN 1 ELSE 0 END) AS passed_user_interview
        FROM application a
        JOIN position p ON a.position_id = p.id
        LEFT JOIN ranked_interviews ri ON a.id = ri.application_id AND ri.rn = 1
        GROUP BY p.id, p.title, p.client_name
    """)
    rows = db.execute(sql).fetchall()
    result = []
    for row in rows:
        total = row.total_applications or 0
        passed = row.passed_user_interview or 0
        rate = (passed / total * 100) if total > 0 else 0.0
        result.append(
            {
                "position_id": str(row.position_id),
                "position_title": row.position_title,
                "client_name": row.client_name or "-",
                "total_applications": total,
                "passed_user_interview": passed,
                "success_rate": round(rate, 2),
            }
        )
    return result


@router.get("/success-rate-by-source")
async def analytics_success_rate_by_source(
    db: Session = Depends(get_db),
    _current_user=Depends(require_role("hr", "manager", "admin")),
):
    """Success rate (lolos) per source channel based on Interview User stage using raw SQL text."""
    sql = text("""
        WITH ranked_interviews AS (
            SELECT 
                application_id,
                result,
                ROW_NUMBER() OVER (PARTITION BY application_id ORDER BY created_at DESC) as rn
            FROM stage_history
            WHERE stage_name = 'Interview_User'
        )
        SELECT 
            c.source_channel AS source_channel,
            COUNT(ri.application_id) AS total_applications,
            SUM(CASE WHEN ri.result IN ('Lanjut', 'Lolos', 'Ok') THEN 1 ELSE 0 END) AS passed_user_interview
        FROM application a
        JOIN candidate c ON a.candidate_id = c.id
        LEFT JOIN ranked_interviews ri ON a.id = ri.application_id AND ri.rn = 1
        GROUP BY c.source_channel
    """)
    rows = db.execute(sql).fetchall()
    result = []
    for row in rows:
        total = row.total_applications or 0
        passed = row.passed_user_interview or 0
        rate = (passed / total * 100) if total > 0 else 0.0
        result.append(
            {
                "source_channel": row.source_channel or "(tidak diketahui)",
                "total_applications": total,
                "passed_user_interview": passed,
                "success_rate": round(rate, 2),
            }
        )
    return result


@router.get("/pipeline-trend")
async def analytics_pipeline_trend(
    db: Session = Depends(get_db),
    _current_user=Depends(require_role("hr", "manager", "admin")),
    months: int = Query(6, ge=1, le=24, description="Jumlah bulan terakhir untuk tren"),
    position_id: Optional[str] = Query(None),
):
    """Tren kandidat masuk per bulan untuk visualisasi line chart."""
    today = date.today()
    start_date = today - timedelta(days=30 * months)
    rows = (
        db.execute(
            select(
                func.to_char(Application.created_at, 'YYYY-MM').label("period"),
                func.count(Application.id).label("count"),
            )
            .where(Application.created_at >= start_date)
            .group_by(func.to_char(Application.created_at, 'YYYY-MM'))
            .order_by(func.to_char(Application.created_at, 'YYYY-MM'))
        )
    ).all()
    return [{"period": r.period, "count": r.count} for r in rows]


@router.get("/applications-by-position")
async def analytics_applications_by_position(
    db: Session = Depends(get_db),
    _current_user=Depends(require_role("hr", "manager", "admin")),
):
    """Jumlah pelamar (aplikasi) per posisi."""
    rows = (
        db.execute(
            select(
                Position.title.label("position_title"),
                func.count(Application.id).label("total_applications"),
            )
            .join(Position, Application.position_id == Position.id)
            .group_by(Position.id, Position.title)
            .order_by(func.count(Application.id).desc())
        )
    ).all()
    return [
        {
            "position_title": row.position_title or "(Tidak Diketahui)",
            "total_applications": row.total_applications or 0,
        }
        for row in rows
    ]


@router.get("/applications-by-company")
async def analytics_applications_by_company(
    db: Session = Depends(get_db),
    _current_user=Depends(require_role("hr", "manager", "admin")),
):
    """Jumlah pelamar (aplikasi) per perusahaan (client)."""
    rows = (
        db.execute(
            select(
                Client.name.label("client_name"),
                func.count(Application.id).label("total_applications"),
            )
            .join(Position, Application.position_id == Position.id)
            .join(Client, Position.client_id == Client.id)
            .group_by(Client.id, Client.name)
            .order_by(func.count(Application.id).desc())
        )
    ).all()
    return [
        {
            "client_name": row.client_name or "(Tidak Diketahui)",
            "total_applications": row.total_applications or 0,
        }
        for row in rows
    ]


@router.get("/recruiter-workload")
async def analytics_recruiter_workload(
    db: Session = Depends(get_db),
    _current_user=Depends(require_role("hr", "manager", "admin")),
):
    """Beban kerja HR/Recruiter: jumlah kandidat (aplikasi) yang dipegang per recruiter.

    Menghitung total aplikasi aktif saja (status='active'), diurutkan dari beban terbesar.
    Juga mencantumkan total aplikasi (all time) untuk referensi produktivitas.
    """
    sql = text("""
        SELECT 
            u.id AS recruiter_id,
            u.name AS recruiter_name,
            COUNT(a.id) AS total_applications_all_time,
            COUNT(CASE WHEN a.status = 'active' THEN 1 END) AS active_candidates,
            COUNT(CASE WHEN a.status = 'hired' THEN 1 END) AS hired_count,
            COUNT(CASE WHEN a.status = 'rejected' THEN 1 END) AS rejected_count
        FROM "user" u
        LEFT JOIN application a ON a.recruiter_id = u.id
        WHERE u.role IN ('hr', 'manager', 'admin')
          AND u.is_active = true
        GROUP BY u.id, u.name
        ORDER BY active_candidates DESC, total_applications_all_time DESC
    """)
    rows = db.execute(sql).fetchall()
    return [
        {
            "recruiter_id": str(row.recruiter_id),
            "recruiter_name": row.recruiter_name or "(Tidak Diketahui)",
            "total_applications_all_time": row.total_applications_all_time or 0,
            "active_candidates": row.active_candidates or 0,
            "hired_count": row.hired_count or 0,
            "rejected_count": row.rejected_count or 0,
        }
        for row in rows
    ]

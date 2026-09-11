from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.core.pydantic_utils import AutoStrUUID
from app.db.database import get_db
from app.models.employee import Employee
from app.models.user import User

router = APIRouter()

@router.get("", response_model=list[dict])
def list_employees(
    search: str | None = Query(None, description="Search by name, email, or phone"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hr", "manager", "admin", "pm")),
):
    stmt = select(Employee)
    if search:
        stmt = stmt.where(
            or_(
                Employee.full_name.ilike(f"%{search}%"),
                Employee.office_email.ilike(f"%{search}%"),
                Employee.phone_number.ilike(f"%{search}%"),
            )
        )
    rows = db.execute(stmt).scalars().all()
    return [
        {
            "id": str(row.id),
            "full_name": row.full_name,
            "office_email": row.office_email,
            "phone_number": row.phone_number,
        }
        for row in rows
    ]
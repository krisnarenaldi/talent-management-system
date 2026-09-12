from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select, func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.core.pydantic_utils import AutoStrUUID
from app.db.database import get_db
from app.models.blacklist import Blacklist, BlacklistStatusType
from app.models.candidate import Candidate
from app.models.employee import Employee
from app.models.user import User
from app.schemas.blacklist import BlacklistCreate, BlacklistResponse

router = APIRouter()


def _fetch_target_details(db: Session, blacklist: Blacklist) -> dict:
    """Helper to fetch target and PIC details for a blacklist record."""
    details = {
        "candidate_name": None,
        "candidate_email": None,
        "candidate_phone": None,
        "employee_name": None,
        "employee_email": None,
        "employee_phone": None,
        "pic_name": None,
        "target_name": "",
        "target_email": None,
        "target_phone": None,
        "target_type": "employee",
    }
    if blacklist.candidate_id:
        cand = db.get(Candidate, blacklist.candidate_id)
        if cand:
            details["candidate_name"] = cand.full_name
            details["candidate_email"] = cand.email
            details["candidate_phone"] = cand.phone
            details["target_name"] = cand.full_name or ""
            details["target_email"] = cand.email
            details["target_phone"] = cand.phone
            details["target_type"] = "candidate"
    elif blacklist.employee_id:
        emp = db.get(Employee, blacklist.employee_id)
        if emp:
            details["employee_name"] = emp.full_name
            details["employee_email"] = emp.office_email
            details["employee_phone"] = emp.phone_number
            details["target_name"] = emp.full_name or ""
            details["target_email"] = emp.office_email
            details["target_phone"] = emp.phone_number
            details["target_type"] = "employee"
    if blacklist.pic_user_id:
        pic = db.get(User, blacklist.pic_user_id)
        if pic:
            details["pic_name"] = pic.name
    return details


# ── GET /api/v1/blacklist/ ────────────────────────────────────────────────────
@router.get("", response_model=list[BlacklistResponse])
def list_blacklist(
    search: str | None = Query(None, description="Filter berdasarkan nama target"),
    status_type_id: Optional[AutoStrUUID] = Query(None),
    approval_status: Optional[str] = Query(None, description="Filter: pending, approved, all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hr", "manager", "admin", "pm")),
):
    # Base query with left joins to candidate, employee, and user (PIC)
    stmt = (
        select(
            Blacklist,
            Candidate.full_name.label("candidate_name"),
            Candidate.email.label("candidate_email"),
            Candidate.phone.label("candidate_phone"),
            Employee.full_name.label("employee_name"),
            Employee.office_email.label("employee_email"),
            Employee.phone_number.label("employee_phone"),
            User.name.label("pic_name"),
            BlacklistStatusType.label.label("status_type_label"),
        )
        .join(BlacklistStatusType, BlacklistStatusType.id == Blacklist.status_type_id)
        .outerjoin(Candidate, Candidate.id == Blacklist.candidate_id)
        .outerjoin(Employee, Employee.id == Blacklist.employee_id)
        .outerjoin(User, User.id == Blacklist.pic_user_id)
        .filter(Blacklist.is_active == True)
    )

    if search:
        # Search in candidate or employee name/email
        stmt = stmt.where(
            or_(
                Candidate.full_name.ilike(f"%{search}%"),
                Candidate.email.ilike(f"%{search}%"),
                Employee.full_name.ilike(f"%{search}%"),
                Employee.office_email.ilike(f"%{search}%"),
            )
        )
    if status_type_id:
        stmt = stmt.where(Blacklist.status_type_id == status_type_id)
    if approval_status == "pending":
        stmt = stmt.where(Blacklist.is_approved == False)
    elif approval_status == "approved":
        stmt = stmt.where(Blacklist.is_approved == True)

    rows = db.execute(stmt).all()

    results = []
    for row in rows:
        bl = row.Blacklist
        # Determine target type and details
        if bl.candidate_id:
            target_type = "candidate"
            target_name = row.candidate_name or ""
            target_email = row.candidate_email
            target_phone = row.candidate_phone
        else:
            target_type = "employee"
            target_name = row.employee_name or ""
            target_email = row.employee_email
            target_phone = row.employee_phone

        results.append(
            BlacklistResponse(
                id=bl.id,
                candidate_id=bl.candidate_id,
                employee_id=bl.employee_id,
                status_type_id=bl.status_type_id,
                reason=bl.reason,
                notes=bl.notes,
                blacklisted_date=bl.blacklisted_date,
                pic_user_id=bl.pic_user_id,
                is_approved=bl.is_approved,
                approved_by=bl.approved_by,
                is_active=bl.is_active,
                created_at=bl.created_at,
                candidate_name=row.candidate_name,
                candidate_email=row.candidate_email,
                candidate_phone=row.candidate_phone,
                employee_name=row.employee_name,
                employee_email=row.employee_email,
                employee_phone=row.employee_phone,
                pic_name=row.pic_name,
                status_type_label=row.status_type_label,
                target_name=target_name,
                target_email=target_email,
                target_phone=target_phone,
                target_type=target_type,
            )
        )
    return results


# ── POST /api/v1/blacklist/ ───────────────────────────────────────────────────
@router.post("", response_model=BlacklistResponse, status_code=201)
def add_to_blacklist(
    payload: BlacklistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hr", "manager", "admin", "pm")),
):
    # Validate target exists
    target = None
    target_type = None
    if payload.candidate_id:
        target = db.get(Candidate, payload.candidate_id)
        if not target or target.is_deleted:
            raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan.")
        target_type = "candidate"
    elif payload.employee_id:
        target = db.get(Employee, payload.employee_id)
        if not target:
            raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan.")
        target_type = "employee"
    else:
        # Should not happen due to schema validator
        raise HTTPException(status_code=400, detail="Harus memberikan kandidat atau karyawan.")

    # Validate status_type exists
    status_type = db.get(BlacklistStatusType, payload.status_type_id)
    if not status_type:
        raise HTTPException(status_code=404, detail="Status type tidak ditemukan.")

    # Check duplicate: same target already active
    existing = db.execute(
        select(Blacklist).where(
            or_(
                Blacklist.candidate_id == payload.candidate_id,
                Blacklist.employee_id == payload.employee_id,
            ),
            Blacklist.is_active == True,
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"{'Kandidat' if target_type == 'candidate' else 'Karyawan'} ini sudah ada di blacklist.",
        )

    # Determine pic_user_id: use provided or default to current user
    pic_user_id = payload.pic_user_id if payload.pic_user_id is not None else current_user.id

    blacklist = Blacklist(
        candidate_id=payload.candidate_id if payload.candidate_id else None,
        employee_id=payload.employee_id if payload.employee_id else None,
        status_type_id=payload.status_type_id,
        reason=payload.reason,
        notes=payload.notes,
        blacklisted_date=payload.blacklisted_date or date.today(),
        pic_user_id=pic_user_id,
        is_approved=False,
    )
    db.add(blacklist)
    db.commit()
    db.refresh(blacklist)

    # Fetch target and PIC details for response
    details = _fetch_target_details(db, blacklist)

    return BlacklistResponse(
        id=blacklist.id,
        candidate_id=blacklist.candidate_id,
        employee_id=blacklist.employee_id,
        status_type_id=blacklist.status_type_id,
        reason=blacklist.reason,
        notes=blacklist.notes,
        blacklisted_date=blacklist.blacklisted_date,
        pic_user_id=blacklist.pic_user_id,
        is_approved=blacklist.is_approved,
        approved_by=blacklist.approved_by,
        is_active=blacklist.is_active,
        created_at=blacklist.created_at,
        candidate_name=details["candidate_name"],
        candidate_email=details["candidate_email"],
        candidate_phone=details["candidate_phone"],
        employee_name=details["employee_name"],
        employee_email=details["employee_email"],
        employee_phone=details["employee_phone"],
        pic_name=details["pic_name"],
        status_type_label=status_type.label,
        target_name=details["target_name"],
        target_email=details["target_email"],
        target_phone=details["target_phone"],
        target_type=details["target_type"],
    )


# ── PATCH /api/v1/blacklist/{id}/approve ──────────────────────────────────────
@router.patch("/{blacklist_id}/approve", response_model=BlacklistResponse)
def approve_blacklist(
    blacklist_id: AutoStrUUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    blacklist = db.get(Blacklist, blacklist_id)
    if not blacklist or not blacklist.is_active:
        raise HTTPException(status_code=404, detail="Blacklist record tidak ditemukan.")

    blacklist.is_approved = True
    blacklist.approved_by = current_user.id
    db.commit()
    db.refresh(blacklist)

    # Fetch target and PIC details
    details = _fetch_target_details(db, blacklist)
    status_type = db.get(BlacklistStatusType, blacklist.status_type_id)

    return BlacklistResponse(
        id=blacklist.id,
        candidate_id=blacklist.candidate_id,
        employee_id=blacklist.employee_id,
        status_type_id=blacklist.status_type_id,
        reason=blacklist.reason,
        notes=blacklist.notes,
        blacklisted_date=blacklist.blacklisted_date,
        pic_user_id=blacklist.pic_user_id,
        is_approved=blacklist.is_approved,
        approved_by=blacklist.approved_by,
        is_active=blacklist.is_active,
        created_at=blacklist.created_at,
        candidate_name=details["candidate_name"],
        candidate_email=details["candidate_email"],
        candidate_phone=details["candidate_phone"],
        employee_name=details["employee_name"],
        employee_email=details["employee_email"],
        employee_phone=details["employee_phone"],
        pic_name=details["pic_name"],
        status_type_label=status_type.label if status_type else None,
        target_name=details["target_name"],
        target_email=details["target_email"],
        target_phone=details["target_phone"],
        target_type=details["target_type"],
    )


# ── PATCH /api/v1/blacklist/{id}/revoke ───────────────────────────────────────
@router.patch("/{blacklist_id}/revoke", response_model=BlacklistResponse)
def revoke_blacklist(
    blacklist_id: AutoStrUUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    blacklist = db.get(Blacklist, blacklist_id)
    if not blacklist or not blacklist.is_active:
        raise HTTPException(status_code=404, detail="Blacklist record tidak ditemukan atau sudah dicabut.")

    blacklist.is_active = False
    db.commit()
    db.refresh(blacklist)

    # Fetch target and PIC details
    details = _fetch_target_details(db, blacklist)
    status_type = db.get(BlacklistStatusType, blacklist.status_type_id)

    return BlacklistResponse(
        id=blacklist.id,
        candidate_id=blacklist.candidate_id,
        employee_id=blacklist.employee_id,
        status_type_id=blacklist.status_type_id,
        reason=blacklist.reason,
        notes=blacklist.notes,
        blacklisted_date=blacklist.blacklisted_date,
        pic_user_id=blacklist.pic_user_id,
        is_approved=blacklist.is_approved,
        approved_by=blacklist.approved_by,
        is_active=blacklist.is_active,
        created_at=blacklist.created_at,
        candidate_name=details["candidate_name"],
        candidate_email=details["candidate_email"],
        candidate_phone=details["candidate_phone"],
        employee_name=details["employee_name"],
        employee_email=details["employee_email"],
        employee_phone=details["employee_phone"],
        pic_name=details["pic_name"],
        status_type_label=status_type.label if status_type else None,
        target_name=details["target_name"],
        target_email=details["target_email"],
        target_phone=details["target_phone"],
        target_type=details["target_type"],
    )


# ── GET /api/v1/blacklist/check ───────────────────────────────────────────────
@router.get("/check")
def check_blacklist(
    email: str | None = Query(None),
    phone: str | None = Query(None),
    identity_no: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = []
    conditions = []
    if email:
        conditions.append(or_(Candidate.email == email, Employee.office_email == email))
    if phone:
        conditions.append(or_(Candidate.phone == phone, Employee.phone_number == phone))
    if identity_no:
        conditions.append(Candidate.identity_no == identity_no)  # only candidate has identity_no

    if not conditions:
        return {"matched": False, "candidates": []}

    # Find matching candidates
    cand_matches = db.execute(
        select(Candidate).where(or_(*conditions), Candidate.is_deleted == False)
    ).scalars().all()
    # Find matching employees (only email/phone)
    emp_conditions = []
    if email:
        emp_conditions.append(Employee.office_email == email)
    if phone:
        emp_conditions.append(Employee.phone_number == phone)
    emp_matches = []
    if emp_conditions:
        emp_matches = db.execute(
            select(Employee).where(or_(*emp_conditions))
        ).scalars().all()

    matches = []
    for c in cand_matches:
        entries = db.execute(
            select(Blacklist)
            .join(BlacklistStatusType)
            .where(
                Blacklist.candidate_id == c.id,
                Blacklist.is_active == True,
            )
        ).scalars().all()
        matches.append(
            {
                "candidate_id": str(c.id),
                "full_name": c.full_name,
                "email": c.email,
                "phone": c.phone,
                "identity_no": c.identity_no,
                "is_blacklisted": len(entries) > 0,
                "entries": [
                    {
                        "id": str(e.id),
                        "status_type": e.status_type.label if e.status_type else None,
                        "reason": e.reason,
                        "is_approved": e.is_approved,
                    }
                    for e in entries
                ],
            }
        )
    for e in emp_matches:
        entries = db.execute(
            select(Blacklist)
            .join(BlacklistStatusType)
            .where(
                Blacklist.employee_id == e.id,
                Blacklist.is_active == True,
            )
        ).scalars().all()
        matches.append(
            {
                "employee_id": str(e.id),
                "full_name": e.full_name,
                "email": e.office_email,
                "phone": e.phone_number,
                "identity_no": None,
                "is_blacklisted": len(entries) > 0,
                "entries": [
                    {
                        "id": str(e.id),
                        "status_type": e.status_type.label if e.status_type else None,
                        "reason": e.reason,
                        "is_approved": e.is_approved,
                    }
                    for e in entries
                ],
            }
        )

    return {"matched": len(matches) > 0, "candidates": matches}

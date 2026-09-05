from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.core.pydantic_utils import AutoStrUUID
from app.db.database import get_db
from app.models.blacklist import Blacklist, BlacklistStatusType
from app.models.candidate import Candidate
from app.models.user import User
from app.schemas.blacklist import BlacklistCreate, BlacklistWithCandidate

router = APIRouter()


# ── GET /api/v1/blacklist/ ────────────────────────────────────────────────────
@router.get("", response_model=list[BlacklistWithCandidate])
def list_blacklist(
    search: str | None = Query(None, description="Filter berdasarkan nama kandidat"),
    status_type_id: Optional[AutoStrUUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hr", "manager", "admin")),
):
    stmt = (
        select(Blacklist)
        .join(Candidate, Candidate.id == Blacklist.candidate_id)
        .join(BlacklistStatusType, BlacklistStatusType.id == Blacklist.status_type_id)
        .filter(Blacklist.is_active == True)
    )

    if search:
        stmt = stmt.where(
            or_(
                Candidate.full_name.ilike(f"%{search}%"),
                Candidate.email.ilike(f"%{search}%"),
            )
        )
    if status_type_id:
        stmt = stmt.where(Blacklist.status_type_id == status_type_id)

    rows = db.execute(stmt).scalars().all()

    return [
        BlacklistWithCandidate(
            id=row.id,
            candidate_id=row.candidate_id,
            status_type_id=row.status_type_id,
            reason=row.reason,
            notes=row.notes,
            blacklisted_date=row.blacklisted_date,
            pic_user_id=row.pic_user_id,
            is_approved=row.is_approved,
            approved_by=row.approved_by,
            is_active=row.is_active,
            created_at=row.created_at,
            candidate_name=row.candidate.full_name,
            candidate_email=row.candidate.email,
            candidate_phone=row.candidate.phone,
            status_type_label=row.status_type.label,
        )
        for row in rows
    ]


# ── POST /api/v1/blacklist/ ───────────────────────────────────────────────────
@router.post("", response_model=BlacklistWithCandidate, status_code=201)
def add_to_blacklist(
    payload: BlacklistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("hr", "manager", "admin")),
):
    # Validasi candidate exists
    candidate = db.execute(
        select(Candidate).where(Candidate.id == payload.candidate_id, Candidate.is_deleted == False)
    ).scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan.")

    # Validasi status_type exists
    status_type = db.execute(
        select(BlacklistStatusType).where(BlacklistStatusType.id == payload.status_type_id)
    ).scalar_one_or_none()
    if not status_type:
        raise HTTPException(status_code=404, detail="Status type tidak ditemukan.")

    # Cek duplikat
    existing = db.execute(
        select(Blacklist)
        .where(Blacklist.candidate_id == payload.candidate_id, Blacklist.is_active == True)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Kandidat ini sudah ada di blacklist.")

    blacklist = Blacklist(
        candidate_id=payload.candidate_id,
        status_type_id=payload.status_type_id,
        reason=payload.reason,
        notes=payload.notes,
        blacklisted_date=payload.blacklisted_date or date.today(),
        pic_user_id=current_user.id,
        is_approved=False,
    )
    db.add(blacklist)
    db.commit()
    db.refresh(blacklist)

    return BlacklistWithCandidate(
        id=blacklist.id,
        candidate_id=blacklist.candidate_id,
        status_type_id=blacklist.status_type_id,
        reason=blacklist.reason,
        notes=blacklist.notes,
        blacklisted_date=blacklist.blacklisted_date,
        pic_user_id=blacklist.pic_user_id,
        is_approved=blacklist.is_approved,
        approved_by=blacklist.approved_by,
        is_active=blacklist.is_active,
        created_at=blacklist.created_at,
        candidate_name=candidate.full_name,
        candidate_email=candidate.email,
        candidate_phone=candidate.phone,
        status_type_label=status_type.label,
    )


# ── PATCH /api/v1/blacklist/{id}/approve ──────────────────────────────────────
@router.patch("/{blacklist_id}/approve", response_model=BlacklistWithCandidate)
def approve_blacklist(
    blacklist_id: AutoStrUUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    blacklist = db.execute(
        select(Blacklist).where(Blacklist.id == blacklist_id, Blacklist.is_active == True)
    ).scalar_one_or_none()
    if not blacklist:
        raise HTTPException(status_code=404, detail="Blacklist record tidak ditemukan.")

    blacklist.is_approved = True
    blacklist.approved_by = current_user.id
    db.commit()
    db.refresh(blacklist)

    candidate = db.execute(
        select(Candidate).where(Candidate.id == blacklist.candidate_id)
    ).scalar_one()
    status_type = db.execute(
        select(BlacklistStatusType).where(BlacklistStatusType.id == blacklist.status_type_id)
    ).scalar_one()

    return BlacklistWithCandidate(
        id=blacklist.id,
        candidate_id=blacklist.candidate_id,
        status_type_id=blacklist.status_type_id,
        reason=blacklist.reason,
        notes=blacklist.notes,
        blacklisted_date=blacklist.blacklisted_date,
        pic_user_id=blacklist.pic_user_id,
        is_approved=blacklist.is_approved,
        approved_by=blacklist.approved_by,
        is_active=blacklist.is_active,
        created_at=blacklist.created_at,
        candidate_name=candidate.full_name,
        candidate_email=candidate.email,
        candidate_phone=candidate.phone,
        status_type_label=status_type.label,
    )


# ── PATCH /api/v1/blacklist/{id}/revoke ───────────────────────────────────────
@router.patch("/{blacklist_id}/revoke", response_model=BlacklistWithCandidate)
def revoke_blacklist(
    blacklist_id: AutoStrUUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager", "admin")),
):
    blacklist = db.execute(
        select(Blacklist).where(Blacklist.id == blacklist_id, Blacklist.is_active == True)
    ).scalar_one_or_none()
    if not blacklist:
        raise HTTPException(status_code=404, detail="Blacklist record tidak ditemukan atau sudah dicabut.")

    blacklist.is_active = False
    db.commit()
    db.refresh(blacklist)

    candidate = db.execute(
        select(Candidate).where(Candidate.id == blacklist.candidate_id)
    ).scalar_one()
    status_type = db.execute(
        select(BlacklistStatusType).where(BlacklistStatusType.id == blacklist.status_type_id)
    ).scalar_one()

    return BlacklistWithCandidate(
        id=blacklist.id,
        candidate_id=blacklist.candidate_id,
        status_type_id=blacklist.status_type_id,
        reason=blacklist.reason,
        notes=blacklist.notes,
        blacklisted_date=blacklist.blacklisted_date,
        pic_user_id=blacklist.pic_user_id,
        is_approved=blacklist.is_approved,
        approved_by=blacklist.approved_by,
        is_active=blacklist.is_active,
        created_at=blacklist.created_at,
        candidate_name=candidate.full_name,
        candidate_email=candidate.email,
        candidate_phone=candidate.phone,
        status_type_label=status_type.label,
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
        conditions.append(Candidate.email == email)
    if phone:
        conditions.append(Candidate.phone == phone)
    if identity_no:
        conditions.append(Candidate.identity_no == identity_no)

    if not conditions:
        return {"matched": False, "candidates": []}

    candidates = db.execute(
        select(Candidate).where(or_(*conditions), Candidate.is_deleted == False)
    ).scalars().all()

    for c in candidates:
        entries = db.execute(
            select(Blacklist)
            .join(BlacklistStatusType)
            .where(
                Blacklist.candidate_id == c.id,
                Blacklist.is_active == True,
            )
        ).scalars().all()
        results.append(
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

    return {"matched": len(results) > 0, "candidates": results}

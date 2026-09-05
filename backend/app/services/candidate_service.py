"""Business logic untuk manajemen kandidat."""
from sqlalchemy.orm import Session

from app.models.blacklist import Blacklist, BlacklistStatusType
from app.models.candidate import Candidate


def check_duplicate(db: Session, email: str | None, phone: str | None, identity_no: str | None) -> dict:
    """
    Cek duplikat kandidat berdasarkan email, phone, atau identity_no (KTP).
    Return: { "is_duplicate": bool, "existing_id": str | None }
    """
    existing = None
    if email:
        existing = db.query(Candidate).filter(Candidate.email == email).first()
    if not existing and phone:
        existing = db.query(Candidate).filter(Candidate.phone == phone).first()
    if not existing and identity_no:
        existing = db.query(Candidate).filter(Candidate.identity_no == identity_no).first()
    return {
        "is_duplicate": existing is not None,
        "existing_id": existing.id if existing else None,
    }


def check_blacklist(db: Session, email: str | None, phone: str | None, identity_no: str | None) -> dict:
    """
    Cek apakah kandidat match dengan blacklist aktif.
    Return: { "is_blacklisted": bool, "blacklist_entries": list[dict] }
    """
    matches: list[dict] = []

    if email:
        candidates = db.query(Candidate).filter(Candidate.email == email).all()
        for c in candidates:
            entries = (
                db.query(Blacklist)
                .join(BlacklistStatusType)
                .filter(
                    Blacklist.candidate_id == c.id,
                    Blacklist.is_active == True,
                    Blacklist.is_approved == True,
                    BlacklistStatusType.is_active == True,
                )
                .all()
            )
            matches.extend([{"candidate_id": str(e.candidate_id), "type": e.status_type.label, "reason": e.reason} for e in entries])

    if phone:
        candidates = db.query(Candidate).filter(Candidate.phone == phone).all()
        for c in candidates:
            entries = (
                db.query(Blacklist)
                .join(BlacklistStatusType)
                .filter(
                    Blacklist.candidate_id == c.id,
                    Blacklist.is_active == True,
                    Blacklist.is_approved == True,
                    BlacklistStatusType.is_active == True,
                )
                .all()
            )
            matches.extend([{"candidate_id": str(e.candidate_id), "type": e.status_type.label, "reason": e.reason} for e in entries])

    if identity_no:
        candidates = db.query(Candidate).filter(Candidate.identity_no == identity_no).all()
        for c in candidates:
            entries = (
                db.query(Blacklist)
                .join(BlacklistStatusType)
                .filter(
                    Blacklist.candidate_id == c.id,
                    Blacklist.is_active == True,
                    Blacklist.is_approved == True,
                    BlacklistStatusType.is_active == True,
                )
                .all()
            )
            matches.extend([{"candidate_id": str(e.candidate_id), "type": e.status_type.label, "reason": e.reason} for e in entries])

    return {
        "is_blacklisted": len(matches) > 0,
        "blacklist_entries": matches,
    }

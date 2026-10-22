"""Business logic untuk manajemen kandidat."""
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.phone_utils import normalize_phone, phone_variants
from app.models.blacklist import Blacklist, BlacklistStatusType
from app.models.candidate import Candidate


def check_duplicate(
    db: Session,
    email: str | None,
    phone: str | None,
    identity_no: str | None,
    exclude_candidate_id: str | None = None,
) -> dict:
    """
    Cek duplikat kandidat berdasarkan email, phone, atau identity_no (KTP).
    Phone matching uses all normalised variants so that '+62812...' and '0812...'
    are treated as the same number.
    Return: { "is_duplicate": bool, "existing_id": str | None }
    """
    existing = None
    candidate_id_to_exclude = str(exclude_candidate_id) if exclude_candidate_id else None

    if email:
        existing = db.query(Candidate).filter(Candidate.email == email).first()
    if not existing and phone:
        variants = phone_variants(phone)
        if variants:
            existing = (
                db.query(Candidate)
                .filter(Candidate.phone.in_(variants))
                .first()
            )
    if not existing and identity_no:
        existing = db.query(Candidate).filter(Candidate.identity_no == identity_no).first()

    if existing and candidate_id_to_exclude and str(existing.id) == candidate_id_to_exclude:
        existing = None

    return {
        "is_duplicate": existing is not None,
        "existing_id": str(existing.id) if existing else None,
    }


def check_blacklist(db: Session, email: str | None, phone: str | None, identity_no: str | None) -> dict:
    """
    Cek apakah kandidat match dengan blacklist aktif.
    Phone matching uses all normalised variants so that '+62812...' and '0812...'
    are treated as the same number.
    Return: { "is_blacklisted": bool, "blacklist_entries": list[dict] }
    """
    matches: list[dict] = []
    seen_candidate_ids: set[str] = set()

    def _collect(candidates: list) -> None:
        for c in candidates:
            cid = str(c.id)
            if cid in seen_candidate_ids:
                continue
            seen_candidate_ids.add(cid)
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
            matches.extend([
                {"candidate_id": cid, "type": e.status_type.label, "reason": e.reason}
                for e in entries
            ])

    if email:
        _collect(db.query(Candidate).filter(Candidate.email == email).all())

    if phone:
        variants = phone_variants(phone)
        if variants:
            _collect(
                db.query(Candidate).filter(Candidate.phone.in_(variants)).all()
            )

    if identity_no:
        _collect(db.query(Candidate).filter(Candidate.identity_no == identity_no).all())

    return {
        "is_blacklisted": len(matches) > 0,
        "blacklist_entries": matches,
    }

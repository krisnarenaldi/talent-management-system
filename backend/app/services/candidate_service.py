"""Business logic untuk manajemen kandidat."""
import re
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.blacklist import Blacklist, BlacklistStatusType
from app.models.candidate import Candidate


def normalize_phone(phone: str | None) -> str | None:
    """
    Normalise phone number:
    - Remove all spaces and hyphens.
    - If number starts with +62 (Indonesian country code), replace with 08.
    - Foreign country codes (+xx other than +62) are left as-is after
      stripping internal spaces/hyphens.
    """
    if not phone:
        return phone
    normalized = re.sub(r"[\s\-]", "", phone.strip())
    if normalized.startswith("+62"):
        normalized = "0" + normalized[3:]
    return normalized


def _phone_variants(phone: str | None) -> list[str]:
    """
    Return all known storage variants for a phone number so that queries can
    match even when old records were stored with a different format.

    Examples:
      "08118842060"   → ["08118842060", "+628118842060"]
      "+62 811-8842"  → ["08118842",    "+628118842"]   (after normalisation)
      "+1-650-5551234"→ ["+16505551234"]                (foreign — only one variant)
    """
    if not phone:
        return []
    norm = normalize_phone(phone)
    if norm is None:
        return []
    variants: list[str] = [norm]
    # If the normalised form starts with 0, also include the +62 variant
    if norm.startswith("0"):
        variants.append("+62" + norm[1:])
    return variants


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
        variants = _phone_variants(phone)
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
        variants = _phone_variants(phone)
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

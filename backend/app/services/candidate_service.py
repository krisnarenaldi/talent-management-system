"""Business logic untuk manajemen kandidat."""
from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.models.blacklist import Blacklist


def check_duplicate(db: Session, email: str | None, phone: str | None) -> dict:
    """
    Cek apakah kandidat dengan email/phone sudah ada.
    Return: { "is_duplicate": bool, "possible_duplicate": bool, "existing_id": str | None }
    TODO: TASK-04.1
    """
    raise NotImplementedError("TODO: implementasi duplikat check")


def check_blacklist(
    db: Session,
    email: str | None = None,
    phone: str | None = None,
    identity_no: str | None = None,
) -> dict:
    """
    Cek apakah kandidat match dengan daftar blacklist.
    Return: { "is_blacklisted": bool, "blacklist_entries": list }
    TODO: TASK-04.1
    """
    raise NotImplementedError("TODO: implementasi blacklist check")

"""Business logic untuk modul karyawan."""
from datetime import date

from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.employee import Employee


def create_from_application(db: Session, application_id: str) -> Employee:
    """
    Auto-create Employee record saat Application mencapai tahap 'Existing'.
    Idempotent: skip jika Employee dengan application_id ini sudah ada.
    TODO: TASK-05.2
    """
    # Cek idempotency
    existing = db.query(Employee).filter(Employee.application_id == application_id).first()
    if existing:
        return existing

    raise NotImplementedError("TODO: implementasi auto-create employee dari application")


def calculate_age(birth_date: date) -> int | None:
    """Hitung usia dari tanggal lahir — tidak disimpan statis di DB."""
    if not birth_date:
        return None
    today = date.today()
    return today.year - birth_date.year - (
        (today.month, today.day) < (birth_date.month, birth_date.day)
    )


def calculate_contract_duration(join_date: date, end_date: date | None = None) -> int | None:
    """
    Hitung masa kontrak berjalan dalam bulan.
    Tidak disimpan statis di DB — dihitung saat query.
    """
    if not join_date:
        return None
    end = end_date or date.today()
    months = (end.year - join_date.year) * 12 + (end.month - join_date.month)
    return max(months, 0)

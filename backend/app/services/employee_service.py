"""Business logic untuk modul karyawan."""
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.employee import Employee, EmployeeContract


def create_from_application(db: Session, application_id: str) -> Employee:
    """
    Auto-create Employee record saat Application mencapai tahap 'Existing'.
    Idempotent: skip jika Employee dengan application_id ini sudah ada.
    """
    # Cek idempotency
    existing = db.query(Employee).filter(Employee.application_id == application_id).first()
    if existing:
        return existing

    # Ambil application dan candidate
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise ValueError(f"Application {application_id} tidak ditemukan")

    candidate = db.query(Candidate).filter(Candidate.id == application.candidate_id).first()
    if not candidate:
        raise ValueError(f"Candidate {application.candidate_id} tidak ditemukan")

    # Buat Employee record, salin data dari candidate + application position
    employee = Employee(
        candidate_id=candidate.id,
        application_id=application_id,
        full_name=candidate.full_name,
        identity_no=candidate.identity_no,
        phone_number=candidate.phone,
        birth_date=candidate.birth_date,
        birth_place=candidate.birth_place,
        gender=candidate.gender,
        blood_type=candidate.blood_type,
        placement=application.position.client_name if application.position else None,
        role_level=application.position.title if application.position else None,
        employee_status="aktif",
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


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


def get_employee_details(db: Session, employee_id: str):
    """
    Get employee with computed fields: age and contract_duration_running.
    Contract duration running is calculated from the active contract's join_date.
    """
    employee = (
        db.query(Employee)
        .options(
            joinedload(Employee.contracts),
            joinedload(Employee.payroll),
            joinedload(Employee.documents),
        )
        .filter(Employee.id == employee_id)
        .first()
    )
    if not employee:
        return None

    # Calculate age
    age = calculate_age(employee.birth_date)

    # Calculate contract duration running from active contract
    contract_duration_running = None
    active_contract = None
    for contract in employee.contracts:
        if contract.status == "aktif":
            active_contract = contract
            break
    if active_contract and active_contract.join_date:
        contract_duration_running = calculate_contract_duration(active_contract.join_date)

    # Attach computed fields to the employee object (for response)
    employee.age = age
    employee.contract_duration_running = contract_duration_running

    return employee
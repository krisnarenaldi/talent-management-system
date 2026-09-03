import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base

EMPLOYEE_STATUSES = ("aktif", "cuti", "resign")
LEAVE_STATUSES = ("sudah_bisa_cuti", "belum")
CONTRACT_STATUSES = ("aktif", "berakhir", "diperpanjang")


class AgreementType(Base):
    """Jenis perjanjian Altek-Client: PKWT, PKWTT, PPJP, dll — master data."""
    __tablename__ = "agreement_type"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    label = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    creator = relationship("User", foreign_keys=[created_by])


class Employee(Base):
    __tablename__ = "employee"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidate.id"), nullable=False, index=True)
    application_id = Column(UUID(as_uuid=True), ForeignKey("application.id"), unique=True, nullable=True)

    employee_nip = Column(String(100), unique=True)
    full_name = Column(String(255), nullable=False)
    birth_date = Column(Date)              # Usia dihitung otomatis dari sini, tidak disimpan statis
    birth_place = Column(String(255))
    gender = Column(String(20))
    blood_type = Column(String(5))
    personal_email = Column(String(255))
    office_email = Column(String(255))
    phone_number = Column(String(50))
    placement = Column(String(255))        # Site/divisi di client
    role_level = Column(String(255))
    employee_status = Column(
        Enum(*EMPLOYEE_STATUSES, name="employee_status_enum"),
        default="aktif",
    )
    leave_status = Column(
        Enum(*LEAVE_STATUSES, name="leave_status_enum"),
        default="belum",
    )
    resign_date = Column(Date)
    resign_reason = Column(String(500))
    notes = Column(Text)                   # Catatan HR/PM
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    candidate = relationship("Candidate", backref="employees")
    contracts = relationship("EmployeeContract", back_populates="employee", cascade="all, delete-orphan")
    payroll = relationship("EmployeePayroll", back_populates="employee", uselist=False, cascade="all, delete-orphan")
    documents = relationship("EmployeeDocument", back_populates="employee", cascade="all, delete-orphan")


class EmployeeContract(Base):
    __tablename__ = "employee_contract"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employee.id", ondelete="CASCADE"), nullable=False, index=True)
    agreement_type_id = Column(UUID(as_uuid=True), ForeignKey("agreement_type.id"), nullable=True)
    contract_number = Column(String(100))
    duration_months = Column(Integer)
    join_date = Column(Date)
    end_date = Column(Date)                # Masa berjalan dihitung otomatis dari join_date, tidak disimpan statis
    status = Column(
        Enum(*CONTRACT_STATUSES, name="contract_status_enum"),
        default="aktif",
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", back_populates="contracts")
    agreement_type = relationship("AgreementType")


class EmployeePayroll(Base):
    """Data payroll sensitif — akses dibatasi ke Manager & Admin."""
    __tablename__ = "employee_payroll"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employee.id", ondelete="CASCADE"), unique=True, nullable=False)
    thp = Column(Numeric(15, 2))
    allowance_used = Column(Text)           # Tunjangan/pinjaman
    payroll_bank = Column(String(100))
    bank_account_number = Column(String(100))
    bpjs_tk_status = Column(String(50))
    bpjs_tk_number = Column(String(100))
    bpjs_kesehatan_status = Column(String(50))
    bpjs_kesehatan_number = Column(String(100))
    npwp_number = Column(String(50))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    employee = relationship("Employee", back_populates="payroll")


class EmployeeDocument(Base):
    __tablename__ = "employee_document"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employee.id", ondelete="CASCADE"), nullable=False, index=True)
    # Tipe: CV_terupdate, CV_template_Altek, Offering_Payslip, Application_Form, KK, KTP, Ijazah, Transkrip,
    #        Kartu_BPJS_TK, Kartu_BPJS_Kesehatan, NPWP
    doc_type = Column(String(100), nullable=False)
    file_url = Column(String(500))
    drive_item_id = Column(String(500))
    is_verified = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", back_populates="documents")

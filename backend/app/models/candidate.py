import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base

COMPLETENESS_STATUS = ("lengkap", "belum_lengkap")
CONTACT_STATUS = ("aktif", "tidak_bisa_dihubungi")


class Candidate(Base):
    __tablename__ = "candidate"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), index=True)
    phone = Column(String(50), index=True)
    identity_no = Column(String(20), index=True)        # NIK KTP
    domicile = Column(String(255))
    photo_url = Column(String(500))
    source_channel = Column(String(100))                 # LinkedIn/Glints/Email/dll
    current_salary = Column(Numeric(15, 2))
    expected_salary = Column(Numeric(15, 2))
    notice_period_days = Column(Integer)
    completeness_status = Column(
        Enum(*COMPLETENESS_STATUS, name="completeness_status_enum"),
        default="belum_lengkap",
    )
    contact_status = Column(
        Enum(*CONTACT_STATUS, name="contact_status_enum"),
        default="aktif",
    )
    possible_duplicate = Column(Boolean, default=False, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    notes = Column(Text)                                 # Catatan bebas recruiter
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    educations = relationship("CandidateEducation", back_populates="candidate", cascade="all, delete-orphan")
    experiences = relationship("CandidateExperience", back_populates="candidate", cascade="all, delete-orphan")
    documents = relationship("CandidateDocument", back_populates="candidate", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="candidate")
    blacklists = relationship("Blacklist", back_populates="candidate")


class CandidateEducation(Base):
    __tablename__ = "candidate_education"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidate.id", ondelete="CASCADE"), nullable=False, index=True)
    institution = Column(String(255))
    major = Column(String(255))
    graduation_year = Column(Integer)
    gpa = Column(Numeric(3, 2))

    candidate = relationship("Candidate", back_populates="educations")


class CandidateExperience(Base):
    __tablename__ = "candidate_experience"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidate.id", ondelete="CASCADE"), nullable=False, index=True)
    company_name = Column(String(255))
    job_title = Column(String(255))
    start_date = Column(Date)
    end_date = Column(Date)    # NULL = masih bekerja
    description = Column(Text)

    candidate = relationship("Candidate", back_populates="experiences")


class CandidateDocument(Base):
    __tablename__ = "candidate_document"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidate.id", ondelete="CASCADE"), nullable=False, index=True)
    # Tipe dokumen: CV_asli, Foto, KTP, KK, Ijazah, Transkrip, Sertifikat, BI_Checking
    doc_type = Column(String(100), nullable=False)
    file_url = Column(String(500))           # OneDrive drive item ID atau URL referensi
    drive_item_id = Column(String(500))      # Microsoft Graph drive item ID
    is_verified = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    candidate = relationship("Candidate", back_populates="documents")

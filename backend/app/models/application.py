import uuid

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base

APPLICATION_STATUSES = ("active", "rejected", "hired", "withdrawn")

# Urutan tahapan pipeline
STAGE_NAMES = (
    "Dijadwalkan_Interview",
    "Konfirmasi_Kehadiran",
    "Interview_HR",
    "Psikotest",
    "Interview_User",
    "Offering",
    "Tanda_Tangan_Kontrak",
    "Onboarding",
    "Existing",
)


class Application(Base):
    __tablename__ = "application"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidate.id"), nullable=False, index=True)
    position_id = Column(UUID(as_uuid=True), ForeignKey("position.id"), nullable=False, index=True)
    recruiter_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=True)
    current_stage = Column(String(100), default="Dijadwalkan_Interview")
    status = Column(
        Enum(*APPLICATION_STATUSES, name="application_status_enum"),
        default="active",
        nullable=False,
    )
    cv_submitted_to_pm_date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    candidate = relationship("Candidate", back_populates="applications")
    position = relationship("Position", backref="applications")
    recruiter = relationship("User", foreign_keys=[recruiter_id])
    stage_histories = relationship("StageHistory", back_populates="application", cascade="all, delete-orphan")
    ai_screening_result = relationship("AIScreeningResult", back_populates="application", uselist=False)


class StageHistory(Base):
    __tablename__ = "stage_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey("application.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_name = Column(String(100), nullable=False)
    scheduled_date = Column(Date)
    actual_date = Column(Date)
    # result: pass/fail/lolos/negosiasi/reschedule/lanjut/not_recommended/ok/not_ok
    result = Column(String(50))
    salary_current_input = Column(Numeric(15, 2))
    salary_expected_input = Column(Numeric(15, 2))
    notes = Column(Text)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("Application", back_populates="stage_histories")
    updater = relationship("User", foreign_keys=[updated_by])


class AIScreeningResult(Base):
    __tablename__ = "ai_screening_result"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey("application.id"), unique=True, nullable=False)
    match_score = Column(Numeric(5, 2))
    ai_notes = Column(Text)
    extracted_data = Column(Text)   # JSON string hasil ekstraksi field CV
    model_used = Column(String(100))
    review_status = Column(String(50), default="pending")  # pending / reviewed / rejected
    scored_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("Application", back_populates="ai_screening_result")

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

VALID_TRANSITIONS = {
    "Dijadwalkan_Interview": ["Konfirmasi_Kehadiran"],
    "Konfirmasi_Kehadiran": ["Interview_HR"],
    "Interview_HR": ["Psikotest", "Interview_User"],
    "Psikotest": ["Interview_User"],
    "Interview_User": ["Offering", "Rejected"],
    "Offering": ["Tanda_Tangan_Kontrak"],
    "Tanda_Tangan_Kontrak": ["Onboarding"],
    "Onboarding": ["Existing"],
    "Existing": [],
}

TERMINAL_STATUSES = ("rejected", "withdrawn", "hired")  # status ini tidak bisa lanjut/update stage lagi
TERMINAL_STAGES = ("Rejected", "Withdrawn", "Existing")  # stage terminal (Existing = sudah hired)


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

    @property
    def candidate_name(self) -> str | None:
        return self.candidate.full_name if self.candidate else None

    @property
    def position_title(self) -> str | None:
        return self.position.title if self.position else None

    @property
    def client_name(self) -> str | None:
        return self.position.client_name if self.position else None

    @property
    def recruiter_name(self) -> str | None:
        return self.recruiter.name if self.recruiter else None

    @property
    def stage_history(self) -> list:
        return self.stage_histories or []

    @property
    def next_possible_stages(self) -> list[str]:
        # Jika sudah terminal (status rejected/withdrawn/hired) atau stage-nya terminal,
        # tidak ada stage lanjutan yang valid
        if self.status in ("rejected", "withdrawn", "hired"):
            return []
        if self.current_stage in ("Rejected", "Withdrawn", "Existing"):
            return []
        transitions = VALID_TRANSITIONS.get(self.current_stage, [])
        return transitions + ["Rejected", "Withdrawn"]


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

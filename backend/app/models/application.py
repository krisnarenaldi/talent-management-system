import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, Enum, Float, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
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

# Hasil yang dianggap "fail hard" — stage terkunci setelah ini, tidak bisa maju
FAIL_RESULTS = frozenset({"fail", "tidak_lolos"})


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
    def last_result(self) -> str | None:
        """Result terbaru dari current_stage (dari stage_history)."""
        if not self.stage_histories:
            return None
        relevant = [h for h in self.stage_histories if h.stage_name == self.current_stage and h.result]
        if not relevant:
            return None
        return sorted(relevant, key=lambda h: h.created_at or datetime.min.replace(tzinfo=timezone.utc))[-1].result

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
    # handler_id: user HR/Manager yang menangani tahapan ini (bisa beda dari recruiter utama)
    handler_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("Application", back_populates="stage_histories")
    updater = relationship("User", foreign_keys=[updated_by])
    handler = relationship("User", foreign_keys=[handler_id])

    @property
    def handler_name(self) -> str | None:
        return self.handler.name if self.handler else None


class AIScreeningResult(Base):
    __tablename__ = "ai_screening_result"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey("application.id"), nullable=True, index=True)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidate.id", ondelete="SET NULL"), nullable=True, index=True)
    position_id = Column(UUID(as_uuid=True), ForeignKey("position.id", ondelete="SET NULL"), nullable=True, index=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True)
    cv_file_url = Column(String(2048), nullable=True)
    cv_drive_item_id = Column(String(500), nullable=True)
    source_channel = Column(String(100), nullable=True)  # LinkedIn/Glints/Email/dll — sumber kandidat
    ai_score = Column(Float, nullable=True)
    ai_notes = Column(Text, nullable=True)
    extracted_json = Column(JSONB(), nullable=True)
    status = Column(String(50), nullable=True, index=True)  # menunggu_screening_ai / sedang_diproses / siap_review / sudah_direview / error
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    application = relationship("Application", back_populates="ai_screening_result")
    candidate = relationship("Candidate")
    position = relationship("Position")
    uploader = relationship("User", foreign_keys=[uploaded_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])

import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class CandidateProject(Base):
    __tablename__ = "candidate_project"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(
        UUID(as_uuid=True),
        ForeignKey("candidate.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_name = Column(String(255), nullable=False)
    role = Column(String(255))
    summary = Column(Text)
    impact = Column(Text)
    tech_stack = Column(JSONB, default=list, nullable=True)  # e.g. ["python", "react"]
    duration = Column(String(100))
    is_draft = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    candidate = relationship("Candidate", back_populates="projects")

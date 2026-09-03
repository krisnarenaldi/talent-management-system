import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class GeneratedCV(Base):
    __tablename__ = "generated_cv"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidate.id"), nullable=False, index=True)
    application_id = Column(UUID(as_uuid=True), ForeignKey("application.id"), nullable=True)
    template_used = Column(String(255))
    language = Column(String(10), default="ID")      # ID atau EN
    summary_source = Column(String(20))               # "AI" atau "HR"
    summary_text = Column(Text)
    file_url = Column(String(500))                    # OneDrive drive item ID
    drive_item_id = Column(String(500))
    generated_at = Column(DateTime(timezone=True), server_default=func.now())

    candidate = relationship("Candidate", backref="generated_cvs")

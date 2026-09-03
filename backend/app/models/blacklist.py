import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class BlacklistStatusType(Base):
    __tablename__ = "blacklist_status_type"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    label = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    creator = relationship("User", foreign_keys=[created_by])


class Blacklist(Base):
    __tablename__ = "blacklist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidate.id"), nullable=False, index=True)
    status_type_id = Column(UUID(as_uuid=True), ForeignKey("blacklist_status_type.id"), nullable=False)
    reason = Column(String(500))
    notes = Column(Text)
    blacklisted_date = Column(Date)
    pic_user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=True)
    # Approval flow
    is_approved = Column(Boolean, default=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)  # False = dicabut
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    candidate = relationship("Candidate", back_populates="blacklists")
    status_type = relationship("BlacklistStatusType")
    pic = relationship("User", foreign_keys=[pic_user_id])
    approver = relationship("User", foreign_keys=[approved_by])

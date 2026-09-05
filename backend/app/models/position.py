import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class Position(Base):
    __tablename__ = "position"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("client.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    requirement = Column(Text)
    employment_type = Column(String(100))       # PKWT, PKWTT, dll
    contract_duration_months = Column(Integer)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    client = relationship("Client", backref="positions")

    @property
    def client_name(self) -> str | None:
        return self.client.name if self.client else None

import uuid

from sqlalchemy import Boolean, Column, DateTime, String, UUID, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.db.database import Base


class RefreshToken(Base):
    __tablename__ = "refresh_token"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        PG_UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    token = Column(String(512), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

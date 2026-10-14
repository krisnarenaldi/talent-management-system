import uuid

from sqlalchemy import Column, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base


class OpenAIUsageLog(Base):
    __tablename__ = "openai_usage_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Token counts dari response.usage OpenAI
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)

    # Model yang dipakai (misal: gpt-4o-mini)
    model = Column(String(100), nullable=False)

    # Siapa yang trigger (bisa null jika background job)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    # Konteks pemanggilan: "nl_search", "cv_pipeline", dll.
    call_type = Column(String(50), nullable=False, default="nl_search")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class Position(Base):
    __tablename__ = "position"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("client.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    requirement = Column(Text)
    job_description = Column(Text, nullable=True)
    employment_type = Column(String(100))       # PKWT, PKWTT, dll
    contract_duration_months = Column(Integer)
    salary_budget = Column(Numeric(15, 2), nullable=True)
    location = Column(String(255), nullable=True)
    client_user_names = Column(JSONB, default=list, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    ai_scoring_config = Column(JSONB, nullable=True)  # threshold, weights, required_skills, min_experience_years
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    client = relationship("Client", backref="positions")

    @property
    def client_name(self) -> str | None:
        return self.client.name if self.client else None

    @property
    def pic_names(self) -> list[str]:
        """Daftar nama PIC klien yang ditugaskan pada posisi ini."""
        return [str(name) for name in (self.client_user_names or []) if str(name).strip()]

    def resolve_pic_name(self, name: str | None = None) -> str | None:
        """Ambil nama PIC posisi sesuai nama yang diminta (case-insensitive).

        Jika ``name`` kosong, PIC pertama pada posisi yang dikembalikan. PIC yang
        tidak terdaftar pada posisi ini menghasilkan ``None``.
        """
        pics = self.pic_names
        if not pics:
            return None
        if name:
            target = str(name).strip().lower()
            for pic in pics:
                if pic.strip().lower() == target:
                    return pic
            return None
        return pics[0]

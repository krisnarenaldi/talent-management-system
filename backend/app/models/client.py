import uuid

from sqlalchemy import Boolean, Column, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.db.database import Base


class Client(Base):
    __tablename__ = "client"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    industry = Column(String(255))
    pic_name = Column(String(255))
    pic_contact = Column(String(500))
    # Daftar PIC dalam bentuk terstruktur: [{"name": "...", "contact": "..."}]
    # Menyimpan nama & kontak per baris agar keduanya tidak saling terpisah
    # (pic_name/pic_contact lama masih dipakai sebagai kolom kompatibilitas).
    pics = Column(JSONB, default=list, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

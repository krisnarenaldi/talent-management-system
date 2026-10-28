import uuid

from sqlalchemy import Column, DateTime, String, Text, func

from app.db.database import Base


class AppSetting(Base):
    """Key-value store untuk konfigurasi aplikasi yang bisa diubah lewat UI."""
    __tablename__ = "app_settings"

    key   = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

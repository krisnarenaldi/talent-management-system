"""Seed initial source channels for the application."""
import sys
import os

# Tambah path agar bisa import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.candidate import SourceChannel

DEFAULT_SOURCES = [
    "LinkedIn",
    "Glints",
    "JobStreet",
    "Email",
    "Referral",
    "Instagram",
    "Website Perusahaan",
]


def seed_source_channels():
    db: Session = SessionLocal()
    try:
        # Cek apakah sudah ada data
        existing = db.query(SourceChannel).count()
        if existing > 0:
            print(f"Source channels sudah ada ({existing} data), skip seeding.")
            return

        for label in DEFAULT_SOURCES:
            channel = SourceChannel(label=label)
            db.add(channel)

        db.commit()
        print(f"✅ Berhasil men-seed {len(DEFAULT_SOURCES)} source channels:")
        for label in DEFAULT_SOURCES:
            print(f"   - {label}")
    except Exception as e:
        db.rollback()
        print(f"❌ Gagal seeding source channels: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_source_channels()

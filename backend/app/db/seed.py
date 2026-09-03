"""
Seed data awal untuk TMS.
Jalankan: python -m app.db.seed
Idempotent — aman dijalankan berkali-kali.
"""
import uuid

from app.core.security import hash_password
from app.db.database import SessionLocal
from app.models.blacklist import BlacklistStatusType
from app.models.employee import AgreementType
from app.models.user import User


def seed():
    db = SessionLocal()
    try:
        # --- Admin user awal ---
        if not db.query(User).filter(User.email == "admin@altek.id").first():
            db.add(User(
                id=uuid.uuid4(),
                name="Admin Altek",
                email="admin@altek.id",
                hashed_password=hash_password("admin123!"),  # GANTI sebelum production
                role="admin",
                is_active=True,
            ))
            print("✓ Seed: Admin user dibuat (admin@altek.id / admin123!)")

        # --- Blacklist Status Types (5 default dari PRD) ---
        default_statuses = [
            "Menolak Offer Tanpa Alasan Jelas",
            "Tidak Hadir Interview Tanpa Konfirmasi (No-Show)",
            "Terbukti Manipulasi Data",
            "Bermasalah di Tempat Kerja Client",
            "Referensi Negatif",
        ]
        for label in default_statuses:
            if not db.query(BlacklistStatusType).filter(BlacklistStatusType.label == label).first():
                db.add(BlacklistStatusType(id=uuid.uuid4(), label=label, is_active=True))
        print(f"✓ Seed: {len(default_statuses)} blacklist status types")

        # --- Agreement Types ---
        default_agreements = [
            "PKWT (Perjanjian Kerja Waktu Tertentu)",
            "PKWTT (Perjanjian Kerja Waktu Tidak Tertentu)",
            "PPJP (Perjanjian Pemborongan Jasa Pekerjaan)",
            "Perjanjian Outsourcing",
        ]
        for label in default_agreements:
            if not db.query(AgreementType).filter(AgreementType.label == label).first():
                db.add(AgreementType(id=uuid.uuid4(), label=label, is_active=True))
        print(f"✓ Seed: {len(default_agreements)} agreement types")

        db.commit()
        print("\n✅ Seed selesai.")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()

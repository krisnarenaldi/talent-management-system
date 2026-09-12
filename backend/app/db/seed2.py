"""
Seed data awal untuk TMS.
Jalankan: python -m app.db.seed
Idempotent — aman dijalankan berkali-kali.
"""
from datetime import date
import uuid
import random

from app.core.security import hash_password
from app.db.database import SessionLocal
from app.models.blacklist import Blacklist, BlacklistStatusType
from app.models.employee import AgreementType
from app.models.user import User
from app.models.candidate import Candidate


def seed_candidates(db):
    """Seed data untuk tabel candidate dan blacklist."""
    # List dummy candidates
    candidates_data = [
        {"full_name": "Budi Santoso", "email": "budi.santoso@email.com", "phone": "081234567890", "city": "Jakarta"},
        {"full_name": "Siti Aminah", "email": "siti.aminah@email.com", "phone": "082123456789", "city": "Bandung"},
        {"full_name": "Andi Wijaya", "email": "andi.wijaya@email.com", "phone": "083123456789", "city": "Surabaya"},
        {"full_name": "Dewi Lestari", "email": "dewi.lestari@email.com", "phone": "084123456789", "city": "Medan"},
        {"full_name": "Eko Prasetyo", "email": "eko.prasetyo@email.com", "phone": "085123456789", "city": "Semarang"},
        {"full_name": "Rina Kartika", "email": "rina.kartika@email.com", "phone": "086123456789", "city": "Yogyakarta"},
        {"full_name": "Agus Setiawan", "email": "agus.setiawan@email.com", "phone": "087123456789", "city": "Makassar"},
        {"full_name": "Maya Indah", "email": "maya.indah@email.com", "phone": "088123456789", "city": "Denpasar"},
        {"full_name": "Heri Kurniawan", "email": "heri.kurniawan@email.com", "phone": "089123456789", "city": "Palembang"},
        {"full_name": "Linda Sari", "email": "linda.sari@email.com", "phone": "090123456789", "city": "Balikpapan"},
        {"full_name": "Rizky Pratama", "email": "rizky.pratama@email.com", "phone": "091123456789", "city": "Banjarmasin"},
        {"full_name": "Siska Putri", "email": "siska.putri@email.com", "phone": "092123456789", "city": "Manado"},
        {"full_name": "Joko Susilo", "email": "joko.susilo@email.com", "phone": "093123456789", "city": "Solo"},
        {"full_name": "Anita Wijaya", "email": "anita.wijaya@email.com", "phone": "094123456789", "city": "Malang"},
        {"full_name": "Ferry Irawan", "email": "ferry.irawan@email.com", "phone": "095123456789", "city": "Pontianak"},
    ]

    admin = db.query(User).filter(User.role == "admin").first()
    status_types = db.query(BlacklistStatusType).all()

    for i, data in enumerate(candidates_data):
        # Check if candidate already exists
        existing = db.query(Candidate).filter(Candidate.email == data["email"]).first()
        if not existing:
            candidate = Candidate(
                id=uuid.uuid4(),
                full_name=data["full_name"],
                email=data["email"],
                phone=data["phone"],
                identity_no=f"320101{random.randint(1000000000, 9999999999)}",
                birth_date=date(1990 + random.randint(0, 10), random.randint(1, 12), random.randint(1, 28)),
                birth_place=data["city"],
                gender=random.choice(["Laki-laki", "Perempuan"]),
                domicile=data["city"],
                source_channel=random.choice(["LinkedIn", "Glints", "JobStreet", "Referral"]),
                current_salary=random.randint(5, 15) * 1000000,
                expected_salary=random.randint(7, 20) * 1000000,
                notice_period_days=30,
                completeness_status=random.choice(["lengkap", "belum_lengkap"]),
                contact_status="aktif",
            )
            db.add(candidate)
            db.flush()  # To get the ID            
    
    db.commit()


def seed():
    db = SessionLocal()
    try:
        # --- Admin user awal ---
        admin_email = "admin@altek.id"
        admin = db.query(User).filter(User.email == admin_email).first()
        if not admin:
            admin = User(
                id=uuid.uuid4(),
                name="Admin Altek",
                email=admin_email,
                hashed_password=hash_password("admin123!"),  # GANTI sebelum production
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print(f"✓ Seed: Admin user dibuat ({admin_email} / admin123!)")

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
        db.commit()
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
        db.commit()
        print(f"✓ Seed: {len(default_agreements)} agreement types")

        # --- Candidates & Blacklist ---
        seed_candidates(db)

        print("\n✅ Seed selesai.")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()

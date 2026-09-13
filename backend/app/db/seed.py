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
        {"full_name": "Budi Santoso", "email": "budi.santoso@email.com", "phone": "081234567890", "city": "Jakarta", "skills": ["PHP", "Laravel", "MySQL", "Git"]},
        {"full_name": "Siti Aminah", "email": "siti.aminah@email.com", "phone": "082123456789", "city": "Bandung", "skills": ["Next.js", "React", "TypeScript", "Tailwind CSS"]},
        {"full_name": "Andi Wijaya", "email": "andi.wijaya@email.com", "phone": "083123456789", "city": "Surabaya", "skills": ["Python", "Django", "PostgreSQL", "Docker"]},
        {"full_name": "Dewi Lestari", "email": "dewi.lestari@email.com", "phone": "084123456789", "city": "Medan", "skills": ["Java", "Spring Boot", "Microservices", "Kubernetes"]},
        {"full_name": "Eko Prasetyo", "email": "eko.prasetyo@email.com", "phone": "085123456789", "city": "Semarang", "skills": ["React Native", "Flutter", "iOS", "Android"]},
        {"full_name": "Rina Kartika", "email": "rina.kartika@email.com", "phone": "086123456789", "city": "Yogyakarta", "skills": ["UI/UX Design", "Figma", "Adobe XD", "Prototyping"]},
        {"full_name": "Agus Setiawan", "email": "agus.setiawan@email.com", "phone": "087123456789", "city": "Makassar", "skills": ["Node.js", "Express.js", "MongoDB", "REST API"]},
        {"full_name": "Maya Indah", "email": "maya.indah@email.com", "phone": "088123456789", "city": "Denpasar", "skills": ["Data Analysis", "Python", "Tableau", "SQL", "Fluent English"]},
        {"full_name": "Heri Kurniawan", "email": "heri.kurniawan@email.com", "phone": "089123456789", "city": "Palembang", "skills": ["PHP", "CodeIgniter", "jQuery", "Bootstrap"]},
        {"full_name": "Linda Sari", "email": "linda.sari@email.com", "phone": "090123456789", "city": "Balikpapan", "skills": ["Golang", "Gin", "Redis", "gRPC", "Docker"]},
        {"full_name": "Rizky Pratama", "email": "rizky.pratama@email.com", "phone": "091123456789", "city": "Banjarmasin", "skills": ["Vue.js", "Nuxt.js", "JavaScript", "CSS3"]},
        {"full_name": "Siska Putri", "email": "siska.putri@email.com", "phone": "092123456789", "city": "Manado", "skills": ["HR Management", "Recruitment", "Microsoft Excel", "Bahasa Inggris Aktif"]},
        {"full_name": "Joko Susilo", "email": "joko.susilo@email.com", "phone": "093123456789", "city": "Solo", "skills": ["DevOps", "AWS", "CI/CD", "Terraform", "Linux"]},
        {"full_name": "Anita Wijaya", "email": "anita.wijaya@email.com", "phone": "094123456789", "city": "Malang", "skills": ["Machine Learning", "TensorFlow", "Python", "Data Science"]},
        {"full_name": "Ferry Irawan", "email": "ferry.irawan@email.com", "phone": "095123456789", "city": "Pontianak", "skills": ["Project Management", "Scrum", "JIRA", "Agile"]},
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
                skills=data.get("skills", []),
            )
            db.add(candidate)
            db.flush()  # To get the ID

            # Blacklist some candidates (e.g., indices 0, 5, 10)
            if i % 5 == 0 and status_types and admin:
                blacklist_entry = Blacklist(
                    id=uuid.uuid4(),
                    candidate_id=candidate.id,
                    status_type_id=random.choice(status_types).id,
                    reason="Seed data for testing blacklist menu",
                    notes="Testing blacklist feature from seed script",
                    blacklisted_date=date.today(),
                    pic_user_id=admin.id,
                    is_approved=True,
                    approved_by=admin.id,
                    is_active=True
                )
                db.add(blacklist_entry)
                print(f"✓ Seed: Candidate {data['full_name']} created and blacklisted")
            else:
                print(f"✓ Seed: Candidate {data['full_name']} created")
    
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

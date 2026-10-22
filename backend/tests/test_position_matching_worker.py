"""
Test untuk arq task `process_position_matching` (FR-03.10).

Fokus:
- Job terdaftar di WorkerSettings (BUG-2: job yang di-enqueue tapi worker tidak tahu)
- Skor AI disimpan pada AIScreeningResult dengan status 'siap_review'
- Error LLM tidak menjatuhkan worker (status 'error' + pesan tersimpan)
- Notifikasi terkirim ke recruiter
"""
import unittest
from datetime import date
from types import SimpleNamespace
from uuid import UUID

from app import worker as worker_module
from app.services import cv_pipeline


class FakeColumn:
    def __init__(self, name):
        self.name = name

    def __eq__(self, other):
        return ("eq", self.name, other)

    def __hash__(self):
        return hash(self.name)


class FakeQuery:
    def __init__(self, db, model):
        self.db = db
        self.model = model

    def filter(self, condition):
        record = self.db.records.get(self.model._key)
        if record is None:
            return FakeQuery(self.db, SimpleNamespace(_key=None))
        if isinstance(condition, tuple):
            _, field, value = condition
            # Bandingkan sebagai string agar UUID vs str tetap cocok.
            if str(getattr(record, field, None)) != str(value):
                return FakeQuery(self.db, SimpleNamespace(_key=None))
        return self

    def first(self):
        return self.db.records.get(self.model._key)


class FakeDB:
    def __init__(self, records=None):
        self.records = records or {}
        self.added = []
        self.commits = 0
        self.closed = False

    def query(self, model):
        return FakeQuery(self, model)

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.commits += 1

    def refresh(self, _obj):
        return None

    def close(self):
        self.closed = True


APP_ID = UUID("11111111-1111-1111-1111-111111111111")
CANDIDATE_ID = UUID("22222222-2222-2222-2222-222222222222")
POSITION_ID = UUID("33333333-3333-3333-3333-333333333333")
RECRUITER_ID = UUID("44444444-4444-4444-4444-444444444444")


def _fake_model(key, **columns):
    """
    Model palsu yang bisa dipanggil sebagai konstruktor (seperti model SQLAlchemy)
    sekaligus menyediakan kolom FakeColumn untuk query.
    """

    def factory(**kwargs):
        return SimpleNamespace(_key=key, **kwargs)

    for name in columns:
        setattr(factory, name, FakeColumn(name))
    factory._key = key
    return factory


def _make_models():
    """Model palsu dengan kolom FakeColumn supaya bisa dibandingkan tanpa DB."""
    return {
        "app": _fake_model("app", id="id"),
        "screening": _fake_model("screening", id="id", application_id="application_id"),
        "candidate": _fake_model("candidate", id="id"),
        "position": _fake_model("position", id="id"),
    }


class PositionMatchingWorkerTest(unittest.TestCase):
    def setUp(self):
        self.models = _make_models()
        self._orig_attrs = {
            name: getattr(cv_pipeline, name)
            for name in ("SessionLocal", "Application", "AIScreeningResult", "Candidate", "Position")
        }
        cv_pipeline.Application = self.models["app"]
        cv_pipeline.AIScreeningResult = self.models["screening"]
        cv_pipeline.Candidate = self.models["candidate"]
        cv_pipeline.Position = self.models["position"]

        self.position = SimpleNamespace(
            id=POSITION_ID,
            title="Backend Engineer",
            requirement="Minimal 3 tahun pengalaman Go",
            job_description="Membangun microservice",
            ai_scoring_config={"required_skills": ["Go"]},
        )
        self.candidate = SimpleNamespace(
            id=CANDIDATE_ID,
            full_name="Rahmat Surahmat",
            email="rahmat@example.com",
            phone="081234567890",
            skills=["Go", "PostgreSQL"],
            educations=[
                SimpleNamespace(
                    institution="ITB",
                    major="Informatika",
                    graduation_year=2018,
                    gpa=3.5,
                )
            ],
            experiences=[
                SimpleNamespace(
                    company_name="Tokopedia",
                    job_title="Backend Engineer",
                    start_date=date(2020, 1, 1),
                    end_date=date(2023, 1, 1),
                    description="Membangun service pembayaran",
                )
            ],
        )
        self.application = SimpleNamespace(
            id=APP_ID,
            candidate_id=CANDIDATE_ID,
            position_id=POSITION_ID,
            recruiter_id=RECRUITER_ID,
            position=self.position,
        )

        self.db = FakeDB(
            records={
                "app": self.application,
                "candidate": self.candidate,
                "position": self.position,
            }
        )
        cv_pipeline.SessionLocal = lambda: self.db

        self._orig_screen = cv_pipeline._call_llm_screen

    def tearDown(self):
        for name, value in self._orig_attrs.items():
            setattr(cv_pipeline, name, value)
        cv_pipeline._call_llm_screen = self._orig_screen

    def test_task_is_registered_in_worker_settings(self):
        names = [fn.__name__ for fn in worker_module.WorkerSettings.functions]
        self.assertIn("process_position_matching", names)

    def test_profile_computes_total_experience_years(self):
        profile = cv_pipeline._build_candidate_profile(self.candidate)
        self.assertEqual(profile["nama"], "Rahmat Surahmat")
        self.assertEqual(profile["skills"], ["Go", "PostgreSQL"])
        self.assertEqual(profile["total_experience_years"], 3.0)
        self.assertEqual(len(profile["pengalaman_kerja"]), 1)

    def test_success_path_persists_score_and_notifies_recruiter(self):
        async def fake_screen(extracted, scoring_config, was_truncated, **kwargs):
            self.assertEqual(scoring_config, {"required_skills": ["Go"]})
            self.assertEqual(kwargs["position_title"], "Backend Engineer")
            self.assertEqual(extracted["skills"], ["Go", "PostgreSQL"])
            return 85.0, "Kuat di Go dan PostgreSQL"

        cv_pipeline._call_llm_screen = fake_screen

        import asyncio

        asyncio.run(cv_pipeline.process_position_matching({}, str(APP_ID)))

        screening = next(
            (obj for obj in self.db.added if getattr(obj, "status", None) == "siap_review"),
            None,
        )
        self.assertIsNotNone(screening, "AIScreeningResult harus dibuat dengan status siap_review")
        self.assertEqual(screening.ai_score, 85.0)
        self.assertEqual(screening.ai_notes, "Kuat di Go dan PostgreSQL")
        self.assertEqual(screening.application_id, APP_ID)
        self.assertEqual(screening.candidate_id, CANDIDATE_ID)
        self.assertEqual(screening.position_id, POSITION_ID)

        notifications = [obj for obj in self.db.added if getattr(obj, "user_id", None) == RECRUITER_ID]
        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0].link, f"/applications/{APP_ID}")

    def test_llm_failure_marks_screening_as_error(self):
        async def failing_screen(*_args, **_kwargs):
            raise RuntimeError("OpenAI timeout")

        cv_pipeline._call_llm_screen = failing_screen

        import asyncio

        asyncio.run(cv_pipeline.process_position_matching({}, str(APP_ID)))

        screening = next(
            (obj for obj in self.db.added if getattr(obj, "status", None) == "error"),
            None,
        )
        self.assertIsNotNone(screening, "AIScreeningResult harus berstatus error")
        self.assertIn("OpenAI timeout", screening.ai_notes)

    def test_missing_application_exits_without_raising(self):
        self.db.records.pop("app")

        import asyncio

        asyncio.run(cv_pipeline.process_position_matching({}, str(APP_ID)))

        self.assertEqual(self.db.added, [])


if __name__ == "__main__":
    unittest.main()

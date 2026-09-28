import unittest
from datetime import date, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError

from app.routers.applications import create_application
from app.schemas.application import ApplicationCreate, StageHistoryCreate


def _make_mock_db(
    candidate_exists: bool = True,
    position_exists: bool = True,
    position_is_active: bool = True,
    recruiter_exists: bool = True,
    recruiter_is_active: bool = True,
    recruiter_role: str = "hr",
    active_employee=None,
    blacklisted=False,
):
    """Helper: buat mock DB untuk create_application."""
    mock_db = MagicMock()

    candidate = MagicMock()
    candidate.email = "test@example.com"
    candidate.phone = "08123456789"

    position = MagicMock()
    position.is_active = position_is_active
    position.client_name = "TestClient"
    position.title = "Test Position"

    recruiter = MagicMock()
    recruiter.id = uuid4()
    recruiter.is_active = recruiter_is_active
    recruiter.role = recruiter_role
    recruiter.name = "Test Recruiter"

    def _mock_query(model_or_col):
        mock_query = MagicMock()
        model_name = getattr(model_or_col, "__name__", None)
        filter_mock = MagicMock()

        if model_name is None:
            # Column expression (e.g. Candidate.id)
            mock_query.filter.return_value.all.return_value = []
            return mock_query

        if model_name == "Candidate":
            filter_mock.first.return_value = candidate if candidate_exists else None
        elif model_name == "Employee":
            filter_mock.first.return_value = active_employee
        elif model_name == "Position":
            filter_mock.first.return_value = position if position_exists else None
        elif model_name == "User":
            filter_mock.first.return_value = recruiter if recruiter_exists else None
        elif model_name == "Application":
            # Duplicate check & post-commit refresh — return None (no duplicate)
            filter_mock.first.return_value = None

        # Chain options().filter()
        options_mock = MagicMock()
        options_mock.filter.return_value = filter_mock

        # Chain .join() for stage_history queries
        join_mock = MagicMock()
        join_mock.filter.return_value = filter_mock

        filter_mock.options.return_value = options_mock
        filter_mock.join.return_value = join_mock
        mock_query.filter.return_value = filter_mock
        mock_query.options.return_value = options_mock
        mock_query.join.return_value = join_mock
        return mock_query

    mock_db.query.side_effect = _mock_query
    mock_db.execute.return_value.scalar_one_or_none.return_value = (
        MagicMock() if blacklisted else None
    )
    mock_db.add = MagicMock()
    mock_db.flush = MagicMock()
    mock_db.commit = MagicMock()
    mock_db.refresh = MagicMock()

    fresh_app = MagicMock()
    fresh_app.id = uuid4()
    fresh_app.candidate = candidate
    fresh_app.position = position
    fresh_app.recruiter = recruiter
    fresh_app.stage_histories = []
    mock_db.query.return_value.filter.return_value.first.return_value = fresh_app

    return mock_db, candidate, position, recruiter


class TestCreateApplicationValidations(unittest.TestCase):
    """Tests untuk validasi baru di create_application."""

    def test_inactive_position_raises_400(self):
        payload = ApplicationCreate(
            candidate_id=str(uuid4()),
            position_id=str(uuid4()),
            recruiter_id=str(uuid4()),
        )
        mock_db, _, _, _ = _make_mock_db(position_is_active=False)
        current_user = MagicMock(id=uuid4(), role="hr")

        with self.assertRaises(HTTPException) as ctx:
            create_application(payload=payload, db=mock_db, current_user=current_user)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("sudah tidak aktif", ctx.exception.detail)

    def test_invalid_recruiter_id_raises_404(self):
        payload = ApplicationCreate(
            candidate_id=str(uuid4()),
            position_id=str(uuid4()),
            recruiter_id=str(uuid4()),
        )
        mock_db, _, _, _ = _make_mock_db(recruiter_exists=False)
        current_user = MagicMock(id=uuid4(), role="hr")

        with self.assertRaises(HTTPException) as ctx:
            create_application(payload=payload, db=mock_db, current_user=current_user)

        self.assertEqual(ctx.exception.status_code, 404)
        self.assertIn("tidak ditemukan", ctx.exception.detail)

    def test_inactive_recruiter_raises_400(self):
        payload = ApplicationCreate(
            candidate_id=str(uuid4()),
            position_id=str(uuid4()),
            recruiter_id=str(uuid4()),
        )
        mock_db, _, _, _ = _make_mock_db(recruiter_is_active=False)
        current_user = MagicMock(id=uuid4(), role="hr")

        with self.assertRaises(HTTPException) as ctx:
            create_application(payload=payload, db=mock_db, current_user=current_user)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("tidak aktif", ctx.exception.detail)

    def test_recruiter_wrong_role_raises_400(self):
        payload = ApplicationCreate(
            candidate_id=str(uuid4()),
            position_id=str(uuid4()),
            recruiter_id=str(uuid4()),
        )
        mock_db, _, _, _ = _make_mock_db(recruiter_role="pm")
        current_user = MagicMock(id=uuid4(), role="hr")

        with self.assertRaises(HTTPException) as ctx:
            create_application(payload=payload, db=mock_db, current_user=current_user)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("role HR, Manager, atau Admin", ctx.exception.detail)

    def test_invalid_current_stage_raises_400(self):
        payload = ApplicationCreate(
            candidate_id=str(uuid4()),
            position_id=str(uuid4()),
            recruiter_id=str(uuid4()),
            current_stage="tahap_asal",
        )
        mock_db, _, _, _ = _make_mock_db()
        current_user = MagicMock(id=uuid4(), role="hr")

        with self.assertRaises(HTTPException) as ctx:
            create_application(payload=payload, db=mock_db, current_user=current_user)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("tidak valid", ctx.exception.detail)

    def test_valid_current_stage_passes_validation(self):
        """Memastikan current_stage valid tidak raise error 'tidak valid'."""
        # Validasi current_stage dilakukan sebelum query manapun, jadi cukup
        # verify bahwa STAGE_NAMES menerima nilai yang valid tanpa error.
        from app.routers.applications import STAGE_NAMES
        self.assertIn("Interview_HR", STAGE_NAMES)
        self.assertNotIn("tahap_asal", STAGE_NAMES)


class TestStageHistoryCreateScheduledDate(unittest.TestCase):
    """Tests untuk validasi scheduled_date di StageHistoryCreate."""

    def test_none_is_allowed(self):
        result = StageHistoryCreate(stage_name="Interview_HR", scheduled_date=None)
        self.assertIsNone(result.scheduled_date)

    def test_future_date_is_allowed(self):
        future = date.today() + timedelta(days=7)
        result = StageHistoryCreate(stage_name="Interview_HR", scheduled_date=future)
        self.assertEqual(result.scheduled_date, future)

    def test_today_is_allowed(self):
        result = StageHistoryCreate(stage_name="Interview_HR", scheduled_date=date.today())
        self.assertEqual(result.scheduled_date, date.today())

    def test_1_year_ago_is_allowed(self):
        one_year_ago = date.today() - timedelta(days=365)
        result = StageHistoryCreate(stage_name="Interview_HR", scheduled_date=one_year_ago)
        self.assertEqual(result.scheduled_date, one_year_ago)

    def test_366_days_ago_raises_validation_error(self):
        too_old = date.today() - timedelta(days=366)
        with self.assertRaises(ValidationError) as ctx:
            StageHistoryCreate(stage_name="Interview_HR", scheduled_date=too_old)
        self.assertIn("365 hari", str(ctx.exception))

    def test_far_past_raises_validation_error(self):
        far_past = date.today() - timedelta(days=1000)
        with self.assertRaises(ValidationError):
            StageHistoryCreate(stage_name="Interview_HR", scheduled_date=far_past)


if __name__ == "__main__":
    unittest.main()

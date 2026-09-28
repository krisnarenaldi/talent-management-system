from datetime import datetime, timedelta, timezone
import unittest
from unittest.mock import MagicMock
from uuid import uuid4

from fastapi import HTTPException
from app.routers.applications import create_application
from app.schemas.application import ApplicationCreate


def _make_application_mock_db(
    recent_rejected_app=None,
    active_failed_app=None,
    existing_active_app=None,
):
    """
    Construye un mock_db que simula el comportamiento de la DB para tests de cooldown.

    - recent_rejected_app: Application mock con status='rejected' para el candidato
    - active_failed_app:   Application mock con status='active' y stage fallado
    - existing_active_app: Application mock con status='active' (para test de duplicado activo)
    """
    mock_db = MagicMock()

    candidate = MagicMock()
    candidate.email = "test@example.com"
    candidate.phone = "08123456789"

    position = MagicMock()

    # Track call count to distinguish the two Application queries inside
    # _find_cooldown_blocking_application:
    #   1st query(Application) → .filter(...).order_by(...).first() → rejected path
    #   2nd query(Application) → .join(...).filter(...).order_by(...).first() → failed_active path
    #   (before those) query(Application) for active duplicate check
    application_query_call_count = [0]

    def query_side_effect(model_or_col):
        mock_query = MagicMock()
        # Handle query(Candidate.id) for _get_sibling_candidate_ids
        model_name = getattr(model_or_col, "__name__", None)
        if model_name is None:
            # It's a column expression (Candidate.id), return empty list
            mock_query.filter.return_value.all.return_value = []
            return mock_query

        if model_name == "Candidate":
            mock_query.filter.return_value.first.return_value = candidate
        elif model_name == "Employee":
            mock_query.filter.return_value.first.return_value = None
        elif model_name == "Position":
            mock_query.filter.return_value.first.return_value = position
        elif model_name == "Application":
            application_query_call_count[0] += 1
            call_num = application_query_call_count[0]

            filter_mock = MagicMock()

            if call_num == 1:
                # Active duplicate check — returns existing_active_app (or None)
                filter_mock.first.return_value = existing_active_app
            elif call_num == 2:
                # _find_cooldown_blocking_application: rejected query
                filter_mock.first.return_value = None  # filter() without order_by
                filter_mock.order_by.return_value.first.return_value = recent_rejected_app
            elif call_num == 3:
                # _find_cooldown_blocking_application: failed_active query (.join chain)
                # join() returns a new mock, .filter().order_by().first() → active_failed_app
                join_mock = MagicMock()
                join_mock.filter.return_value.order_by.return_value.first.return_value = active_failed_app
                mock_query.join.return_value = join_mock
            else:
                # Any subsequent Application queries (e.g. options().filter().first() after commit)
                filter_mock.first.return_value = MagicMock()
                filter_mock.order_by.return_value.first.return_value = None
                mock_query.options.return_value.filter.return_value.first.return_value = MagicMock()

            mock_query.filter.return_value = filter_mock
            mock_query.options.return_value = filter_mock

        return mock_query

    mock_db.query.side_effect = query_side_effect
    mock_db.execute.return_value.scalar_one_or_none.return_value = None

    return mock_db, candidate, position


def _make_application_mock_db_with_recruiter(
    recent_rejected_app=None,
    active_failed_app=None,
    existing_active_app=None,
    recruiter_role: str = "hr",
):
    """Wrapper that also sets up a valid recruiter for the new recruiter validation."""
    mock_db, candidate, position = _make_application_mock_db(
        recent_rejected_app=recent_rejected_app,
        active_failed_app=active_failed_app,
        existing_active_app=existing_active_app,
    )
    # Inject a valid recruiter into the User query path
    recruiter = MagicMock()
    recruiter.id = uuid4()
    recruiter.is_active = True
    recruiter.role = recruiter_role
    recruiter.name = "Test Recruiter"

    original_side_effect = mock_db.query.side_effect

    def side_effect_with_recruiter(model_or_col):
        result = original_side_effect(model_or_col)
        if getattr(model_or_col, "__name__", None) == "User":
            result.filter.return_value.first.return_value = recruiter
        return result

    mock_db.query.side_effect = side_effect_with_recruiter
    return mock_db, candidate, position


class ApplicationCooldownTest(unittest.TestCase):
    def test_reapply_within_cooldown_raises_400(self):
        candidate_id = str(uuid4())
        position_id = str(uuid4())
        recruiter_id = str(uuid4())

        payload = ApplicationCreate(
            candidate_id=candidate_id,
            position_id=position_id,
            recruiter_id=recruiter_id,
            force_cooldown=False,
        )

        recent_rejected_app = MagicMock()
        recent_rejected_app.updated_at = datetime.now(timezone.utc) - timedelta(days=10)
        recent_rejected_app.created_at = datetime.now(timezone.utc) - timedelta(days=10)

        mock_db, _, _ = _make_application_mock_db_with_recruiter(recent_rejected_app=recent_rejected_app)
        current_user = MagicMock(id=uuid4())

        with self.assertRaises(HTTPException) as ctx:
            create_application(payload=payload, db=mock_db, current_user=current_user)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("pernah ditolak untuk posisi ini", ctx.exception.detail)

    def test_reapply_with_force_cooldown_bypasses_check(self):
        candidate_id = str(uuid4())
        position_id = str(uuid4())
        recruiter_id = str(uuid4())

        payload = ApplicationCreate(
            candidate_id=candidate_id,
            position_id=position_id,
            recruiter_id=recruiter_id,
            force_cooldown=True,
        )

        mock_db, _, _ = _make_application_mock_db_with_recruiter()
        current_user = MagicMock(id=uuid4())

        try:
            create_application(payload=payload, db=mock_db, current_user=current_user)
        except HTTPException as exc:
            self.assertNotEqual(exc.status_code, 400)
            self.assertNotIn("pernah ditolak", exc.detail)

    def test_reapply_interview_hr_within_cooldown_raises_400(self):
        candidate_id = str(uuid4())
        position_id = str(uuid4())
        recruiter_id = str(uuid4())

        payload = ApplicationCreate(
            candidate_id=candidate_id,
            position_id=position_id,
            recruiter_id=recruiter_id,
            current_stage="Interview_HR",
            force_cooldown=False,
        )

        recent_rejected_app = MagicMock()
        recent_rejected_app.updated_at = datetime.now(timezone.utc) - timedelta(days=5)
        recent_rejected_app.created_at = datetime.now(timezone.utc) - timedelta(days=5)

        mock_db, _, _ = _make_application_mock_db_with_recruiter(recent_rejected_app=recent_rejected_app)
        current_user = MagicMock(id=uuid4())

        with self.assertRaises(HTTPException) as ctx:
            create_application(payload=payload, db=mock_db, current_user=current_user)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("pernah ditolak untuk posisi ini", ctx.exception.detail)

    def test_reapply_with_active_failed_stage_raises_400(self):
        """
        Kandidat belum di-Reject secara formal (application.status masih 'active')
        tapi current stage sudah di-mark fail/tidak_lolos → harus kena cooldown.
        """
        candidate_id = str(uuid4())
        position_id = str(uuid4())
        recruiter_id = str(uuid4())

        payload = ApplicationCreate(
            candidate_id=candidate_id,
            position_id=position_id,
            recruiter_id=recruiter_id,
            force_cooldown=False,
        )

        active_failed_app = MagicMock()
        active_failed_app.updated_at = datetime.now(timezone.utc) - timedelta(days=3)
        active_failed_app.created_at = datetime.now(timezone.utc) - timedelta(days=3)

        mock_db, _, _ = _make_application_mock_db_with_recruiter(active_failed_app=active_failed_app)
        current_user = MagicMock(id=uuid4())

        with self.assertRaises(HTTPException) as ctx:
            create_application(payload=payload, db=mock_db, current_user=current_user)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("pernah ditolak untuk posisi ini", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()

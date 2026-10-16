import datetime
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.candidate import Candidate
from app.models.candidate_project import CandidateProject
from app.models.generated_cv import GeneratedCV
from app.services import cv_generator_service


class TestGenerateCVHistory(unittest.IsolatedAsyncioTestCase):
    async def test_regeneration_inserts_new_version_and_preserves_previous_record(self):
        candidate_id = "candidate-id"
        now = datetime.datetime.now(datetime.timezone.utc)
        candidate = MagicMock()
        candidate.full_name = "Test Candidate"
        candidate.updated_at = now
        candidate.educations = []
        candidate.experiences = []
        candidate.skills = []
        candidate.birth_date = None
        candidate.photo_url = None

        previous_cv = MagicMock()
        previous_cv.generated_at = now - datetime.timedelta(days=1)
        previous_cv.summary_text = "Previous summary"
        previous_cv.summary_source = "HR"

        db = MagicMock()

        def query_side_effect(model):
            query = MagicMock()
            if model is Candidate:
                query.options.return_value.filter.return_value.first.return_value = candidate
            elif model is CandidateProject:
                query.filter.return_value.order_by.return_value.all.return_value = []
            elif model is GeneratedCV:
                query.filter.return_value.order_by.return_value.first.return_value = previous_cv
            else:
                self.fail(f"Unexpected query for {model}")
            return query

        db.query.side_effect = query_side_effect
        storage = MagicMock()
        storage.upload = AsyncMock(
            return_value={"file_url": "new-cv.pdf", "drive_item_id": "new-drive-item"}
        )

        with (
            patch.object(cv_generator_service, "_load_image_as_base64", return_value=(None, None)),
            patch.object(
                cv_generator_service,
                "_classify_skills",
                return_value={
                    "programming": [],
                    "database": [],
                    "other_tech": [],
                    "soft": [],
                },
            ),
            patch.object(cv_generator_service, "_load_attachment_docs", return_value=[]),
            patch.object(cv_generator_service, "_render_pdf", return_value=b"%PDF"),
            patch.object(cv_generator_service, "get_storage_service", return_value=storage),
        ):
            generated_cv = await cv_generator_service.generate_cv(
                db=db,
                candidate_id=candidate_id,
                language="ID",
                position_title="Engineer",
            )

        db.add.assert_called_once_with(generated_cv)
        db.flush.assert_called_once()
        self.assertIsInstance(generated_cv, GeneratedCV)
        self.assertIsNot(generated_cv, previous_cv)
        self.assertEqual(generated_cv.candidate_id, candidate_id)
        self.assertEqual(generated_cv.summary_text, "Previous summary")
        self.assertEqual(generated_cv.file_url, "new-cv.pdf")
        self.assertEqual(previous_cv.summary_text, "Previous summary")
        storage.upload.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()

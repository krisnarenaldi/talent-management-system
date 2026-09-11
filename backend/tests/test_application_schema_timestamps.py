import unittest
from datetime import datetime

from app.schemas.application import ApplicationResponse, StageHistoryResponse


class ApplicationTimestampValidationTest(unittest.TestCase):
    def test_stage_history_response_ignores_invalid_timestamp(self):
        payload = {
            "id": "11111111-1111-4111-8111-111111111111",
            "application_id": "22222222-2222-4222-8222-222222222222",
            "stage_name": "Interview_HR",
            "scheduled_date": None,
            "actual_date": None,
            "result": "pass",
            "salary_current_input": None,
            "salary_expected_input": None,
            "notes": "OK",
            "updated_by": None,
            "created_at": "not-a-date",
        }

        response = StageHistoryResponse.model_validate(payload)
        self.assertIsNone(response.created_at)

    def test_application_response_coerces_missing_timestamp_to_none(self):
        payload = {
            "id": "33333333-3333-4333-8333-333333333333",
            "candidate_id": "44444444-4444-4444-8444-444444444444",
            "candidate_name": "Jane Doe",
            "position_id": "55555555-5555-4555-8555-555555555555",
            "position_title": "Backend Engineer",
            "client_name": "Acme",
            "recruiter_id": None,
            "recruiter_name": None,
            "current_stage": "Interview_HR",
            "status": "active",
            "cv_submitted_to_pm_date": None,
            "created_at": "2026-09-10T08:00:00+00:00",
            "updated_at": "bad timestamp",
            "stage_history": [],
            "next_possible_stages": ["Psikotest"],
        }

        response = ApplicationResponse.model_validate(payload)
        self.assertIsInstance(response.created_at, datetime)
        self.assertIsNone(response.updated_at)


if __name__ == "__main__":
    unittest.main()

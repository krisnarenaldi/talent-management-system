import json
import unittest

from app.services.ai_service import parse_project_drafts_response


class DraftProjectParsingTest(unittest.TestCase):
    def test_parse_project_drafts_response_accepts_structured_json(self):
        payload = {
            "drafts": [
                {
                    "project_name": "TMS Dashboard",
                    "role": "Backend Engineer",
                    "summary": "Membangun dashboard untuk manajemen kandidat dan pipeline.",
                    "impact": "Meningkatkan visibilitas pipeline dan mempercepat review recruiter.",
                    "tech_stack": ["Python", "FastAPI", "PostgreSQL"],
                    "duration": "2025"
                }
            ]
        }

        parsed = parse_project_drafts_response(json.dumps(payload))

        self.assertEqual(parsed["drafts"][0]["project_name"], "TMS Dashboard")
        self.assertIn("FastAPI", parsed["drafts"][0]["tech_stack"])


if __name__ == "__main__":
    unittest.main()

import unittest
from datetime import datetime
from decimal import Decimal
from io import BytesIO
from unittest.mock import MagicMock, patch
from uuid import uuid4
import openpyxl

from app.services.export_service import _get_excel_response_for_candidates


class CandidateExportServiceTest(unittest.TestCase):
    def test_city_filter_specific_city_applies_domicile_ilike(self):
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = []

        _get_excel_response_for_candidates(mock_db, city="Jakarta")

        filter_calls = mock_query.filter.call_args_list
        compiled_calls = [
            str(call[0][0].compile(compile_kwargs={"literal_binds": True})).lower()
            for call in filter_calls
        ]
        domicile_filter_found = any(
            "domicile" in s and "jakarta" in s
            for s in compiled_calls
        )

        self.assertTrue(domicile_filter_found, f"Filter for city=Jakarta not found in {compiled_calls}")

    def test_city_filter_jabotabek_applies_jabotabek_condition(self):
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = []

        _get_excel_response_for_candidates(mock_db, city="Jabotabek")

        filter_calls = mock_query.filter.call_args_list
        compiled_calls = [
            str(call[0][0].compile(compile_kwargs={"literal_binds": True})).lower()
            for call in filter_calls
        ]
        jabotabek_filter_found = any(
            "jakarta" in s and "bogor" in s and "depok" in s
            for s in compiled_calls
        )

        self.assertTrue(jabotabek_filter_found, f"Filter for Jabotabek not found in {compiled_calls}")

    def test_city_filter_non_jabotabek_applies_negated_condition(self):
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = []

        _get_excel_response_for_candidates(mock_db, city="non_jabotabek")

        filter_calls = mock_query.filter.call_args_list
        compiled_calls = [
            str(call[0][0].compile(compile_kwargs={"literal_binds": True})).lower()
            for call in filter_calls
        ]
        negated_found = any(
            "not" in s and "jakarta" in s
            for s in compiled_calls
        )

        self.assertTrue(negated_found, f"Filter for non_jabotabek not found in {compiled_calls}")

    def test_salary_filters_applied_correctly(self):
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = []

        _get_excel_response_for_candidates(
            mock_db,
            min_current_salary=Decimal("5000000"),
            max_current_salary=Decimal("10000000"),
            min_expected_salary=Decimal("7000000"),
            max_expected_salary=Decimal("15000000"),
        )

        filter_calls = mock_query.filter.call_args_list
        salary_filters = [str(c[0][0]).lower() for c in filter_calls]

        has_min_current = any("current_salary >=" in s or "candidate.current_salary >=" in s for s in salary_filters)
        has_max_current = any("current_salary <=" in s or "candidate.current_salary <=" in s for s in salary_filters)
        has_min_expected = any("expected_salary >=" in s or "candidate.expected_salary >=" in s for s in salary_filters)
        has_max_expected = any("expected_salary <=" in s or "candidate.expected_salary <=" in s for s in salary_filters)

        self.assertTrue(has_min_current, f"min_current_salary filter missing: {salary_filters}")
        self.assertTrue(has_max_current, f"max_current_salary filter missing: {salary_filters}")
        self.assertTrue(has_min_expected, f"min_expected_salary filter missing: {salary_filters}")
        self.assertTrue(has_max_expected, f"max_expected_salary filter missing: {salary_filters}")

    def test_candidate_export_generates_valid_xlsx_with_matching_records(self):
        candidate1 = MagicMock()
        candidate1.id = uuid4()
        candidate1.full_name = "Muhamad Rifa James"
        candidate1.email = "mrifajames@gmail.com"
        candidate1.phone = "087881914525"
        candidate1.identity_no = "317500903000005"
        candidate1.birth_place = "Jakarta"
        candidate1.birth_date = "1995-05-10"
        candidate1.gender = "Laki-laki"
        candidate1.blood_type = "O"
        candidate1.domicile = "Jakarta Selatan"
        candidate1.source_channel = "Glints"
        candidate1.current_salary = Decimal("10000000")
        candidate1.expected_salary = Decimal("15000000")
        candidate1.notice_period_days = 30
        candidate1.completeness_status = "belum_lengkap"
        candidate1.contact_status = "aktif"
        candidate1.notes = "Good candidate"
        candidate1.created_at = datetime(2026, 10, 1, 10, 0, 0)
        candidate1.updated_at = datetime(2026, 10, 2, 10, 0, 0)
        candidate1.documents = []
        candidate1.educations = []
        candidate1.experiences = []

        candidate2 = MagicMock()
        candidate2.id = uuid4()
        candidate2.full_name = "Bayu Sulistyo"
        candidate2.email = "bayusulistyo1797@gmail.com"
        candidate2.phone = "085882170170"
        candidate2.identity_no = "7778811124412"
        candidate2.birth_place = "Jakarta"
        candidate2.birth_date = "1997-08-15"
        candidate2.gender = "Laki-laki"
        candidate2.blood_type = "A"
        candidate2.domicile = "Jakarta Barat"
        candidate2.source_channel = "Glints"
        candidate2.current_salary = Decimal("8000000")
        candidate2.expected_salary = Decimal("12000000")
        candidate2.notice_period_days = 14
        candidate2.completeness_status = "belum_lengkap"
        candidate2.contact_status = "aktif"
        candidate2.notes = ""
        candidate2.created_at = datetime(2026, 10, 3, 10, 0, 0)
        candidate2.updated_at = datetime(2026, 10, 4, 10, 0, 0)
        candidate2.documents = []
        candidate2.educations = []
        candidate2.experiences = []

        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = [candidate1, candidate2]

        excel_bytes = _get_excel_response_for_candidates(mock_db, city="Jakarta")

        wb = openpyxl.load_workbook(BytesIO(excel_bytes))
        ws = wb.active
        self.assertEqual(ws.title, "Candidates")

        # Row 1 is header, Rows 2 and 3 are data
        rows = list(ws.iter_rows(values_only=True))
        self.assertEqual(len(rows), 3)  # header + 2 candidates
        self.assertEqual(rows[1][2], "Muhamad Rifa James")
        self.assertEqual(rows[2][2], "Bayu Sulistyo")


if __name__ == "__main__":
    unittest.main()

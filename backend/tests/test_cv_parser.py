import io
import unittest

import fitz

from app.core.date_utils import parse_date_str, parse_period_range
from app.services.cv_parser_service import extract_pdf_text


class CVParserTest(unittest.TestCase):
    def test_extract_pdf_text_reads_text_from_pdf(self):
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 72), "Nama Kandidat: Budi Santoso\nSkill: Python, SQL")

        buffer = io.BytesIO()
        doc.save(buffer, garbage=4)
        pdf_bytes = buffer.getvalue()
        doc.close()

        text = extract_pdf_text(pdf_bytes)

        self.assertIn("Budi Santoso", text)
        self.assertIn("Python", text)


class DateParsingTest(unittest.TestCase):
    """Verify experience-date parsing tolerates both Indonesian and English
    field-naming conventions returned by the LLM."""

    # Real date strings extracted from Nur Komalasari's CV
    REAL_DATES = [
        "JAN, 2026 - APR 2026",
        "MAR, 2023 – DES 2025",
        "SEP, 2022 – FEB 2023",
        "JUL, 2021– JAN, 2022",
        "JUN, 2022 – AUG, 2022",
        "SEP, 2018 – SEP 2022",
        "SEP, 2019 – SEP 2021",
        "SEP, 2019 –AUG 2021",
        "Oct 2022 – Oct 2025",
        "Jun 2019 – Jun 2022",
        "Jul 2024 – Jul 2026",
        "Apr 2024 – Apr 2026",
    ]

    def _parse_with_convention(self, exp, convention):
        if convention == "indonesian":
            period = exp.get("periode") or exp.get("period")
            mulai = exp.get("mulai") or exp.get("start_date")
            selesai = exp.get("selesai") or exp.get("end_date")
        else:
            period = exp.get("period") or exp.get("periode")
            mulai = exp.get("start_date") or exp.get("mulai")
            selesai = exp.get("end_date") or exp.get("selesai")

        start_date, end_date = None, None
        if period:
            start_date, end_date = parse_period_range(period)
        if not start_date and mulai:
            start_date = parse_date_str(mulai)
        if not end_date and selesai:
            end_date = parse_date_str(selesai)
        return start_date, end_date

    def test_indonesian_convention_parses_all_real_dates(self):
        for date_str in self.REAL_DATES:
            with self.subTest(date_str=date_str):
                exp = {"periode": date_str, "mulai": None, "selesai": None}
                start_date, end_date = self._parse_with_convention(exp, "indonesian")
                self.assertIsNotNone(
                    start_date,
                    f"Indonesian convention failed to parse: {date_str!r}",
                )

    def test_english_convention_parses_all_real_dates(self):
        for date_str in self.REAL_DATES:
            with self.subTest(date_str=date_str):
                exp = {"period": date_str, "start_date": None, "end_date": None}
                start_date, end_date = self._parse_with_convention(exp, "english")
                self.assertIsNotNone(
                    start_date,
                    f"English convention failed to parse: {date_str!r}",
                )

    def test_both_conventions_produce_same_result(self):
        for date_str in self.REAL_DATES:
            with self.subTest(date_str=date_str):
                id_start, id_end = self._parse_with_convention(
                    {"periode": date_str}, "indonesian"
                )
                en_start, en_end = self._parse_with_convention(
                    {"period": date_str}, "english"
                )
                self.assertEqual(id_start, en_start)
                self.assertEqual(id_end, en_end)

    def test_period_takes_precedence_over_explicit_dates(self):
        """Period text is parsed first; explicit dates are fallback only."""
        exp = {
            "periode": "JAN, 2026 - APR 2026",
            "mulai": "2026-02-01",
            "selesai": "2026-03-01",
        }
        start_date, end_date = self._parse_with_convention(exp, "indonesian")
        self.assertEqual(start_date.isoformat(), "2026-01-01")
        self.assertEqual(end_date.isoformat(), "2026-04-01")

    def test_explicit_dates_used_when_period_missing(self):
        """When period is absent, explicit dates are the fallback."""
        exp = {"mulai": "2026-02-01", "selesai": "2026-03-01"}
        start_date, end_date = self._parse_with_convention(exp, "indonesian")
        self.assertEqual(start_date.isoformat(), "2026-02-01")
        self.assertEqual(end_date.isoformat(), "2026-03-01")


if __name__ == "__main__":
    unittest.main()
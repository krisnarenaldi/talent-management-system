import io
import unittest

import fitz

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

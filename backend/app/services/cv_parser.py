"""
CV text extraction service.
Menggunakan PyMuPDF (fitz) untuk PDF berbasis teks.
TODO: Fase 3 — tambahkan Tesseract/PaddleOCR untuk CV scan/gambar.
"""
from __future__ import annotations

import fitz  # PyMuPDF


def extract_pdf_text(file_bytes: bytes) -> str:
    """Ekstrak teks dari PDF menggunakan PyMuPDF."""
    if not file_bytes:
        raise ValueError("File PDF kosong")

    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        texts: list[str] = []
        for page in doc:
            page_text = page.get_text("text")
            if page_text and page_text.strip():
                texts.append(page_text.strip())

    if not texts:
        raise ValueError("Tidak ada teks yang bisa diekstrak dari PDF ini.")

    return "\n\n".join(texts)


async def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Backward-compatible wrapper agar caller lama tetap berjalan."""
    return extract_pdf_text(file_bytes)

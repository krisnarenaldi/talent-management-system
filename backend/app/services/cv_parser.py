"""
CV text extraction service.
Menggunakan PyMuPDF (fitz) untuk PDF berbasis teks.
TODO: Fase 3 — tambahkan Tesseract/PaddleOCR untuk CV scan/gambar.
"""
from __future__ import annotations

import re

import fitz  # PyMuPDF


def _clean_cv_text(text: str) -> str:
    """
    Bersihkan artefak encoding yang umum muncul pada PDF dengan font subset:
    - Karakter non-printable / control characters
    - Karakter garbled di akhir kata (misal "JavaScrip@", "TypeScrip@", "Figm{")
      yang muncul akibat font glyph mapping yang tidak standard
    - Curly/smart quotes dari encoding Windows-1252 yang salah di-map ke Unicode
    - Baris yang hanya berisi whitespace berulang
    """
    # Hapus karakter control (kecuali tab dan newline)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Ganti bullet character yang muncul sebagai 'Ò' (U+00D2) atau 'ò' jadi '-'
    text = text.replace("\u00d2", "-").replace("\u00f2", "-")

    # Normalise smart/curly quotes dan karakter tipografi ke ASCII
    # (sering muncul dari font subset Windows-1252)
    text = (
        text.replace("\u2018", "'").replace("\u2019", "'")  # ' '
            .replace("\u201c", '"').replace("\u201d", '"')  # " "
            .replace("\u2013", "-").replace("\u2014", "-")  # – —
    )

    # Hapus karakter non-ASCII yang berdiri sendiri setelah huruf/angka
    # (indikasi glyph mapping rusak dari font subset)
    text = re.sub(r"(?<=[A-Za-z0-9])[^\x00-\x7F](?=\s|$|\n)", "", text)

    # Hapus karakter ASCII non-alphanumeric yang muncul sebagai glyph corruption
    # di akhir kata — pola: huruf diikuti langsung simbol @, {, }, |, ~, ^, `
    # yang tidak wajar sebagai akhiran kata bahasa natural
    text = re.sub(r"(?<=[A-Za-z0-9])[{}|~^`@](?=\s|$|\n)", "", text)

    # Hapus karakter non-ASCII tunggal yang "tersisa" di tengah baris
    text = re.sub(r"[^\x00-\x7F]", "", text)

    # Kompres baris kosong berulang jadi maksimal 1 baris kosong
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def extract_pdf_text(file_bytes: bytes) -> str:
    """
    Ekstrak teks dari PDF menggunakan PyMuPDF.

    Menggunakan mode 'blocks' dengan sort=True agar teks multi-kolom
    dibaca dalam urutan visual (kiri-ke-kanan, atas-ke-bawah) bukan
    urutan objek internal PDF — mencegah section skills/header terpisah
    dari kontennya pada layout 2-kolom.
    """
    if not file_bytes:
        raise ValueError("File PDF kosong")

    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        texts: list[str] = []
        for page in doc:
            # Gunakan get_text("blocks", sort=True) agar blok teks diurutkan
            # secara spasial (top-to-bottom, left-to-right).
            # Setiap block adalah tuple: (x0, y0, x1, y1, text, block_no, block_type)
            blocks = page.get_text("blocks", sort=True)
            page_lines: list[str] = []
            for block in blocks:
                block_text: str = block[4]  # index 4 = teks blok
                cleaned = block_text.strip()
                if cleaned:
                    page_lines.append(cleaned)
            if page_lines:
                texts.append("\n".join(page_lines))

    if not texts:
        raise ValueError("Tidak ada teks yang bisa diekstrak dari PDF ini.")

    raw = "\n\n".join(texts)
    return _clean_cv_text(raw)


async def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Backward-compatible wrapper agar caller lama tetap berjalan."""
    return extract_pdf_text(file_bytes)

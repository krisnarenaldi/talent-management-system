from __future__ import annotations

import io
from pathlib import Path
from typing import Iterable

import fitz
import httpx

from app.core.config import settings
from app.services.onedrive_service import onedrive_service


def _normalise_text_chunks(chunks: Iterable[str]) -> str:
    pages = [chunk.strip() for chunk in chunks if chunk and chunk.strip()]
    return "\n\n".join(pages).strip()


def extract_pdf_text(pdf_bytes: bytes) -> str:
    """Extract readable text from a PDF, primarily using PyMuPDF."""
    if not pdf_bytes:
        raise ValueError("File PDF kosong")

    try:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
            chunks: list[str] = []
            for page in document:
                text = page.get_text("text")
                if text:
                    chunks.append(text)

            text = _normalise_text_chunks(chunks)
            if text:
                return text
    except Exception:
        pass

    raise ValueError("Tidak ada teks yang bisa diekstrak dari PDF ini.")


async def download_cv_bytes_from_drive(drive_item_id: str) -> bytes:
    """Download a CV file from OneDrive using the pre-authenticated download URL."""
    if not drive_item_id:
        raise ValueError("drive_item_id diperlukan")

    download_url = await onedrive_service.get_download_url(drive_item_id)
    if not download_url:
        raise ValueError("Download URL tidak tersedia untuk file CV ini")

    async with httpx.AsyncClient() as client:
        resp = await client.get(download_url, timeout=60.0)
        resp.raise_for_status()
        return resp.content

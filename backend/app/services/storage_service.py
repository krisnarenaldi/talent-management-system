"""
Storage Adapter — abstract interface untuk semua backend storage.
Default: local filesystem. Switch ke OneDrive / GCS / S3 cukup ganti config.
"""
from __future__ import annotations

import uuid
from pathlib import Path
from typing import BinaryIO

from app.core.config import settings

UPLOAD_ROOT = Path(settings.UPLOAD_DIR)
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


class StorageService:
    """Interface umum: semua backend storage implementasi pola ini."""

    async def upload(self, file_content: bytes, filename: str, folder: str = "") -> dict:
        """
        Upload file.
        Return: { "file_url": str }   # URL/path yang bisa dipakai langsung oleh frontend
        """
        raise NotImplementedError

    async def delete(self, file_url: str) -> None:
        """Hapus file berdasarkan file_url yang dikembalikan saat upload."""
        raise NotImplementedError

    async def delete_file(self, identifier: str) -> None:
        """Alias untuk backward-compat dengan OneDriveService.delete_file()."""
        await self.delete(identifier)

    @property
    def base_url(self) -> str:
        """Base URL untuk akses file via HTTP (digunakan saat generate file_url)."""
        return settings.STORAGE_BASE_URL


class LocalStorage(StorageService):
    """Simpan file ke disk, akses via /api/v1/files/{relative_path}."""

    async def upload(self, file_content: bytes, filename: str, folder: str = "") -> dict:
        safe_name = self._safe_filename(filename)
        rel = Path(folder) / safe_name if folder else safe_name
        dest = UPLOAD_ROOT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(file_content)
        return {"file_url": f"/api/v1/files/{rel}"}

    async def delete(self, file_url: str) -> None:
        # Strip base URL prefix if present
        rel = file_url.replace(f"{settings.STORAGE_BASE_URL}/", "", 1) if settings.STORAGE_BASE_URL in file_url else file_url
        path = UPLOAD_ROOT / rel.lstrip("/")
        if path.exists():
            path.unlink()

    @staticmethod
    def _safe_filename(name: str) -> str:
        # Hindari directory traversal
        stem = Path(name).stem or uuid.uuid4().hex
        ext = Path(name).suffix.lower()
        return f"{stem}_{uuid.uuid4().hex[:8]}{ext}"

    @property
    def base_url(self) -> str:
        return settings.STORAGE_BASE_URL


# ── Factory ───────────────────────────────────────────────────────────────────

def get_storage_service() -> StorageService:
    backend = settings.STORAGE_BACKEND.lower()
    if backend == "onedrive" and settings.ONEDRIVE_DRIVE_ID:
        from app.services.onedrive_service import onedrive_service
        return onedrive_service
    # Default: local
    return LocalStorage()

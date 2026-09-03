"""
Microsoft Graph API — OneDrive for Business integration.
Semua operasi file dokumen (upload, download URL, delete) melalui service ini.
FastAPI adalah satu-satunya yang memegang credential Graph API — tidak pernah di frontend.

Referensi: https://learn.microsoft.com/en-us/graph/api/resources/driveitem
"""
import httpx

from app.core.config import settings


class OneDriveService:
    GRAPH_BASE = "https://graph.microsoft.com/v1.0"
    TOKEN_URL = f"https://login.microsoftonline.com/{settings.MICROSOFT_TENANT_ID}/oauth2/v2.0/token"

    async def _get_access_token(self) -> str:
        """Ambil access token via client credentials flow."""
        # TODO: implementasi dengan caching token (jangan request baru tiap kali)
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                self.TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.MICROSOFT_CLIENT_ID,
                    "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                    "scope": "https://graph.microsoft.com/.default",
                },
            )
            resp.raise_for_status()
            return resp.json()["access_token"]

    async def upload_file(self, file_content: bytes, filename: str, folder: str) -> dict:
        """
        Upload file ke OneDrive.
        Untuk file > 4MB, gunakan upload session.
        Return: { "drive_item_id": str, "file_url": str }
        TODO: TASK-04.2
        """
        raise NotImplementedError("TODO: implementasi upload file ke OneDrive")

    async def get_download_url(self, drive_item_id: str) -> str:
        """
        Dapatkan pre-authenticated download URL (temporary, ~1 jam).
        Menggunakan @microsoft.graph.downloadUrl dari response driveItem.
        TODO: TASK-04.2
        """
        raise NotImplementedError("TODO: implementasi get download URL")

    async def delete_file(self, drive_item_id: str) -> None:
        """Hapus file dari OneDrive. TODO: TASK-04.2"""
        raise NotImplementedError("TODO: implementasi delete file")


onedrive_service = OneDriveService()

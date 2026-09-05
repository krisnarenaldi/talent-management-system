"""
Microsoft Graph API — OneDrive for Business integration.
Semua operasi file dokumen (upload, download URL, delete) melalui service ini.
FastAPI adalah satu-satunya yang memegang credential Graph API — tidak pernah di frontend.

Referensi: https://learn.microsoft.com/en-us/graph/api/resources/driveitem
"""
from datetime import datetime, timedelta
from typing import Optional
import httpx

from app.core.config import settings


class OneDriveService:
    GRAPH_BASE = "https://graph.microsoft.com/v1.0"
    TOKEN_URL = f"https://login.microsoftonline.com/{settings.MICROSOFT_TENANT_ID}/oauth2/v2.0/token"

    # Token cache dalam memory
    _token: Optional[str] = None
    _token_expires_at: Optional[datetime] = None

    async def _get_access_token(self) -> str:
        """Ambil access token dengan cache — hindari request berulang ke Microsoft."""
        now = datetime.utcnow()
        if self._token and self._token_expires_at and now < self._token_expires_at - timedelta(minutes=5):
            return self._token

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                self.TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.MICROSOFT_CLIENT_ID,
                    "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                    "scope": "https://graph.microsoft.com/.default",
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
            self._token = data["access_token"]
            self._token_expires_at = now + timedelta(seconds=data["expires_in"])
            return self._token

    async def upload_file(
        self,
        file_content: bytes,
        filename: str,
        folder: str = "",
    ) -> dict:
        """
        Upload file ke OneDrive.
        < 4MB: PUT /drive/root:/path/to/file
        >= 4MB: create upload session → upload in chunks
        Return: { "drive_item_id": str, "file_url": str }
        """
        token = await self._get_access_token()
        auth_header = f"Bearer {token}"
        path = f"/{'/'.join(filter(None, [settings.ONEDRIVE_ROOT_FOLDER, folder]))}/{filename}" if folder else f"/{filename}"
        url = f"{self.GRAPH_BASE}/drives/{settings.ONEDRIVE_DRIVE_ID}/root:/{path}"

        if len(file_content) < 4 * 1024 * 1024:
            # Small file upload
            async with httpx.AsyncClient() as client:
                resp = await client.put(
                    url,
                    headers={"Authorization": auth_header},
                    content=file_content,
                    timeout=30.0,
                )
        else:
            # Large file — upload session
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{url}/createUploadSession",
                    headers={"Authorization": auth_header},
                    json={"description": f"Upload {filename}"},
                    timeout=30.0,
                )
            resp.raise_for_status()
            session = resp.json()
            upload_url = session["uploadUrl"]

            async with httpx.AsyncClient() as client:
                resp = await client.put(
                    upload_url,
                    content=file_content,
                    timeout=120.0,
                )
            resp.raise_for_status()

        item = resp.json()
        return {
            "drive_item_id": item["id"],
            "file_url": item.get("webUrl", ""),
        }

    async def get_download_url(self, drive_item_id: str) -> str:
        """
        Pre-authenticated download URL (valid ~1 jam).
        Return full URL termasuk ?authToken=...
        """
        token = await self._get_access_token()
        url = f"{self.GRAPH_BASE}/drives/{settings.ONEDRIVE_DRIVE_ID}/items/{drive_item_id}/download"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
        # Microsoft Graph mengembalikan @microsoft.graph.downloadUrl
        return data.get("@microsoft.graph.downloadUrl", "")

    async def delete_file(self, drive_item_id: str) -> None:
        """Hapus file dari OneDrive."""
        token = await self._get_access_token()
        url = f"{self.GRAPH_BASE}/drives/{settings.ONEDRIVE_DRIVE_ID}/items/{drive_item_id}"
        async with httpx.AsyncClient() as client:
            resp = await client.delete(url, headers={"Authorization": f"Bearer {token}"}, timeout=10.0)
        if resp.status_code != 204:
            resp.raise_for_status()


onedrive_service = OneDriveService()

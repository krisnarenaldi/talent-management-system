from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings


client = TestClient(app)


def test_uploaded_files_are_served_at_api_v1_files_and_legacy_candidate_path():
    upload_root = Path(settings.UPLOAD_DIR)
    upload_root.mkdir(parents=True, exist_ok=True)
    file_path = upload_root / "Candidates" / "demo-user"
    file_path.mkdir(parents=True, exist_ok=True)
    target = file_path / "demo-photo.jpg"
    target.write_bytes(b"fake-image-content")

    for url in [
        "/api/v1/files/Candidates/demo-user/demo-photo.jpg",
        "/api/v1/candidates/files/Candidates/demo-user/demo-photo.jpg",
    ]:
        response = client.get(url)
        assert response.status_code == 200, url
        assert response.content == b"fake-image-content", url

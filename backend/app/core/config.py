from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[3]

# Minimum length for secrets used as shared keys.
# 32 characters ≈ 192 bits of entropy when generated with a random tool —
# long enough to be brute-force-resistant for HMAC-style comparison.
_MIN_SECRET_LEN = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    # App
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"

    # Database
    POSTGRES_HOST: str = "pgbouncer"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "db_talent"
    POSTGRES_USER: str = "talent26"
    POSTGRES_PASSWORD: str

    @property
    def DATABASE_URL(self) -> str:
        from urllib.parse import quote_plus
        encoded_password = quote_plus(self.POSTGRES_PASSWORD)
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{encoded_password}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Internal API (shared secret untuk endpoint /internal/* — observability/manual retry)
    INTERNAL_API_SECRET: str

    # ── SEC-01: Validasi minimum length untuk secret wajib ────────────────────
    # Dijalankan saat Settings() diinstansiasi (startup), bukan saat request masuk.
    # Mencegah deploy dengan secret kosong/lemah yang bisa membuka akses internal endpoint.

    @field_validator("SECRET_KEY")
    @classmethod
    def _validate_secret_key(cls, v: str) -> str:
        if len(v) < _MIN_SECRET_LEN:
            raise ValueError(
                f"SECRET_KEY terlalu pendek ({len(v)} karakter). "
                f"Minimal {_MIN_SECRET_LEN} karakter — gunakan: "
                f"python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return v

    @field_validator("INTERNAL_API_SECRET")
    @classmethod
    def _validate_internal_secret(cls, v: str) -> str:
        if len(v) < _MIN_SECRET_LEN:
            raise ValueError(
                f"INTERNAL_API_SECRET terlalu pendek ({len(v)} karakter). "
                f"Minimal {_MIN_SECRET_LEN} karakter — gunakan: "
                f"python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return v

    # Microsoft Graph API (OneDrive for Business)
    MICROSOFT_TENANT_ID: str = ""
    MICROSOFT_CLIENT_ID: str = ""
    MICROSOFT_CLIENT_SECRET: str = ""
    ONEDRIVE_DRIVE_ID: str = ""
    ONEDRIVE_ROOT_FOLDER: str = "TMS_Documents"

    # Storage backend — "local" (default) atau "onedrive"
    STORAGE_BACKEND: str = "local"
    UPLOAD_DIR: str = str(BASE_DIR / "uploads")
    STORAGE_BASE_URL: str = ""  # kosong = relative path; isi = base URL saat production

    # Redis (arq job queue)
    REDIS_URL: str = "redis://redis:6379/0"

    # LLM
    ANTHROPIC_API_KEY: str = ""
    LLM_MODEL: str = "claude-haiku-4-5"

    # OpenAI (untuk TASK-14 Natural Language Search)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Email
    EMAIL_FROM: str = "noreply@altek.id"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    # Password reset token expiry (menit)
    RESET_TOKEN_EXPIRE_MINUTES: int = 15


settings = Settings()

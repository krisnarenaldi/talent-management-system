from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[3]

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    # App
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"

    # Database
    POSTGRES_HOST: str = "pgbouncer"
    POSTGRES_PORT: int = 6432
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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Internal API (shared secret untuk n8n callback)
    INTERNAL_API_SECRET: str

    # Microsoft Graph API (OneDrive for Business)
    MICROSOFT_TENANT_ID: str = ""
    MICROSOFT_CLIENT_ID: str = ""
    MICROSOFT_CLIENT_SECRET: str = ""
    ONEDRIVE_DRIVE_ID: str = ""
    ONEDRIVE_ROOT_FOLDER: str = "TMS_Documents"

    # n8n
    N8N_WEBHOOK_CV_PARSER: str = ""
    N8N_WEBHOOK_AI_SCREENING: str = ""

    # LLM
    ANTHROPIC_API_KEY: str = ""
    LLM_MODEL: str = "claude-haiku-4-5"

    # Email
    EMAIL_FROM: str = "noreply@altek.id"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    # Password reset token expiry (menit)
    RESET_TOKEN_EXPIRE_MINUTES: int = 15


settings = Settings()

import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.config import settings

logger = logging.getLogger(__name__)


def generate_reset_token() -> str:
    """Generate a cryptographically random reset token."""
    return uuid4().hex


def send_password_reset_email(to_email: str, reset_token: str) -> bool:
    """
    Kirim email reset password.
    Untuk dev, token dicetak ke log. Untuk production, integrasikan dengan SMTP/Resend.
    """
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

    subject = "Reset Password — TMS"
    body = f"""
Halo,

Anda menerima email ini karena ada permintaan reset password di Talent Management System.

Klik link berikut untuk mereset password Anda (berlaku 15 menit):
{reset_link}

Jika Anda tidak meminta reset password, abaikan email ini.
""".strip()

    logger.info("[DEV — Email] Subject: %s", subject)
    logger.info("[DEV — Email] To: %s", to_email)
    logger.info("[DEV — Email] Body:\n%s", body)

    # TODO: Production — ganti dengan smtp.send() atau resin.send()
    # contoh:
    # import smtplib
    # from email.mime.text import MIMEText
    # msg = MIMEText(body, "plain")
    # msg["Subject"] = subject
    # msg["From"] = settings.EMAIL_FROM
    # msg["To"] = to_email
    # with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
    #     server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
    #     server.send_message(msg)
    # return True

    return True

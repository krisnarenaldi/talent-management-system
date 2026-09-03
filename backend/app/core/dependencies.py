from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_token
from app.db.database import get_db
from app.models.user import User

# Header untuk internal API (n8n → backend)
internal_key_header = APIKeyHeader(name="X-Internal-Secret", auto_error=False)


def get_current_user(
    access_token: Annotated[str | None, Cookie()] = None,
    db: Session = Depends(get_db),
) -> User:
    """Dependency: ambil user yang sedang login dari JWT cookie."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sesi tidak valid atau sudah berakhir. Silakan login ulang.",
    )
    if not access_token:
        raise credentials_exception
    try:
        payload = decode_token(access_token)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise credentials_exception
    return user


def require_role(*roles: str):
    """
    Dependency factory untuk RBAC.
    Contoh: Depends(require_role("manager", "admin"))
    """
    def _check_role(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak. Diperlukan role: {', '.join(roles)}.",
            )
        return current_user

    return _check_role


def verify_internal_secret(
    secret: Annotated[str | None, Security(internal_key_header)] = None,
) -> None:
    """Dependency untuk endpoint internal (dipanggil oleh n8n)."""
    if not secret or secret != settings.INTERNAL_API_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Internal secret tidak valid.",
        )

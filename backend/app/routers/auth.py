from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.database import get_db
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    ProfileUpdateRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.services.email_service import generate_reset_token, send_password_reset_email

router = APIRouter()

COOKIE_SETTINGS = {
    "httponly": True,
    "samesite": "lax",
    "secure": False,   # Set True di production (HTTPS)
}


def _store_refresh_token(db: Session, user_id: UUID, token: str, expires_at: datetime):
    """Simpan refresh token ke DB (untuk rotation & revoke)."""
    db.add(RefreshToken(user_id=user_id, token=token, expires_at=expires_at))
    db.commit()


def _revoke_refresh_token(db: Session, user_id: UUID, token: str):
    """Tandai refresh token sebagai revoked."""
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.token == token,
        RefreshToken.revoked == False,
    ).update({"revoked": True})
    db.commit()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email, User.is_active == True).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau password salah.",
        )

    token_data = {"sub": str(user.id), "role": user.role}
    access_token = create_access_token(token_data)
    refresh_token_val = create_refresh_token(token_data)

    # Simpan refresh token ke DB
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    _store_refresh_token(db, user.id, refresh_token_val, expire)

    response.set_cookie("access_token", access_token, max_age=60 * 15, **COOKIE_SETTINGS)
    response.set_cookie("refresh_token", refresh_token_val, max_age=60 * 60 * 24 * 7, **COOKIE_SETTINGS)

    return TokenResponse(id=str(user.id), name=user.name, role=user.role, email=user.email)


@router.post("/logout")
def logout(response: Response, db: Session = Depends(get_db)):
    # Revoke semua refresh token yang aktif
    token: str | None = Cookie(default=None)
    if token:
        db.query(RefreshToken).filter(
            RefreshToken.token == token,
            RefreshToken.revoked == False,
        ).update({"revoked": True})
        db.commit()

    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logout berhasil."}


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response,
    db: Session = Depends(get_db),
    old_refresh_token: str | None = Cookie(default=None),
):
    """
    Rotate refresh token:
    1. Validasi refresh token dari cookie
    2. Cek di DB — harus ada, belum expired, belum di-revoke
    3. Revoke token lama
    4. Buat access + refresh token baru
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sesi tidak valid atau sudah berakhir. Silakan login ulang.",
    )

    if not old_refresh_token:
        raise credentials_exception

    try:
        payload = decode_token(old_refresh_token)
        if payload.get("type") != "refresh":
            raise credentials_exception
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except Exception:
        raise credentials_exception

    # Verifikasi refresh token di DB
    stored_token = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token == old_refresh_token,
            RefreshToken.revoked == False,
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if not stored_token:
        raise credentials_exception

    # Ambil user
    user = db.query(User).filter(User.id == stored_token.user_id, User.is_active == True).first()
    if not user:
        raise credentials_exception

    # Revoke token lama
    stored_token.revoked = True
    db.commit()

    # Buat token baru
    token_data = {"sub": str(user.id), "role": user.role}
    new_access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)
    new_expire = datetime.now(timezone.utc) + timedelta(days=7)
    _store_refresh_token(db, user.id, new_refresh_token, new_expire)

    response.set_cookie("access_token", new_access_token, max_age=60 * 15, **COOKIE_SETTINGS)
    response.set_cookie("refresh_token", new_refresh_token, max_age=60 * 60 * 24 * 7, **COOKIE_SETTINGS)

    return TokenResponse(id=str(user.id), name=user.name, role=user.role, email=user.email)


@router.get("/me", response_model=TokenResponse)
def me(current_user: User = Depends(get_current_user)):
    return TokenResponse(id=str(current_user.id), name=current_user.name, role=current_user.role, email=current_user.email)


@router.patch("/me", response_model=TokenResponse)
def update_me(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    update_data = payload.model_dump(exclude_unset=True, exclude_none=True)
    if "name" in update_data:
        update_data["name"] = update_data["name"].strip()
        if not update_data["name"]:
            raise HTTPException(status_code=422, detail="Nama wajib diisi.")
    if "password" in update_data:
        if len(update_data["password"]) < 6:
            raise HTTPException(status_code=422, detail="Password minimal 6 karakter.")
        update_data["hashed_password"] = hash_password(update_data.pop("password"))

    for key, value in update_data.items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return TokenResponse(id=str(current_user.id), name=current_user.name, role=current_user.role, email=current_user.email)


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Buat token reset password, kirim email ke user.
    Menghasilkan response yang sama apakah email ditemukan (untuk antisipasi enumeration).
    """
    user = db.query(User).filter(User.email == payload.email).first()

    if user:
        token = generate_reset_token()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.RESET_TOKEN_EXPIRE_MINUTES)
        user.reset_token = token
        user.reset_token_expires_at = expires_at
        db.commit()
        send_password_reset_email(user.email, token)

    return {"message": "Jika email terdaftar, link reset password telah dikirim."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Verifikasi token reset, set password baru, hapus token.
    """
    user = db.query(User).filter(User.reset_token == payload.token).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token tidak valid.",
        )
    if user.reset_token_expires_at is None or datetime.now(timezone.utc) > user.reset_token_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token sudah kadaluarsa.",
        )
    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password minimal 6 karakter.",
        )

    user.hashed_password = hash_password(payload.password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()

    # Revoke semua refresh token lama (paksa login ulang)
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked == False,
    ).update({"revoked": True})
    db.commit()

    return {"message": "Password berhasil direset. Silakan login ulang."}

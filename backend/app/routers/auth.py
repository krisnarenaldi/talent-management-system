from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse

router = APIRouter()

COOKIE_SETTINGS = {
    "httponly": True,
    "samesite": "lax",
    "secure": False,   # Set True di production (HTTPS)
}


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
    refresh_token = create_refresh_token(token_data)

    response.set_cookie("access_token", access_token, max_age=60 * 15, **COOKIE_SETTINGS)
    response.set_cookie("refresh_token", refresh_token, max_age=60 * 60 * 24 * 7, **COOKIE_SETTINGS)

    return TokenResponse(name=user.name, role=user.role, email=user.email)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logout berhasil."}


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response,
    db: Session = Depends(get_db),
    # TODO: ambil refresh token dari cookie
):
    # Implementasi penuh di TASK-02.1
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="TODO")


@router.get("/me", response_model=TokenResponse)
def me(current_user: User = Depends(get_current_user)):
    return TokenResponse(name=current_user.name, role=current_user.role, email=current_user.email)

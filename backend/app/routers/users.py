from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.security import hash_password
from app.db.database import get_db
from app.models.user import USER_ROLES, User
from app.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter()


@router.get("", response_model=list[UserResponse])
def list_users(
    skip: int = Query(0, ge=0, description="Jumlah dilewati"),
    limit: int = Query(50, ge=1, le=200, description="Jumlah per halaman"),
    search: str | None = Query(None, description="Filter berdasarkan nama atau email"),
    role: str | None = Query(None, description="Filter berdasarkan role"),
    is_active: bool | None = Query(None, description="Tampilkan hanya aktif / hanya nonaktif"),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    query = db.query(User)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (User.name.ilike(pattern)) | (User.email.ilike(pattern))
        )
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    users = query.offset(skip).limit(limit).all()
    return users


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    # Validasi role
    if payload.role not in USER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Role tidak valid. Harus salah satu dari: {', '.join(USER_ROLES)}",
        )

    # Cek email unik
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email sudah terdaftar.",
        )

    user = User(
        name=payload.name,
        email=payload.email,
        role=payload.role,
        hashed_password=hash_password(payload.password),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User tidak ditemukan.",
        )

    # Jangan izinkan admin mengubah role dirinya sendiri (kecuali tetap admin)
    if user.id == current_user.id and payload.role and payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tidak bisa mengubah role diri sendiri menjadi non-admin.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = hash_password(update_data.pop("password"))
    if "role" in update_data and update_data["role"] not in USER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Role tidak valid. Harus salah satu dari: {', '.join(USER_ROLES)}",
        )

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """Soft delete: set is_active = False (bukan delete fisik)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User tidak ditemukan.",
        )

    if user.is_active == False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User sudah dinonaktifkan.",
        )

    user.is_active = False
    db.commit()

from pydantic import BaseModel, EmailStr, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    password: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


class TokenResponse(BaseModel):
    id: str
    name: str
    role: str
    email: str

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, value: object) -> str:
        if hasattr(value, "value"):
            return value.value
        return str(value)

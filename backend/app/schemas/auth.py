"""인증 관련 Pydantic v2 스키마 (요청/응답)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    """회원가입 요청."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)


class LoginRequest(BaseModel):
    """로그인 요청."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    """access 토큰 재발급 요청."""

    refresh_token: str


class TokenResponse(BaseModel):
    """JWT 토큰 응답."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """사용자 정보 응답 (비밀번호 해시 제외)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    display_name: str
    avatar_url: str | None = None
    auth_provider: str
    created_at: datetime

"""User 모델 — 이메일/비밀번호 + OAuth 공용."""
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    """사용자 계정.

    - local 가입: password_hash 채워짐, oauth_sub 는 null
    - OAuth 가입(후속): password_hash 는 null, auth_provider/oauth_sub 채워짐
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # OAuth 전용 계정은 비밀번호가 없으므로 nullable
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # local | google | kakao
    auth_provider: Mapped[str] = mapped_column(String(20), default="local", nullable=False)
    # OAuth provider 의 고유 subject ID (후속 단계에서 사용)
    oauth_sub: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

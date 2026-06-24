"""인증 라우터 — 이메일/비밀번호 회원가입·로그인·refresh·me.

OAuth(google/kakao) 소셜 로그인은 app/routers/oauth.py 에 별도 구현됨
(GET /api/auth/{provider}/login, /api/auth/{provider}/callback).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.utils.dependencies import get_current_user
from app.utils.security import (
    TOKEN_TYPE_REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """이메일/비밀번호 회원가입. 중복 이메일이면 400."""
    # 이메일은 소문자로 정규화하여 중복 판정 일관성 확보
    email = payload.email.lower()

    existing = db.query(User).filter(User.email == email).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 가입된 이메일입니다.",
        )

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        auth_provider="local",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """이메일/비밀번호 로그인. 자격증명 불일치면 401."""
    email = payload.email.lower()
    user = db.query(User).filter(User.email == email).first()

    # 사용자 없음 / 비밀번호 없음(OAuth 전용 계정) / 비밀번호 불일치 → 동일한 401 (계정 존재 노출 방지)
    if (
        user is None
        or user.password_hash is None
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다.",
        )

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """refresh 토큰으로 새 access(+refresh) 토큰 발급. 유효하지 않으면 401."""
    try:
        user_id = decode_token(payload.refresh_token, expected_type=TOKEN_TYPE_REFRESH)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="refresh 토큰이 유효하지 않습니다.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="refresh 토큰이 유효하지 않습니다.",
        )

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    """현재 로그인 사용자 정보. 토큰 없거나 유효하지 않으면 401."""
    return current_user

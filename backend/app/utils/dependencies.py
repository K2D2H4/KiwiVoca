"""FastAPI 의존성 — 현재 로그인 사용자 조회 (Bearer access 토큰)."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.utils.security import TOKEN_TYPE_ACCESS, decode_token

# Authorization: Bearer <token> 헤더에서 토큰 추출
_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """access 토큰을 검증하고 해당 사용자를 반환. 실패 시 401."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증이 필요합니다.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None or not credentials.credentials:
        raise unauthorized

    try:
        user_id = decode_token(credentials.credentials, expected_type=TOKEN_TYPE_ACCESS)
    except ValueError:
        raise unauthorized

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise unauthorized

    return user

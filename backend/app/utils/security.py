"""보안 유틸 — 비밀번호 bcrypt 해시/검증, JWT access/refresh 발급·디코드."""
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

# bcrypt 해시 컨텍스트
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT 토큰 타입 클레임 값 (access / refresh 구분)
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def hash_password(plain_password: str) -> str:
    """평문 비밀번호를 bcrypt 해시로 변환."""
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    """평문 비밀번호가 해시와 일치하는지 검증."""
    return _pwd_context.verify(plain_password, password_hash)


def _create_token(subject: str, token_type: str, expires_delta: timedelta) -> str:
    """JWT 발급 공통 로직. sub=user_id 문자열, type 으로 access/refresh 구분."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: int) -> str:
    """access 토큰 발급 (짧은 만료)."""
    return _create_token(
        subject=str(user_id),
        token_type=TOKEN_TYPE_ACCESS,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: int) -> str:
    """refresh 토큰 발급 (긴 만료)."""
    return _create_token(
        subject=str(user_id),
        token_type=TOKEN_TYPE_REFRESH,
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str, expected_type: str) -> int:
    """JWT 디코드 + 타입 검증. 성공 시 user_id(int) 반환.

    검증 실패(서명 불일치/만료/타입 불일치/sub 누락) 시 ValueError 발생.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise ValueError("토큰이 유효하지 않습니다.") from exc

    if payload.get("type") != expected_type:
        raise ValueError("토큰 종류가 올바르지 않습니다.")

    sub = payload.get("sub")
    if sub is None:
        raise ValueError("토큰에 사용자 정보가 없습니다.")

    try:
        return int(sub)
    except (TypeError, ValueError) as exc:
        raise ValueError("토큰의 사용자 정보가 올바르지 않습니다.") from exc

"""OAuth 서비스 — Google/Kakao 서버사이드 리다이렉트 플로우.

provider별 authorize URL 생성, code→token 교환, 프로필 조회·정규화를 담당.
state(CSRF 방지)는 서버 상태 저장 없이 SECRET_KEY 서명 JWT(단명)로 처리한다.
시크릿/토큰/code 는 절대 로그로 남기지 않는다.
"""
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from jose import JWTError, jwt

from app.config import settings

# state 토큰 타입 (access/refresh 와 구분)
_STATE_TOKEN_TYPE = "oauth_state"
# state 만료 (로그인 시작 → 콜백까지 허용 시간)
_STATE_EXPIRE_MINUTES = 10

# provider별 엔드포인트/스코프 메타데이터
_PROVIDERS = {
    "google": {
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scope": "openid email profile",
    },
    "kakao": {
        "authorize_url": "https://kauth.kakao.com/oauth/authorize",
        "token_url": "https://kauth.kakao.com/oauth/token",
        "userinfo_url": "https://kapi.kakao.com/v2/user/me",
        # 이메일은 비즈앱 검수/사용자 동의가 필요할 수 있음
        "scope": "profile_nickname",
    },
}


class OAuthError(Exception):
    """OAuth 처리 중 발생하는 에러. message 는 프론트 redirect 에 쓸 짧은 코드."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def is_supported_provider(provider: str) -> bool:
    """지원하는 provider(google|kakao)인지."""
    return provider in _PROVIDERS


def _provider_credentials(provider: str) -> tuple[str, str, str]:
    """provider의 (client_id, client_secret, redirect_uri) 반환."""
    if provider == "google":
        return (
            settings.GOOGLE_CLIENT_ID,
            settings.GOOGLE_CLIENT_SECRET,
            settings.GOOGLE_REDIRECT_URI,
        )
    return (
        settings.KAKAO_CLIENT_ID,
        settings.KAKAO_CLIENT_SECRET,
        settings.KAKAO_REDIRECT_URI,
    )


def is_configured(provider: str) -> bool:
    """provider client_id 가 설정되어 있는지 (미설정이면 로그인 비활성)."""
    client_id, _, _ = _provider_credentials(provider)
    return bool(client_id)


def create_state_token(provider: str) -> str:
    """CSRF 방지용 state — provider/nonce 를 담아 SECRET_KEY 로 서명한 단명 JWT."""
    now = datetime.now(timezone.utc)
    payload = {
        "type": _STATE_TOKEN_TYPE,
        "provider": provider,
        "iat": now,
        "exp": now + timedelta(minutes=_STATE_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_state_token(state: str, provider: str) -> None:
    """state 검증. 서명/만료/타입/provider 불일치 시 OAuthError("invalid_state")."""
    try:
        payload = jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise OAuthError("invalid_state") from exc

    if payload.get("type") != _STATE_TOKEN_TYPE or payload.get("provider") != provider:
        raise OAuthError("invalid_state")


def build_authorize_url(provider: str) -> str:
    """provider authorize URL 생성 (client_id/redirect_uri/scope/state 포함)."""
    meta = _PROVIDERS[provider]
    client_id, _, redirect_uri = _provider_credentials(provider)
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": meta["scope"],
        "state": create_state_token(provider),
    }
    return f"{meta['authorize_url']}?{urlencode(params)}"


def _exchange_code(provider: str, code: str) -> str:
    """authorization code → access_token 교환. 실패 시 OAuthError("token_exchange_failed")."""
    meta = _PROVIDERS[provider]
    client_id, client_secret, redirect_uri = _provider_credentials(provider)
    data = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "code": code,
    }
    # client_secret 은 있을 때만 포함 (kakao 는 선택)
    if client_secret:
        data["client_secret"] = client_secret

    try:
        resp = httpx.post(
            meta["token_url"],
            data=data,
            headers={"Accept": "application/json"},
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise OAuthError("token_exchange_failed") from exc

    if resp.status_code != 200:
        raise OAuthError("token_exchange_failed")

    access_token = resp.json().get("access_token")
    if not access_token:
        raise OAuthError("token_exchange_failed")
    return access_token


def _fetch_profile(provider: str, access_token: str) -> dict:
    """provider userinfo 조회. 실패 시 OAuthError("profile_fetch_failed")."""
    meta = _PROVIDERS[provider]
    try:
        resp = httpx.get(
            meta["userinfo_url"],
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise OAuthError("profile_fetch_failed") from exc

    if resp.status_code != 200:
        raise OAuthError("profile_fetch_failed")
    return resp.json()


def _normalize_profile(provider: str, raw: dict) -> dict:
    """provider별 raw 프로필을 공용 형태로 정규화.

    반환: {oauth_sub, email(없으면 None), display_name, avatar_url(없으면 None)}
    """
    if provider == "google":
        oauth_sub = raw.get("sub")
        return {
            "oauth_sub": str(oauth_sub) if oauth_sub is not None else None,
            "email": raw.get("email"),
            "display_name": raw.get("name") or "사용자",
            "avatar_url": raw.get("picture"),
        }

    # kakao: id 는 최상위, 나머지는 kakao_account / properties 하위
    kakao_id = raw.get("id")
    account = raw.get("kakao_account") or {}
    properties = raw.get("properties") or {}
    return {
        "oauth_sub": str(kakao_id) if kakao_id is not None else None,
        # 이메일 동의 안 했으면 없을 수 있음 (None)
        "email": account.get("email"),
        "display_name": properties.get("nickname") or "사용자",
        "avatar_url": properties.get("profile_image"),
    }


def fetch_oauth_profile(provider: str, code: str) -> dict:
    """code 로 token 교환 + 프로필 조회 + 정규화까지 한 번에 수행.

    oauth_sub 가 없으면 OAuthError("profile_fetch_failed").
    """
    access_token = _exchange_code(provider, code)
    raw = _fetch_profile(provider, access_token)
    profile = _normalize_profile(provider, raw)
    if not profile["oauth_sub"]:
        raise OAuthError("profile_fetch_failed")
    return profile

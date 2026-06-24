"""OAuth 라우터 — Google/Kakao 서버사이드 리다이렉트 플로우.

플로우:
  1) GET /api/auth/{provider}/login    → provider authorize URL 로 302
  2) GET /api/auth/{provider}/callback → state 검증 → token 교환 → 프로필 → 유저 upsert
     → 우리 JWT 발급 → 프론트로 302 (토큰은 URL fragment #access_token=...&refresh_token=...)

토큰은 쿼리스트링이 아니라 fragment(#)로 넘겨 서버/프록시 로그 노출을 막는다.
시크릿/토큰/code 는 로그로 남기지 않는다.
"""
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services import oauth_service
from app.services.oauth_service import OAuthError
from app.utils.security import create_access_token, create_refresh_token

router = APIRouter(prefix="/api/auth", tags=["oauth"])


def _frontend_redirect(fragment_params: dict) -> RedirectResponse:
    """프론트 /oauth/callback 으로 fragment(#) 를 붙여 302 리다이렉트."""
    url = f"{settings.FRONTEND_BASE_URL}/oauth/callback#{urlencode(fragment_params)}"
    return RedirectResponse(url, status_code=status.HTTP_302_FOUND)


def _upsert_oauth_user(db: Session, provider: str, profile: dict) -> User:
    """OAuth 프로필로 유저 upsert.

    규칙:
      - 동일 (auth_provider, oauth_sub) 유저 존재 → 그대로 반환(재로그인).
      - 이메일 있고 같은 email 유저 존재 → 연결(provider/oauth_sub 갱신, 비번 유지).
      - 이메일 없으면(카카오 이메일 미동의) placeholder email 로 신규 생성.
    """
    oauth_sub = profile["oauth_sub"]
    email = (profile.get("email") or "").lower() or None

    # 1) 동일 provider+oauth_sub 재로그인
    existing = (
        db.query(User)
        .filter(User.auth_provider == provider, User.oauth_sub == oauth_sub)
        .first()
    )
    if existing is not None:
        return existing

    # 2) 이메일 매칭 → 기존 계정에 연결 (MVP 정책)
    if email is not None:
        by_email = db.query(User).filter(User.email == email).first()
        if by_email is not None:
            by_email.auth_provider = provider
            by_email.oauth_sub = oauth_sub
            if not by_email.avatar_url and profile.get("avatar_url"):
                by_email.avatar_url = profile["avatar_url"]
            db.commit()
            db.refresh(by_email)
            return by_email

    # 3) 신규 생성
    #    이메일 미동의(카카오)면 unique 제약 충족용 placeholder 이메일 사용.
    if email is None:
        email = f"kakao_{oauth_sub}@users.kiwivoca.com"

    user = User(
        email=email,
        password_hash=None,  # OAuth 전용 계정은 비밀번호 없음
        display_name=profile["display_name"],
        avatar_url=profile.get("avatar_url"),
        auth_provider=provider,
        oauth_sub=oauth_sub,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{provider}/login")
def oauth_login(provider: str) -> RedirectResponse:
    """provider authorize URL 로 302 리다이렉트. client_id 미설정이면 503."""
    if not oauth_service.is_supported_provider(provider):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="지원하지 않는 로그인 제공자입니다.",
        )
    if not oauth_service.is_configured(provider):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="소셜 로그인이 설정되지 않았습니다.",
        )

    authorize_url = oauth_service.build_authorize_url(provider)
    return RedirectResponse(authorize_url, status_code=status.HTTP_302_FOUND)


@router.get("/{provider}/callback")
def oauth_callback(
    provider: str,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    """provider 콜백 처리 → 유저 upsert → 우리 JWT 발급 → 프론트로 302.

    실패는 모두 프론트 /oauth/callback#error=<코드> 로 리다이렉트(예외 던지지 않음).
    """
    if not oauth_service.is_supported_provider(provider):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="지원하지 않는 로그인 제공자입니다.",
        )

    # provider 가 에러를 돌려준 경우(사용자 거부 등)
    if error is not None or code is None or state is None:
        return _frontend_redirect({"error": "oauth_denied"})

    try:
        oauth_service.verify_state_token(state, provider)
        profile = oauth_service.fetch_oauth_profile(provider, code)
    except OAuthError as exc:
        return _frontend_redirect({"error": exc.code})

    user = _upsert_oauth_user(db, provider, profile)

    return _frontend_redirect(
        {
            "access_token": create_access_token(user.id),
            "refresh_token": create_refresh_token(user.id),
        }
    )

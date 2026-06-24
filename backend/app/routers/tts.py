"""발음 TTS 라우터 — Google Cloud Text-to-Speech(Chirp 3 HD) 음성 합성.

GET /api/tts?text=<단어>&lang=<언어코드> → MP3 오디오(audio/mpeg).

인증 필요(get_current_user) — 공개 노출 시 키 과금 남용을 막기 위함.
프론트는 axios(Authorization 헤더)로 blob 을 받아 재생한다.
같은 입력은 서버 파일 캐시 + 브라우저 캐시(Cache-Control)로 재합성을 피한다.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.models.user import User
from app.services import tts_service
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/tts", tags=["tts"])


@router.get("", response_class=Response)
def synthesize_tts(
    text: str = Query(..., min_length=1, max_length=tts_service.MAX_TEXT_LEN),
    lang: str | None = Query(default=None),
    _user: User = Depends(get_current_user),
) -> Response:
    """단어/표현 발음을 MP3 로 합성해 반환한다."""
    try:
        audio = tts_service.synthesize(text, lang)
    except tts_service.TTSError as exc:
        raise HTTPException(status_code=exc.http_status, detail=exc.message) from exc

    return Response(
        content=audio,
        media_type="audio/mpeg",  # Chirp 3 HD → MP3
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )

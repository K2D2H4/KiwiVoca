"""가상 전화 WebSocket 라우터 — Gemini Live API 음성 프록시.

클라이언트(브라우저)와 Gemini Live 세션 사이의 양방향 오디오 릴레이.

인증: WebSocket 은 헤더 사용이 어려우므로 쿼리 토큰(?token=<access>)으로 검증.
      실패 시 close code 4401.
덱:   ?deck_id=<id> — 소유 또는 공개 덱만 허용. 불가 시 close 4403/4404.

오디오 포맷:
- 클라 → 서버(마이크): PCM16 16kHz mono (binary WS 메시지)
- 서버 → 클라(TTS):    PCM16 24kHz mono (binary WS 메시지)

제어 메시지(텍스트 WS, JSON):
- server → client: {"type":"ready","target_words":[...]}  (세션 시작)
- server → client: {"type":"error","message":"<한국어>"}   (오류)
- client → server: {"type":"end_turn"}                     (사용자 발화 종료 신호)
- client → server: {"type":"text","text":"..."}            (텍스트 턴, 선택)

google-genai 1.2.0 LiveConnectConfig 는 전사(transcription)를 지원하지 않으므로
자막(transcript) 메시지는 제공하지 않는다.
"""
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from google import genai
from starlette.websockets import WebSocketState

from app.config import settings
from app.database import SessionLocal
from app.models.user import User
from app.services import call_service
from app.utils.security import TOKEN_TYPE_ACCESS, decode_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/call", tags=["call"])

# WebSocket close 코드 (애플리케이션 정의)
_CLOSE_UNAUTHORIZED = 4401  # 토큰 없음/유효하지 않음
_CLOSE_FORBIDDEN = 4403  # 덱 접근 불가(타인 비공개)
_CLOSE_NOT_FOUND = 4404  # 덱 없음
_CLOSE_SERVER_ERROR = 4500  # Gemini/서버 내부 오류


def _authenticate(token: str | None) -> User | None:
    """쿼리 토큰을 검증하고 사용자 반환. 실패 시 None.

    DB 세션은 이 함수 내에서 열고 닫는다(사용자 객체만 detach 되어 반환됨;
    이후 라우터에서 별도 세션으로 덱을 조회한다).
    """
    if not token:
        return None
    try:
        user_id = decode_token(token, expected_type=TOKEN_TYPE_ACCESS)
    except ValueError:
        return None

    db = SessionLocal()
    try:
        return db.query(User).filter(User.id == user_id).first()
    finally:
        db.close()


@router.websocket("/ws")
async def call_ws(
    websocket: WebSocket,
    token: str | None = Query(default=None),
    deck_id: int | None = Query(default=None),
) -> None:
    """가상 전화 WebSocket 엔드포인트."""
    # 1) 인증 (handshake accept 전에 검증 → 실패 시 accept 후 close 코드 전달)
    user = _authenticate(token)
    if user is None:
        await websocket.accept()
        await websocket.close(code=_CLOSE_UNAUTHORIZED, reason="인증이 필요합니다.")
        return

    if deck_id is None:
        await websocket.accept()
        await websocket.close(code=_CLOSE_NOT_FOUND, reason="덱이 지정되지 않았습니다.")
        return

    # 2) 덱 + 카드 로드 (소유 또는 공개)
    db = SessionLocal()
    try:
        deck, cards = call_service.load_deck_for_call(db, user, deck_id)
    except call_service.DeckNotAccessible:
        db.close()
        await websocket.accept()
        await websocket.close(code=_CLOSE_FORBIDDEN, reason="덱에 접근할 수 없습니다.")
        return
    finally:
        # 카드/덱 속성은 이미 로드됨; 세션은 닫아도 됨
        db.close()

    words = call_service.target_words(cards)
    config = call_service.live_config(deck, cards)

    await websocket.accept()

    # 3) Gemini Live 세션 오픈 + 양방향 릴레이
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    try:
        async with client.aio.live.connect(
            model=call_service.LIVE_MODEL, config=config
        ) as session:
            # 시작 신호 (프론트 자막/칩용)
            await websocket.send_text(
                json.dumps({"type": "ready", "target_words": words})
            )

            # 두 태스크: 클라→Gemini(업링크), Gemini→클라(다운링크)
            uplink = asyncio.create_task(_uplink(websocket, session))
            downlink = asyncio.create_task(_downlink(websocket, session))

            done, pending = await asyncio.wait(
                {uplink, downlink}, return_when=asyncio.FIRST_COMPLETED
            )
            # 한쪽 종료 시 나머지 태스크 취소 후 정리
            for task in pending:
                task.cancel()
            for task in pending:
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                except Exception as exc:  # noqa: BLE001
                    # 취소 중 발생한 일반 예외는 흡수하되 관측을 위해 로깅
                    logger.warning("call relay task cancel error: %s", type(exc).__name__)
            # 완료된 태스크의 예외는 로깅 (오디오/키 미노출)
            for task in done:
                exc = task.exception()
                if exc is not None and not isinstance(exc, WebSocketDisconnect):
                    logger.warning("call relay task error: %s", type(exc).__name__)
    except Exception as exc:  # Gemini 세션 오픈/네트워크 실패 등
        logger.error("Gemini Live session error: %s", type(exc).__name__)
        await _safe_send_error(websocket, "통화 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.")
        await _safe_close(websocket, _CLOSE_SERVER_ERROR)
        return

    # 정상 종료
    await _safe_close(websocket)


async def _uplink(websocket: WebSocket, session) -> None:
    """클라이언트 → Gemini 업링크.

    - binary 메시지: 마이크 PCM16 16kHz 청크 → realtime audio 전송
    - text 메시지(JSON): 제어 프로토콜 (end_turn / text)
    """
    while True:
        message = await websocket.receive()
        msg_type = message.get("type")
        if msg_type == "websocket.disconnect":
            raise WebSocketDisconnect()

        # 바이너리 = 오디오 청크
        data = message.get("bytes")
        if data is not None:
            # Gemini 세션 send 실패 시 통화가 조용히 끊기지 않도록 error 프레임 전송 후 종료
            try:
                await session.send(
                    input={"data": data, "mime_type": "audio/pcm;rate=16000"}
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("uplink session.send (audio) failed: %s", type(exc).__name__)
                await _safe_send_error(websocket, "통화 전송 중 오류가 발생했습니다.")
                raise
            continue

        # 텍스트 = 제어 메시지(JSON)
        text = message.get("text")
        if text is None:
            continue
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            continue

        ctrl = payload.get("type")
        try:
            if ctrl == "end_turn":
                # 빈 audio 컨텍스트로 턴 종료 신호 — 텍스트 없이 모델 응답 유도
                await session.send(input=".", end_of_turn=True)
            elif ctrl == "text":
                user_text = payload.get("text", "")
                if user_text:
                    await session.send(input=user_text, end_of_turn=True)
        except Exception as exc:  # noqa: BLE001
            logger.warning("uplink session.send (control) failed: %s", type(exc).__name__)
            await _safe_send_error(websocket, "통화 전송 중 오류가 발생했습니다.")
            raise


async def _downlink(websocket: WebSocket, session) -> None:
    """Gemini → 클라이언트 다운링크.

    모델 오디오 청크(PCM16 24kHz)를 binary WS 메시지로 그대로 전달한다.
    """
    async for response in session.receive():
        sc = response.server_content
        if sc is None:
            continue
        if sc.model_turn:
            for part in sc.model_turn.parts:
                if part.inline_data and part.inline_data.data:
                    await websocket.send_bytes(part.inline_data.data)
        # turn_complete 신호를 프론트에 알림(다음 발화 가능 표시용)
        if sc.turn_complete:
            await websocket.send_text(json.dumps({"type": "turn_complete"}))


async def _safe_send_error(websocket: WebSocket, message: str) -> None:
    """오류 메시지를 best-effort 로 전송(이미 끊겼으면 무시)."""
    try:
        if websocket.application_state == WebSocketState.CONNECTED:
            await websocket.send_text(json.dumps({"type": "error", "message": message}))
    except Exception:
        pass


async def _safe_close(websocket: WebSocket, code: int = 1000) -> None:
    """WebSocket graceful close (이미 닫혔으면 무시)."""
    try:
        if websocket.application_state == WebSocketState.CONNECTED:
            await websocket.close(code=code)
    except Exception:
        pass

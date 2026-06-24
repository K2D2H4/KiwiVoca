"""가상 전화 WebSocket 릴레이 회귀 + 행동 테스트.

대상: app/routers/call.py 의 /api/call/ws

가장 중요한 케이스는 test_multiturn_survives_first_turn_complete 다:
google-genai 의 session.receive() 가 "한 턴마다 종료"되는 제너레이터이므로,
_downlink 가 while True 외부 루프로 다음 턴을 계속 수신하지 않으면 AI 첫 턴
종료 직후 통화가 끊긴다(close 1000). 이 테스트는 그 회귀를 잡는다.

실제 Gemini API 는 절대 호출하지 않는다(FakeClient 로 monkeypatch).
"""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

import app.routers.call as call_router
from app.main import app
from tests.fake_gemini import (
    make_client_factory,
    make_failing_connect_factory,
)


def _patch_gemini(monkeypatch, factory):
    """app.routers.call 의 genai.Client 를 fake 팩토리로 교체."""
    monkeypatch.setattr(call_router.genai, "Client", factory)


def _close_code(ws) -> int:
    """서버가 accept 후 close 한 경우의 close 코드를 읽는다.

    측정된 starlette 0.41.3 동작: 서버가 accept() 후 close(code) 하면
    raw ws.receive() 가 {'type':'websocket.close','code':<int>,...} 를 반환한다
    (WebSocketDisconnect 를 던지지 않음). 그 code 를 반환한다.
    """
    msg = ws.receive()
    assert msg.get("type") == "websocket.close", f"close 프레임 기대, got {msg}"
    return msg.get("code")


# ---------------------------------------------------------------------------
# 회귀 핵심: 멀티턴 생존
# ---------------------------------------------------------------------------
def test_multiturn_survives_first_turn_complete(seeded, monkeypatch):
    """[회귀 핵심] AI 가 2턴 이상 보낼 때 첫 turn_complete 이후에도
    WebSocket 이 닫히지 않고 두 번째 턴 오디오/turn_complete 가 전달된다.

    수정 전(_downlink 가 receive() 를 1회만 순회)이면 첫 턴 종료 직후
    서버가 close(1000) 하므로, 두 번째 턴 오디오를 받으려는 순간
    WebSocketDisconnect 가 발생해 이 테스트가 FAIL 한다.
    """
    turns = [
        [b"turn1-audio-a", b"turn1-audio-b"],  # 1턴: 오디오 2청크 + turn_complete
        [b"turn2-audio-a"],                     # 2턴: 오디오 1청크 + turn_complete
    ]
    factory, _ = make_client_factory(turns)
    _patch_gemini(monkeypatch, factory)

    client = TestClient(app)
    deck_id = seeded["deck_id"]
    token = seeded["token_a"]

    with client.websocket_connect(f"/api/call/ws?token={token}&deck_id={deck_id}") as ws:
        # 1) ready 프레임
        ready = ws.receive_json()
        assert ready["type"] == "ready"
        assert ready["target_words"] == ["apple", "banana"]

        # 2) 1턴 오디오 2청크
        assert ws.receive_bytes() == b"turn1-audio-a"
        assert ws.receive_bytes() == b"turn1-audio-b"
        # 3) 1턴 turn_complete
        tc1 = ws.receive_json()
        assert tc1["type"] == "turn_complete"

        # 4) [회귀 지점] 첫 turn_complete 이후에도 살아있어야 한다.
        #    버그 버전이면 여기서 서버가 이미 close → 아래 수신이 끊긴다.
        assert ws.receive_bytes() == b"turn2-audio-a"
        tc2 = ws.receive_json()
        assert tc2["type"] == "turn_complete"
        # 여기까지 도달 = 멀티턴 생존 확인. 컨텍스트 종료 시 클라이언트가 WS 를 닫고
        # 서버 downlink 는 cancel 된다.


# ---------------------------------------------------------------------------
# 정상 종료: 클라이언트가 닫으면 서버도 깨끗이 종료
# ---------------------------------------------------------------------------
def test_client_close_clean_shutdown(seeded, monkeypatch):
    """클라이언트가 WS 를 닫으면 서버가 예외/행 없이 종료된다."""
    turns = [[b"hi"]]  # 1턴만, 이후 receive() 는 무한 대기
    factory, _ = make_client_factory(turns)
    _patch_gemini(monkeypatch, factory)

    client = TestClient(app)
    deck_id = seeded["deck_id"]
    token = seeded["token_a"]

    with client.websocket_connect(f"/api/call/ws?token={token}&deck_id={deck_id}") as ws:
        assert ws.receive_json()["type"] == "ready"
        assert ws.receive_bytes() == b"hi"
        assert ws.receive_json()["type"] == "turn_complete"
        # 컨텍스트 매니저 종료 = 클라이언트 close. 서버는 uplink 의
        # WebSocketDisconnect 로 종료하고 downlink 를 cancel 해야 한다(행 없음).


# ---------------------------------------------------------------------------
# 인증 실패: 토큰 없음 / 무효 → close 4401
# ---------------------------------------------------------------------------
def test_no_token_closes_4401(seeded, monkeypatch):
    factory, _ = make_client_factory([[b"x"]])
    _patch_gemini(monkeypatch, factory)
    client = TestClient(app)
    deck_id = seeded["deck_id"]
    with client.websocket_connect(f"/api/call/ws?deck_id={deck_id}") as ws:
        assert _close_code(ws) == 4401


def test_invalid_token_closes_4401(seeded, monkeypatch):
    factory, _ = make_client_factory([[b"x"]])
    _patch_gemini(monkeypatch, factory)
    client = TestClient(app)
    deck_id = seeded["deck_id"]
    with client.websocket_connect(
        f"/api/call/ws?token=not-a-real-token&deck_id={deck_id}"
    ) as ws:
        assert _close_code(ws) == 4401


# ---------------------------------------------------------------------------
# 덱 미지정 → 4404
# ---------------------------------------------------------------------------
def test_missing_deck_closes_4404(seeded, monkeypatch):
    factory, _ = make_client_factory([[b"x"]])
    _patch_gemini(monkeypatch, factory)
    client = TestClient(app)
    token = seeded["token_a"]
    with client.websocket_connect(f"/api/call/ws?token={token}") as ws:
        assert _close_code(ws) == 4404


# ---------------------------------------------------------------------------
# 접근 불가 덱(타인 비공개) → 4403  (소유권 격리)
# ---------------------------------------------------------------------------
def test_forbidden_deck_closes_4403(seeded, monkeypatch):
    """사용자 B 토큰으로 사용자 A 의 비공개 덱 접근 → 4403."""
    factory, _ = make_client_factory([[b"x"]])
    _patch_gemini(monkeypatch, factory)
    client = TestClient(app)
    deck_id = seeded["deck_id"]  # A 소유, 비공개
    token_b = seeded["token_b"]  # 타인
    with client.websocket_connect(
        f"/api/call/ws?token={token_b}&deck_id={deck_id}"
    ) as ws:
        assert _close_code(ws) == 4403


# ---------------------------------------------------------------------------
# Gemini 세션 오픈 실패 → error 프레임 + close 4500
# ---------------------------------------------------------------------------
def test_gemini_connect_failure_error_then_4500(seeded, monkeypatch):
    factory, _ = make_failing_connect_factory(RuntimeError("boom"))
    _patch_gemini(monkeypatch, factory)
    client = TestClient(app)
    deck_id = seeded["deck_id"]
    token = seeded["token_a"]
    with client.websocket_connect(
        f"/api/call/ws?token={token}&deck_id={deck_id}"
    ) as ws:
        # 세션 오픈 실패 시 라우터가 error 프레임을 먼저 보낸 뒤 close(4500)
        err = ws.receive_json()
        assert err["type"] == "error"
        assert _close_code(ws) == 4500

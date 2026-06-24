"""call 라우터용 가짜(fake) Gemini Live 세션.

실제 google-genai 1.2.0 의 동작을 측정한 사실에 맞춰 흉내낸다:
- `client.aio.live.connect(...)` 는 @asynccontextmanager 로, async with 로 진입하면
  AsyncSession 을 yield 한다.
- `session.receive()` 는 "한 번의 호출이 한 model turn 만" yield 하고 종료하는
  async generator 다. (docstring: "The returned responses will represent a
  complete model turn".) 즉 다음 턴을 받으려면 receive() 를 다시 호출해야 한다.
  → 이것이 회귀의 핵심. 버그 버전 _downlink 는 receive() 를 한 번만 돌아
    첫 turn_complete 직후 코루틴이 종료된다.

라우터가 접근하는 속성만 최소로 제공한다:
  response.server_content -> .model_turn(.parts[].inline_data.data) / .turn_complete
"""
from __future__ import annotations

import asyncio
import contextlib
from types import SimpleNamespace


def _audio_part(data: bytes) -> SimpleNamespace:
    return SimpleNamespace(inline_data=SimpleNamespace(data=data))


def _audio_message(data: bytes) -> SimpleNamespace:
    """오디오 청크가 담긴 turn-중간 메시지(turn_complete=False)."""
    return SimpleNamespace(
        server_content=SimpleNamespace(
            model_turn=SimpleNamespace(parts=[_audio_part(data)]),
            turn_complete=False,
        )
    )


def _turn_complete_message() -> SimpleNamespace:
    """turn_complete=True 신호 메시지(오디오 없음)."""
    return SimpleNamespace(
        server_content=SimpleNamespace(model_turn=None, turn_complete=True)
    )


class FakeSession:
    """가짜 Gemini Live 세션.

    turns: 각 원소가 한 턴의 오디오 청크 리스트.
      예) [[b"a1", b"a2"], [b"b1"]] -> 2턴, 각 턴 끝에 turn_complete.

    receive() 는 호출될 때마다 다음 턴 하나만 yield 한다(실제 동작과 동일).
    모든 턴 소진 후 receive() 가 다시 호출되면, 실제 라이브러리에서 연결이
    살아있는 동안 다음 서버 메시지를 기다리는 것과 같이 영원히 대기(block)한다.
    이는 '연결이 끊기지 않는 한 downlink 가 다음 턴을 계속 기다린다'는
    상황을 재현한다.
    """

    def __init__(self, turns: list[list[bytes]]):
        self._turns = list(turns)
        self._turn_index = 0
        self.sent: list = []  # send() 로 전달된 입력 기록(검증용)

    async def send(self, *args, **kwargs):
        # no-op: 실제 Gemini 로 절대 전송하지 않는다. 호출만 기록.
        self.sent.append((args, kwargs))

    async def receive(self):
        """한 번 호출 = 한 model turn 만 yield 후 종료(실제 동작 모사)."""
        if self._turn_index < len(self._turns):
            chunks = self._turns[self._turn_index]
            self._turn_index += 1
            for chunk in chunks:
                yield _audio_message(chunk)
            yield _turn_complete_message()
            return
        # 더 줄 턴이 없으면: 연결이 살아있는 동안 다음 서버 메시지를 무한 대기.
        # (테스트는 이 시점 전에 클라이언트가 WS 를 닫거나 검증을 끝낸다.)
        await asyncio.Event().wait()
        if False:  # pragma: no cover - async generator 로 만들기 위한 더미 yield
            yield None


class FailingSession(FakeSession):
    """connect 진입 후 receive 호출 시 즉시 예외를 던지는 세션(필요 시 사용)."""

    async def receive(self):  # pragma: no cover - 현재 테스트에서 미사용
        raise RuntimeError("simulated downlink failure")
        if False:
            yield None


class FakeClient:
    """genai.Client 대체.

    connect_factory: () -> FakeSession 을 만드는 콜러블.
    connect_error: 설정 시 connect 진입(__aenter__) 자체가 예외를 던진다
      (Gemini 세션 오픈 실패 케이스).
    """

    def __init__(self, *, connect_factory=None, connect_error: Exception | None = None):
        self._connect_factory = connect_factory
        self._connect_error = connect_error
        self.last_session: FakeSession | None = None
        # 라우터가 client.aio.live.connect 로 접근하므로 동일 경로 제공
        self.aio = SimpleNamespace(live=SimpleNamespace(connect=self._connect))

    def _connect(self, *, model: str, config=None):
        outer = self

        @contextlib.asynccontextmanager
        async def _cm():
            if outer._connect_error is not None:
                raise outer._connect_error
            session = outer._connect_factory()
            outer.last_session = session
            try:
                yield session
            finally:
                pass

        return _cm()


def make_client_factory(turns: list[list[bytes]]):
    """genai.Client(api_key=...) 호출을 가로채 FakeClient 를 반환하는 팩토리."""
    holder = {}

    def _factory(*args, **kwargs):
        client = FakeClient(connect_factory=lambda: FakeSession(turns))
        holder["client"] = client
        return client

    return _factory, holder


def make_failing_connect_factory(error: Exception):
    """connect 진입 자체가 실패하는 FakeClient 를 반환하는 팩토리."""
    holder = {}

    def _factory(*args, **kwargs):
        client = FakeClient(connect_error=error)
        holder["client"] = client
        return client

    return _factory, holder

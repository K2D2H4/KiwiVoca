"""call WebSocket 회귀 테스트용 pytest 픽스처.

이 테스트 스위트는 가상 전화(call) 기능의 WebSocket 릴레이만 검증한다.
전체 앱용 테스트 프레임워크가 아니라 call 회귀에 집중한 최소 인프라다.

핵심 격리 전략:
- DB: SQLite 인메모리(StaticPool, 단일 연결 공유)로 실제 테이블 생성 후
      app.database.SessionLocal 을 rebind. 인증/소유권 로직을 진짜로 통과시킨다.
- Gemini: app.routers.call 의 genai.Client 를 fake 로 monkeypatch.
          실제 Gemini API/네트워크는 절대 호출하지 않는다.
"""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# 모델을 import 해야 Base.metadata 에 테이블이 등록된다.
import app.database as database
from app.database import Base
from app.models.card import Card
from app.models.deck import Deck
from app.models.user import User
from app.utils.security import create_access_token


@pytest.fixture()
def db_engine():
    """SQLite 인메모리 엔진 + 전체 스키마 생성.

    StaticPool + check_same_thread=False 로 TestClient(별도 스레드)와
    동일 인메모리 DB 를 공유한다.
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def session_local(db_engine, monkeypatch):
    """app.database.SessionLocal 을 인메모리 엔진으로 rebind.

    call 라우터/서비스가 모두 SessionLocal() 을 직접 호출하므로,
    모듈 속성을 교체해 테스트 DB 를 사용하게 한다.
    """
    TestSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=db_engine
    )
    # 라우터는 `from app.database import SessionLocal` 로 모듈 전역에 바인딩하므로
    # 그 참조까지 함께 교체한다.
    import app.routers.call as call_router

    monkeypatch.setattr(database, "SessionLocal", TestSessionLocal)
    monkeypatch.setattr(call_router, "SessionLocal", TestSessionLocal)
    return TestSessionLocal


@pytest.fixture()
def seeded(session_local):
    """기본 시드: 사용자 A(소유), 사용자 B(타인), A의 비공개 덱 + 카드.

    반환: dict(user_a, user_b, deck, token_a, token_b)
    """
    db = session_local()
    try:
        user_a = User(
            email="qa-a@kiwivoca.test",
            password_hash="x",
            display_name="QA A",
            auth_provider="local",
        )
        user_b = User(
            email="qa-b@kiwivoca.test",
            password_hash="x",
            display_name="QA B",
            auth_provider="local",
        )
        db.add_all([user_a, user_b])
        db.flush()

        deck = Deck(
            user_id=user_a.id,
            title="QA Deck",
            lang_term="en",
            lang_def="ko",
            kind="vocab",
            is_public=False,
        )
        db.add(deck)
        db.flush()

        db.add_all(
            [
                Card(deck_id=deck.id, term="apple", definition="사과", position=0),
                Card(deck_id=deck.id, term="banana", definition="바나나", position=1),
            ]
        )
        db.commit()

        return {
            "user_a_id": user_a.id,
            "user_b_id": user_b.id,
            "deck_id": deck.id,
            "token_a": create_access_token(user_a.id),
            "token_b": create_access_token(user_b.id),
        }
    finally:
        db.close()

"""가상 전화(Gemini Live API) 서비스 — 덱 컨텍스트 로드 + system_instruction 구성.

WebSocket 라우터(app/routers/call.py)가 사용한다.
- 소유 또는 공개 덱만 접근 허용(타인 비공개 덱 거부).
- 덱의 카드(term/definition/example)로 튜터 프롬프트를 구성한다.
- API 키/오디오 bytes 는 절대 로그로 출력하지 않는다.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.card import Card
from app.models.deck import Deck
from app.models.user import User

# system_instruction 에 포함할 최대 카드 수 (프롬프트 비대화 방지)
MAX_CONTEXT_CARDS = 30
# ready 메시지로 프론트에 전달할 target_words 최대 수
MAX_TARGET_WORDS = 30

# Gemini Live 모델 (네이티브 오디오, 검증 완료)
LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-09-2025"


class DeckNotAccessible(Exception):
    """덱이 없거나, 타인의 비공개 덱이라 접근 불가."""


def load_deck_for_call(db: Session, user: User, deck_id: int) -> tuple[Deck, list[Card]]:
    """전화 컨텍스트용 덱 + 카드 로드.

    소유(deck.user_id == user.id) 또는 공개(is_public=True) 덱만 허용.
    그 외에는 DeckNotAccessible 발생(존재 노출 회피 위해 라우터에서 close 처리).
    """
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if deck is None:
        raise DeckNotAccessible()
    if deck.user_id != user.id and not deck.is_public:
        raise DeckNotAccessible()

    cards = (
        db.execute(
            select(Card)
            .where(Card.deck_id == deck.id)
            .order_by(Card.position.asc(), Card.id.asc())
            .limit(MAX_CONTEXT_CARDS)
        )
        .scalars()
        .all()
    )
    return deck, list(cards)


def target_words(cards: list[Card]) -> list[str]:
    """프론트 자막/칩 표시용 학습 단어 목록(term)."""
    return [c.term for c in cards[:MAX_TARGET_WORDS]]


def build_system_instruction(deck: Deck, cards: list[Card]) -> str:
    """튜터용 system_instruction 문자열 구성.

    학습 언어(deck.lang_term)로 자연스러운 일상 대화를 하되,
    덱의 표현(term — definition)을 의도적으로 자주 사용하고
    학습자가 쓰도록 유도하게 한다.
    """
    # 카드 목록을 "term — definition (예: example)" 형태로 정리
    lines: list[str] = []
    for c in cards:
        line = f"- {c.term} — {c.definition}"
        if c.example:
            line += f" (e.g. {c.example})"
        lines.append(line)
    vocab_block = "\n".join(lines) if lines else "(no specific vocabulary provided)"

    kind_label = "grammar points" if deck.kind == "grammar" else "vocabulary"

    # 프롬프트는 영어로 작성하되 대상 언어 코드를 명시한다.
    return (
        "You are a warm, encouraging phone-call partner and language tutor. "
        f"The learner is studying the language with code '{deck.lang_term}', and is "
        f"currently practicing the following {kind_label}:\n"
        f"{vocab_block}\n\n"
        f"Have a natural, friendly everyday phone conversation in the '{deck.lang_term}' "
        "language. Deliberately and frequently weave in the expressions above, and gently "
        "prompt the learner to use them too. Speak slowly and clearly with simple sentences, "
        "keep an encouraging tone, and occasionally give light, kind corrections. "
        "Keep your turns fairly short so it feels like a real back-and-forth call."
    )


def live_config(deck: Deck, cards: list[Card]) -> dict:
    """Gemini Live connect 용 config (AUDIO 응답 + system_instruction).

    google-genai 1.2.0 LiveConnectConfig 는 입출력 전사(transcription)를
    지원하지 않으므로, 응답 modality 는 AUDIO 만 사용한다.
    """
    return {
        "response_modalities": ["AUDIO"],
        "system_instruction": {
            "parts": [{"text": build_system_instruction(deck, cards)}]
        },
    }

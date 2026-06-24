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

# 통화 연결 직후 AI가 먼저 인사하도록 유도하는 킥오프 신호.
# 사용자 발화가 아니라 "지금 네가 먼저 말할 차례"라는 무대 지시(stage direction)로,
# 모델이 그대로 읽지 않고 행동(첫 인사 발화)하도록 대괄호로 감싼다.
GREETING_KICKOFF = (
    "[The phone just connected. You are the caller, so speak first now: "
    "greet me warmly and kick off the conversation.]"
)

# 언어 코드 → 영어 표기 (system_instruction 을 모델이 명확히 이해하도록).
# 미등록 코드는 코드 문자열을 그대로 사용한다.
_LANG_NAMES = {
    "ko": "Korean",
    "en": "English",
    "ja": "Japanese",
    "zh": "Chinese",
    "ru": "Russian",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "vi": "Vietnamese",
}


def _lang_name(code: str) -> str:
    return _LANG_NAMES.get(code, code)


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
    """Gemini Live 튜터 페르소나용 system_instruction 구성.

    "키위(Kiwi)"라는 친근한 친구 캐릭터가 학습 언어(deck.lang_term)로
    친구처럼 편한 반말 대화를 하되, 덱의 표현(term — definition)을 자주 쓰고
    학습자도 쓰도록 유도한다. 말투는 통화 내내 일관되게 친근/캐주얼을 유지한다.
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
    target_lang = _lang_name(deck.lang_term)
    native_lang = _lang_name(deck.lang_def)

    # 프롬프트는 영어로 작성하되 대상/모국 언어를 명시한다.
    return (
        "You are 키위 (Kiwi), a cheerful, warm little kiwi-bird buddy who is calling "
        "the learner on the phone. You are a close friend hanging out on a call — NOT a "
        "formal teacher. The goal is a fun, relaxed chat where you naturally slip in the "
        "words your friend is studying.\n\n"
        "# Who you're talking to\n"
        f"Your friend is learning {target_lang}. Their native language is {native_lang}. "
        f"Right now they're practicing this {kind_label}:\n"
        f"{vocab_block}\n\n"
        "# How you talk\n"
        f"- Speak in {target_lang} as the main language of the call.\n"
        "- Keep ONE consistent tone for the whole call: casual, warm, playful — the way "
        "you'd talk to a close friend. Never switch into a stiff or formal register.\n"
        "- For languages that have politeness levels (Korean, Japanese, etc.), stay in "
        "the casual/intimate friend register the ENTIRE call — Korean 반말, Japanese "
        "タメ口. Never use 존댓말 / polite-formal endings, not even once.\n"
        "- Use short, simple sentences. React, laugh, ask little follow-up questions — "
        "make it feel like a real back-and-forth phone call between friends, not a lesson.\n"
        f"- Naturally and frequently work the {kind_label} above into the chat, and gently "
        "nudge your friend to use them too.\n"
        f"- If your friend gets stuck, you can briefly drop into {native_lang} to help or "
        "cheer them on — but keep the SAME casual, friendly register there too.\n"
        "- Give light, kind corrections only when it actually helps; never nitpick.\n"
        "- Keep your turns short so it stays a real conversation, not a monologue.\n\n"
        "# Starting the call\n"
        "You are the one who called, so YOU speak first. Open with a warm, casual greeting "
        f"in {target_lang}, quickly say it's you (키위), and kick things off with a light, "
        "friendly question — like an old friend who just called to catch up."
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

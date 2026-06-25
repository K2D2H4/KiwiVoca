"""문법 학습 라우터 (prefix /api/grammar).

- POST /extract: 문법 노트 이미지 → Gemini 추출 (검수용, 미저장)
- POST /generate: 텍스트 프롬프트 → Gemini 생성 (검수용, 미저장)
- POST /commit: 검수한 항목 배열 → 기존/새 grammar 덱에 일괄 저장
- GET /filters: 다단계 필터(레벨→카테고리 계층 + 개수)
- POST /practice: 선택 항목으로부터 연습문제를 즉석 생성(미저장)
- POST /answer: 항목 진척 라이트너 박스 upsert
- POST /learned: 항목 학습완료 토글

GET /api/decks/{deck_id}/grammar 는 deck 컨텍스트라 별도 함수로 같은 파일에 둔다.
모든 작업은 현재 사용자 소유권을 검증한다 (타인/미존재는 404).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.database import get_db
from app.models.deck import Deck
from app.models.grammar_item import GrammarItem
from app.models.grammar_progress import GrammarProgress
from app.models.user import User
from app.schemas.deck import DeckResponse
from app.schemas.grammar import (
    CandidatesResponse,
    CategoryCount,
    FiltersResponse,
    GenerateRequest,
    GrammarAnswerRequest,
    GrammarAnswerResponse,
    GrammarCommitRequest,
    GrammarCommitResponse,
    GrammarItemCandidate,
    GrammarLearnedRequest,
    GrammarLearnedResponse,
    GrammarProgressInfo,
    LevelGroup,
    PracticeProblem,
    PracticeRequest,
    PracticeResponse,
)
from app.services.grammar_service import (
    SUPPORTED_IMAGE_MIME,
    GrammarError,
    extract_grammar_from_images,
    generate_grammar,
    generate_problems_for_items,
)
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/grammar", tags=["grammar"])

_DECK_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="덱을 찾을 수 없습니다."
)
_ITEM_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="문법 항목을 찾을 수 없습니다."
)

# 업로드 제한 (import 라우터와 동일)
MAX_IMAGES = 10
MAX_TOTAL_BYTES = 25 * 1024 * 1024  # 25MB 합계

# 라이트너 박스 경계
_BOX_MIN = 0
_BOX_MAX = 5


# ----------------------------- 소유권 헬퍼 -----------------------------

def _parse_deck_ids(raw: str) -> list[int]:
    """콤마 구분 deck_ids 파싱 (예: '1,2'). 형식 오류/빈 값이면 422."""
    ids: list[int] = []
    for token in raw.split(","):
        token = token.strip()
        if not token:
            continue
        try:
            ids.append(int(token))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="deck_ids 형식이 올바르지 않습니다(콤마 구분 정수).",
            )
    if not ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="deck_ids 가 비어 있습니다.",
        )
    return ids


def _verify_owned_decks(db: Session, user: User, deck_ids: list[int]) -> None:
    """deck_ids 가 모두 현재 사용자 소유인지 검증. 하나라도 아니면 404."""
    unique_ids = set(deck_ids)
    owned = (
        db.query(Deck.id)
        .filter(Deck.id.in_(unique_ids), Deck.user_id == user.id)
        .all()
    )
    if len({row[0] for row in owned}) != len(unique_ids):
        raise _DECK_NOT_FOUND


def _get_owned_grammar_item(db: Session, user: User, item_id: int) -> GrammarItem:
    """현재 사용자 소유의 문법 항목 조회 (item -> deck -> user). 없거나 타인 소유면 404."""
    item = (
        db.query(GrammarItem)
        .join(Deck, GrammarItem.deck_id == Deck.id)
        .filter(GrammarItem.id == item_id, Deck.user_id == user.id)
        .first()
    )
    if item is None:
        raise _ITEM_NOT_FOUND
    return item


def _progress_info(progress: GrammarProgress | None) -> GrammarProgressInfo:
    """진척 행(없을 수 있음) → 응답용 진척 정보. 없으면 box=0/미학습."""
    if progress is None:
        return GrammarProgressInfo(
            box=_BOX_MIN, correct_count=0, wrong_count=0, is_learned=False, last_studied_at=None
        )
    return GrammarProgressInfo(
        box=progress.box,
        correct_count=progress.correct_count,
        wrong_count=progress.wrong_count,
        is_learned=progress.is_learned,
        last_studied_at=progress.last_studied_at,
    )


# ----------------------------- 추출 / 생성 -----------------------------

@router.post("/extract", response_model=CandidatesResponse)
async def extract(
    files: list[UploadFile] = File(...),
    lang_term: str = Form("en"),
    lang_def: str = Form("ko"),
    current_user: User = Depends(get_current_user),
) -> CandidatesResponse:
    """문법 노트 이미지(1~N장)에서 문법 항목 후보를 추출한다 (미저장)."""
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="이미지를 1장 이상 업로드해주세요."
        )
    if len(files) > MAX_IMAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"이미지는 최대 {MAX_IMAGES}장까지 업로드할 수 있습니다.",
        )

    images: list[bytes] = []
    mimes: list[str] = []
    total = 0
    for f in files:
        mime = (f.content_type or "").lower()
        if mime not in SUPPORTED_IMAGE_MIME:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="지원하지 않는 파일 형식입니다. PNG/JPG/WEBP 이미지를 업로드해주세요.",
            )
        data = await f.read()
        total += len(data)
        if total > MAX_TOTAL_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="이미지 총 용량이 25MB를 초과했습니다.",
            )
        images.append(data)
        mimes.append(mime)

    try:
        candidates = await run_in_threadpool(
            extract_grammar_from_images,
            images=images,
            image_mimes=mimes,
            lang_term=lang_term,
            lang_def=lang_def,
        )
    except GrammarError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=exc.message
        ) from exc

    return CandidatesResponse(
        candidates=[GrammarItemCandidate(**c) for c in candidates]
    )


@router.post("/generate", response_model=CandidatesResponse)
async def generate(
    payload: GenerateRequest,
    current_user: User = Depends(get_current_user),
) -> CandidatesResponse:
    """텍스트 프롬프트로 문법 항목 후보를 생성한다 (미저장)."""
    try:
        candidates = await run_in_threadpool(
            generate_grammar,
            lang_term=payload.lang_term,
            lang_def=payload.lang_def,
            level=payload.level,
            topic=payload.topic,
            count=payload.count,
        )
    except GrammarError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=exc.message
        ) from exc

    return CandidatesResponse(
        candidates=[GrammarItemCandidate(**c) for c in candidates]
    )


# ----------------------------- 커밋 -----------------------------

@router.post("/commit", response_model=GrammarCommitResponse, status_code=status.HTTP_201_CREATED)
def commit(
    payload: GrammarCommitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GrammarCommitResponse:
    """검수한 문법 항목 배열을 기존/새 grammar 덱에 일괄 저장한다.

    deck_id: 기존 덱(소유 검증) / new_deck: 새 grammar 덱 생성.
    """
    if payload.deck_id is not None:
        deck = (
            db.query(Deck)
            .filter(Deck.id == payload.deck_id, Deck.user_id == current_user.id)
            .first()
        )
        if deck is None:
            raise _DECK_NOT_FOUND
        if deck.kind != "grammar":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="문법 덱에만 추가할 수 있어요.",
            )
    else:
        nd = payload.new_deck
        deck = Deck(
            user_id=current_user.id,
            title=nd.title,
            description=nd.description,
            lang_term=nd.lang_term,
            lang_def=nd.lang_def,
            kind="grammar",
            is_public=False,
        )
        db.add(deck)
        db.flush()  # deck.id 확보

    # 다음 position (덱 끝에 이어 붙임)
    current_max = (
        db.query(func.max(GrammarItem.position))
        .filter(GrammarItem.deck_id == deck.id)
        .scalar()
    )
    base = 0 if current_max is None else current_max + 1

    # 항목만 저장한다. 연습문제는 저장하지 않고 연습 시작 때 즉석 생성한다.
    for offset, item in enumerate(payload.items):
        gi = GrammarItem(
            deck_id=deck.id,
            point=item.point,
            explanation=item.explanation,
            example=item.example,
            level=item.level,
            category=item.category,
            position=base + offset,
        )
        db.add(gi)

    db.commit()
    db.refresh(deck)

    item_count = (
        db.query(func.count(GrammarItem.id))
        .filter(GrammarItem.deck_id == deck.id)
        .scalar()
        or 0
    )
    deck_resp = DeckResponse.model_validate(deck)
    deck_resp.card_count = 0  # grammar 덱은 단어 카드 0
    deck_resp.grammar_count = item_count  # 문법 항목 수는 grammar_count 로 노출

    return GrammarCommitResponse(deck=deck_resp, item_count=len(payload.items))


# ----------------------------- 필터 -----------------------------

@router.get("/filters", response_model=FiltersResponse)
def get_filters(
    deck_ids: str = Query(..., description="콤마 구분 덱 ID (예: 1,2)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FiltersResponse:
    """다단계 필터용 레벨→카테고리 계층 + 개수. 소유 덱만."""
    ids = _parse_deck_ids(deck_ids)
    _verify_owned_decks(db, current_user, ids)
    unique_ids = list(set(ids))

    rows = db.execute(
        select(GrammarItem.level, GrammarItem.category, func.count(GrammarItem.id))
        .where(GrammarItem.deck_id.in_(unique_ids))
        .group_by(GrammarItem.level, GrammarItem.category)
    ).all()

    # 레벨 → 카테고리 계층 집계
    levels: dict[str, dict] = {}
    for level, category, count in rows:
        lvl = levels.setdefault(level or "", {"count": 0, "categories": {}})
        lvl["count"] += count
        lvl["categories"][category or ""] = lvl["categories"].get(category or "", 0) + count

    result = [
        LevelGroup(
            level=level,
            count=data["count"],
            categories=[
                CategoryCount(category=cat, count=cnt)
                for cat, cnt in sorted(data["categories"].items())
            ],
        )
        for level, data in sorted(levels.items())
    ]
    return FiltersResponse(levels=result)


# ----------------------------- 연습 출제 (즉석 생성) -----------------------------

@router.post("/practice", response_model=PracticeResponse)
async def start_practice(
    payload: PracticeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PracticeResponse:
    """선택된 덱/필터로 문법 항목을 고른 뒤, 그 항목들로부터 연습문제를 즉석 생성한다.

    문제는 저장하지 않는다. levels/categories 다중 필터, scope=unlearned 면 학습완료 제외,
    order=weak(약한 항목 우선)|random, limit=0 전체. 항목 0개면 빈 problems.
    Gemini 실패는 502(한국어) 로 매핑하되, graceful 하게 동작한다.
    """
    _verify_owned_decks(db, current_user, payload.deck_ids)
    unique_ids = list(set(payload.deck_ids))

    level_list = [s for s in (payload.levels or []) if s]
    cat_list = [s for s in (payload.categories or []) if s]

    # 항목 + 현재 사용자 진척 LEFT JOIN (연습문제는 더 이상 저장하지 않으므로 로드 안 함)
    stmt = (
        select(GrammarItem, GrammarProgress)
        .outerjoin(
            GrammarProgress,
            (GrammarProgress.grammar_item_id == GrammarItem.id)
            & (GrammarProgress.user_id == current_user.id),
        )
        .where(GrammarItem.deck_id.in_(unique_ids))
    )
    if level_list:
        stmt = stmt.where(GrammarItem.level.in_(level_list))
    if cat_list:
        stmt = stmt.where(GrammarItem.category.in_(cat_list))
    if payload.scope == "unlearned":
        stmt = stmt.where(
            func.coalesce(GrammarProgress.is_learned, False).is_(False)
        )

    if payload.order == "random":
        stmt = stmt.order_by(func.random())
    else:
        box_value = func.coalesce(GrammarProgress.box, _BOX_MIN)
        stmt = stmt.order_by(
            box_value.asc(),
            GrammarProgress.last_studied_at.asc().nulls_first(),
            GrammarItem.position.asc(),
            GrammarItem.id.asc(),
        )
    if payload.limit > 0:
        stmt = stmt.limit(payload.limit)

    rows = db.execute(stmt).all()
    if not rows:
        # 선택된 항목이 없으면 Gemini 호출 없이 빈 problems
        return PracticeResponse(problems=[])

    # Gemini 즉석 생성에 넘길 항목 dict + 컨텍스트(진척/항목정보) 매핑
    items_for_gen: list[dict] = []
    context_by_id: dict[int, dict] = {}
    lang_term = "en"
    lang_def = "ko"
    for item, progress in rows:
        items_for_gen.append(
            {
                "id": item.id,
                "point": item.point,
                "explanation": item.explanation,
                "example": item.example,
                "level": item.level,
                "category": item.category,
            }
        )
        context_by_id[item.id] = {
            "point": item.point,
            "item_explanation": item.explanation,
            "level": item.level,
            "category": item.category,
            "progress": _progress_info(progress),
        }

    # 덱 언어는 첫 덱 기준(설명 언어 힌트용)
    first_deck = (
        db.query(Deck.lang_term, Deck.lang_def)
        .filter(Deck.id.in_(unique_ids))
        .first()
    )
    if first_deck is not None:
        lang_term, lang_def = first_deck[0], first_deck[1]

    try:
        problems = await run_in_threadpool(
            generate_problems_for_items,
            items=items_for_gen,
            lang_term=lang_term,
            lang_def=lang_def,
        )
    except GrammarError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=exc.message
        ) from exc

    result: list[PracticeProblem] = []
    for p in problems:
        ctx = context_by_id.get(p["item_id"])
        if ctx is None:
            continue
        result.append(
            PracticeProblem(
                item_id=p["item_id"],
                kind=p["kind"],
                prompt=p["prompt"],
                answer=p["answer"],
                options=p["options"],
                base_form=p["base_form"],
                explanation=p["explanation"],
                point=ctx["point"],
                item_explanation=ctx["item_explanation"],
                level=ctx["level"],
                category=ctx["category"],
                progress=ctx["progress"],
            )
        )
    return PracticeResponse(problems=result)


# ----------------------------- 채점 / 학습완료 -----------------------------

def _get_or_create_progress(
    db: Session, user: User, item_id: int
) -> GrammarProgress:
    """항목 진척 get-or-create. 동시 생성 경쟁은 UNIQUE + IntegrityError 재조회로 처리."""
    progress = (
        db.query(GrammarProgress)
        .filter(
            GrammarProgress.user_id == user.id,
            GrammarProgress.grammar_item_id == item_id,
        )
        .first()
    )
    if progress is not None:
        return progress

    progress = GrammarProgress(
        user_id=user.id,
        grammar_item_id=item_id,
        correct_count=0,
        wrong_count=0,
        box=_BOX_MIN,
    )
    db.add(progress)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        progress = (
            db.query(GrammarProgress)
            .filter(
                GrammarProgress.user_id == user.id,
                GrammarProgress.grammar_item_id == item_id,
            )
            .first()
        )
        if progress is None:
            raise _ITEM_NOT_FOUND
    return progress


@router.post("/answer", response_model=GrammarAnswerResponse)
def submit_answer(
    payload: GrammarAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GrammarAnswerResponse:
    """문법 항목 채점 — 라이트너 박스/진척 갱신 (upsert). 소유 검증."""
    _get_owned_grammar_item(db, current_user, payload.item_id)
    progress = _get_or_create_progress(db, current_user, payload.item_id)

    if payload.is_correct:
        progress.box = min(progress.box + 1, _BOX_MAX)
        progress.correct_count += 1
    else:
        progress.box = max(progress.box - 1, _BOX_MIN)
        progress.wrong_count += 1
    progress.last_studied_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(progress)
    return GrammarAnswerResponse(
        item_id=payload.item_id,
        box=progress.box,
        correct_count=progress.correct_count,
        wrong_count=progress.wrong_count,
    )


@router.post("/learned", response_model=GrammarLearnedResponse)
def set_learned(
    payload: GrammarLearnedRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GrammarLearnedResponse:
    """학습 완료 토글 — is_learned 설정 (upsert). 소유 검증."""
    _get_owned_grammar_item(db, current_user, payload.item_id)
    progress = _get_or_create_progress(db, current_user, payload.item_id)
    progress.is_learned = payload.is_learned

    db.commit()
    return GrammarLearnedResponse(
        item_id=payload.item_id, is_learned=payload.is_learned
    )

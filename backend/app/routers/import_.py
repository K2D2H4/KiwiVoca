"""Gemini 단어장 추출 / 커밋 라우터 (prefix /api/import).

- POST /api/import/extract: 멀티파트 이미지 + 폼 → Gemini 추출 → 후보 카드 리스트
  (자동 커밋하지 않음). ImportJob 이력 기록.
- POST /api/import/commit: 검수한 카드 배열 → 기존/새 덱에 일괄 생성.

모든 작업은 현재 사용자 소유권을 검증한다.
"""
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.database import get_db
from app.models.card import Card
from app.models.deck import Deck
from app.models.import_job import ImportJob
from app.models.user import User
from app.schemas.deck import DeckResponse
from app.schemas.import_job import (
    CommitRequest,
    CommitResponse,
    ExtractCandidate,
    ExtractResponse,
    GenerateVocabRequest,
    GenerateVocabResponse,
)
from app.services.gemini_service import (
    SUPPORTED_IMAGE_MIME,
    ExtractionError,
    extract_cards_from_images,
    generate_vocab,
)
from app.utils.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/import", tags=["import"])

# 업로드 제한
MAX_IMAGES = 10
MAX_TOTAL_BYTES = 25 * 1024 * 1024  # 25MB (합계)


@router.post("/extract", response_model=ExtractResponse)
async def extract(
    files: list[UploadFile] = File(...),
    lang_term: str = Form("en"),
    lang_def: str = Form("ko"),
    kind: str = Form("vocab"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExtractResponse:
    """이미지(1~N장)에서 학습 카드 후보를 추출한다. 자동 커밋하지 않는다."""
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="이미지를 1장 이상 업로드해주세요."
        )
    if len(files) > MAX_IMAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"이미지는 최대 {MAX_IMAGES}장까지 업로드할 수 있습니다.",
        )
    if kind not in ("vocab", "grammar"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="kind 는 vocab 또는 grammar 여야 합니다."
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

    # 작업 이력 생성 (pending)
    job = ImportJob(
        user_id=current_user.id,
        status="pending",
        image_count=len(images),
        extracted_count=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    try:
        # 동기·블로킹 Gemini 호출 — 스레드풀에서 실행해 이벤트 루프 차단 방지
        # (수초 소요 시 단일 워커의 WS/다른 요청이 정지하는 문제 해결)
        candidates = await run_in_threadpool(
            extract_cards_from_images,
            images=images,
            image_mimes=mimes,
            lang_term=lang_term,
            lang_def=lang_def,
            kind=kind,
        )
    except ExtractionError as exc:
        job.status = "failed"
        job.error = exc.message
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=exc.message
        ) from exc
    except Exception as exc:  # noqa: BLE001
        logger.error("extract unexpected error: %s", exc)
        job.status = "failed"
        job.error = "이미지 처리 중 알 수 없는 오류가 발생했습니다."
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="이미지 처리 중 오류가 발생했습니다.",
        ) from exc

    job.status = "done"
    job.extracted_count = len(candidates)
    db.commit()
    db.refresh(job)

    return ExtractResponse(
        job_id=job.id,
        image_count=job.image_count,
        extracted_count=job.extracted_count,
        candidates=[ExtractCandidate(**c) for c in candidates],
    )


@router.post("/generate", response_model=GenerateVocabResponse)
async def generate(
    payload: GenerateVocabRequest,
    current_user: User = Depends(get_current_user),
) -> GenerateVocabResponse:
    """테마 기반으로 단어 카드 후보를 생성한다 (미저장). 저장은 /commit 재사용."""
    try:
        candidates = await run_in_threadpool(
            generate_vocab,
            lang_term=payload.lang_term,
            lang_def=payload.lang_def,
            theme=payload.theme,
            level=payload.level,
            count=payload.count,
        )
    except ExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=exc.message
        ) from exc

    return GenerateVocabResponse(
        candidates=[ExtractCandidate(**c) for c in candidates]
    )


@router.post("/commit", response_model=CommitResponse, status_code=status.HTTP_201_CREATED)
def commit(
    payload: CommitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommitResponse:
    """검수한 카드 배열을 기존/새 덱에 일괄 생성한다.

    - deck_id: 기존 덱(소유 검증) 또는
    - new_deck: 새 덱 정보 → 덱 생성 후 카드 추가
    """
    # 대상 덱 확보 (소유권 검증 포함)
    if payload.deck_id is not None:
        deck = (
            db.query(Deck)
            .filter(Deck.id == payload.deck_id, Deck.user_id == current_user.id)
            .first()
        )
        if deck is None:
            # 존재 여부 노출 회피 — 404
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="덱을 찾을 수 없습니다."
            )
        if deck.kind != "vocab":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="단어 덱에만 추가할 수 있어요.",
            )
    else:
        nd = payload.new_deck
        deck = Deck(
            user_id=current_user.id,
            title=nd.title,
            description=nd.description,
            lang_term=nd.lang_term,
            lang_def=nd.lang_def,
            kind=nd.kind,
            is_public=nd.is_public,
        )
        db.add(deck)
        db.flush()  # deck.id 확보

    # 다음 position (덱 끝에 이어 붙임)
    current_max = db.query(func.max(Card.position)).filter(Card.deck_id == deck.id).scalar()
    base = 0 if current_max is None else current_max + 1

    cards: list[Card] = []
    for offset, item in enumerate(payload.cards):
        position = item.position if item.position is not None else base + offset
        cards.append(
            Card(
                deck_id=deck.id,
                term=item.term,
                reading=item.reading,
                definition=item.definition,
                example=item.example,
                position=position,
            )
        )
    db.add_all(cards)

    # 추출 작업을 덱과 연결 (내 작업일 때만)
    if payload.job_id is not None:
        job = (
            db.query(ImportJob)
            .filter(ImportJob.id == payload.job_id, ImportJob.user_id == current_user.id)
            .first()
        )
        if job is not None:
            job.deck_id = deck.id

    db.commit()
    db.refresh(deck)
    for card in cards:
        db.refresh(card)

    card_count = db.query(func.count(Card.id)).filter(Card.deck_id == deck.id).scalar() or 0
    deck_resp = DeckResponse.model_validate(deck)
    deck_resp.card_count = card_count

    return CommitResponse(deck=deck_resp, cards=cards)

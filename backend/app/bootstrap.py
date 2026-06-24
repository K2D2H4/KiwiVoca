"""컨테이너 시작 시 1회 실행 — DB 준비 대기 + 테이블 생성.

MVP 단계에서는 Base.metadata.create_all 로 스키마를 만든다.
스키마 변경 이력 관리가 필요해지면 Alembic 으로 전환한다.
"""
import time

from sqlalchemy import text

from app.config import settings
from app.database import Base, engine
# 모델을 import 해야 Base.metadata 에 테이블이 등록된다 (Phase 1+ 에서 채워짐)
from app import models  # noqa: F401


def _validate_secret_key() -> None:
    """부팅 시 SECRET_KEY 검증 — 약한/누락 값이면 기동 중단.

    config.py 기본값(dev_secret_change_me)은 로컬 import 편의를 위해 둔다.
    실제 서비스 기동은 .env 의 32자 이상 랜덤 시크릿이 있어야만 통과한다.
    HS256 대칭키 위조로 인한 전체 인증 우회를 막기 위함.
    """
    if settings.SECRET_KEY in ("dev_secret_change_me", "") or len(settings.SECRET_KEY) < 32:
        raise RuntimeError(
            "SECRET_KEY가 설정되지 않았거나 너무 약합니다(.env에 32자 이상 랜덤값 설정)."
        )


def wait_for_db(max_retries: int = 30, delay: float = 2.0) -> None:
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"[bootstrap] DB ready (attempt {attempt})")
            return
        except Exception as exc:  # noqa: BLE001
            print(f"[bootstrap] waiting for DB... ({attempt}/{max_retries}) {exc}")
            time.sleep(delay)
    raise RuntimeError("DB connection failed after retries")


def main() -> None:
    _validate_secret_key()
    wait_for_db()
    Base.metadata.create_all(bind=engine)
    print("[bootstrap] schema ready")


if __name__ == "__main__":
    main()

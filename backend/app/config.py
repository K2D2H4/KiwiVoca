"""애플리케이션 설정 — 환경변수 로딩 (pydantic-settings)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # DB
    DATABASE_URL: str = "postgresql+psycopg2://kiwivoca:kiwivoca_local_pw@db:5432/kiwivoca"

    # 인증 (JWT)
    SECRET_KEY: str = "dev_secret_change_me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    # Gemini (이미지 → 카드 추출용)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash"
    # 발음 TTS — Google Cloud Text-to-Speech (Chirp 3 HD)
    GOOGLE_TTS_API_KEY: str = ""
    GOOGLE_TTS_VOICE: str = "Achernar"  # Chirp 3 HD 별 이름(언어 공통). 예: Achernar/Aoede/Kore
    # 합성 결과 파일 캐시 디렉터리 (docker named volume 마운트 지점)
    TTS_CACHE_DIR: str = "/app/tts_cache"

    # OAuth: Google
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""

    # OAuth: Kakao
    KAKAO_CLIENT_ID: str = ""
    KAKAO_CLIENT_SECRET: str = ""
    KAKAO_REDIRECT_URI: str = ""

    # CORS — 콤마 구분
    CORS_ALLOWED_ORIGINS: str = "http://localhost:8080"

    # OAuth 콜백 후 토큰을 fragment 로 넘겨줄 프론트 base URL
    FRONTEND_BASE_URL: str = "http://localhost:8080"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ALLOWED_ORIGINS.split(",") if o.strip()]


settings = Settings()

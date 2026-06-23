# 키위보카 (KiwiVoca) 🥝

> 퀴즐렛 스타일 외국어 학습 웹앱. 단어/문법을 게임으로 학습하고, Gemini로 단어장 사진을 찍어 학습 리스트를 자동 생성한다. 모바일 우선 · 귀엽고 미니멀한 키위 테마.

## 스택
- **프론트**: Vite + React 18 + TypeScript + Tailwind CSS
- **백엔드**: FastAPI + SQLAlchemy 2.x + Pydantic v2
- **AI**: Google Gemini (단어장 이미지 추출)
- **DB**: PostgreSQL 16
- **인프라**: Docker Compose (프론트/백엔드/db/nginx 4컨테이너) + nginx 리버스 프록시

## 로컬 실행
```bash
cp .env.example .env   # 값 채우기 (GEMINI_API_KEY 등)
docker compose up -d --build
```
- 앱: http://localhost:8080
- API 헬스: http://localhost:8080/api/health
- API 문서: http://localhost:8080/docs

```bash
docker compose logs -f backend   # 로그
docker compose stop              # 중지 (volume 유지)
```
> ⚠️ `docker compose down -v` 금지 — postgres 볼륨이 삭제됩니다.

## 문서
- 아키텍처: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 개발 계획: [docs/PLAN.md](docs/PLAN.md)

## 개발 에이전트 (`.claude/agents/`)
- `backend-dev` — FastAPI/모델/인증/Gemini
- `frontend-dev` — React/Tailwind/학습게임 UI (frontend-design 스킬 사용)
- `qa` — 기능/모바일/회귀 검증 (Playwright)
- `deploy` — Docker/배포/Git workflow

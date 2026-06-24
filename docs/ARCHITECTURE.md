# 키위보카 (KiwiVoca) — 아키텍처

> 외국어 학습 웹앱. 퀴즐렛처럼 단어/문법을 게임으로 학습하고, Gemini로 단어장 사진을 찍어 학습 리스트를 자동 생성한다. 모바일 우선(데스크탑 대응) · 귀엽고 미니멀한 키위 테마.

- **레포 이름**: `KiwiVoca` · **서비스 브랜드**: 키위보카 (KiwiVoca)
- **컨테이너 prefix**: `kiwivoca`

## 1. 스택

| 레이어 | 기술 |
|---|---|
| **프론트** | Vite + React 18 + TypeScript + Tailwind CSS, react-router v6, TanStack Query, axios, zustand(가벼운 전역상태) |
| **백엔드** | FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic, python-jose(JWT), passlib[bcrypt] |
| **AI** | Google Gemini (`google-genai` SDK) — 단어장 이미지 → 구조화된 단어/문법 리스트 추출 (Vision) |
| **인증** | 이메일/비밀번호(JWT) + Google OAuth + Kakao OAuth |
| **DB** | PostgreSQL 16 (컨테이너) |
| **리버스 프록시** | nginx (`/` → 프론트, `/api` → 백엔드) |
| **컨테이너** | Docker Compose — `docker-compose.yml`(로컬) / `docker-compose.prod.yml`(VM 배포) |

> readytalk와 달리 **Celery/Redis/멀티테넌트 없음**. OCR은 FastAPI 동기 호출 + 프론트 로딩 상태로 처리(MVP). 추후 필요 시 BackgroundTask로 분리.

## 2. 컨테이너 구성 (4종, 사용자 요구사항)

```
┌─────────┐   80    ┌──────────────────────────────┐
│ Browser │ ──────► │ nginx (kiwivoca-nginx)        │
└─────────┘         │  /        → frontend:5173/80  │
                    │  /api     → backend:8000      │
                    └───────┬──────────────┬────────┘
                            │              │
                    ┌───────▼──────┐  ┌────▼─────────┐
                    │ frontend     │  │ backend      │
                    │ (Vite dev /  │  │ (FastAPI)    │
                    │  nginx build)│  │  :8000       │
                    └──────────────┘  └────┬─────────┘
                                           │
                                     ┌─────▼────────┐
                                     │ db (postgres)│
                                     │  :5432       │
                                     └──────────────┘
```

- **로컬**: 프론트는 Vite dev 서버(HMR, 볼륨 마운트), nginx가 프록시
- **prod**: 프론트는 `npm run build` 정적 산출물을 nginx가 직접 서빙, 백엔드만 별도 컨테이너

### 포트 (로컬 기본, readytalk와 충돌 회피)
- nginx: `${HOST_PORT:-8080}:80`
- postgres: `${DB_HOST_PORT:-5433}:5432`
- backend/frontend는 `expose`만 (nginx 통해 접근)

## 3. 데이터 모델 (MVP)

```
users
  id, email(unique), password_hash(nullable, OAuth-only면 null),
  display_name, avatar_url,
  auth_provider(local|google|kakao), oauth_sub(nullable),
  created_at, updated_at

decks                         # 단어장/세트 (단어·문법 공용)
  id, user_id(FK), title, description,
  lang_term(학습 언어, 예: en), lang_def(모국어, 예: ko),
  kind(vocab|grammar), card_count, is_public(default false),
  created_at, updated_at

cards
  id, deck_id(FK), term, reading(발음/요미가나 등, nullable),
  definition, example(nullable), position(정렬), created_at

card_progress                 # 학습 진척 (사용자 x 카드)
  id, user_id(FK), card_id(FK), correct_count, wrong_count,
  box(라이트너 박스 0~5, 간단 SRS), last_studied_at
  UNIQUE(user_id, card_id)

import_jobs                   # Gemini OCR 추출 이력
  id, user_id(FK), deck_id(FK, nullable), status(pending|done|failed),
  image_count, extracted_count, error(nullable), created_at
```

- 문법도 동일 `cards` 구조 사용: `term`=문법 포인트, `definition`=설명, `example`=예문. `decks.kind`로 구분.
- 모든 도메인 쿼리는 **`user_id` 소유권 검증 필수** (남의 덱 접근 차단).

## 4. 주요 API (prefix `/api`)

| 그룹 | 엔드포인트 | 설명 |
|---|---|---|
| auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me` | 이메일/JWT |
| oauth | `GET /auth/{google\|kakao}/login`, `GET /auth/{google\|kakao}/callback` | 소셜 로그인 |
| decks | `GET/POST /decks`, `GET/PATCH/DELETE /decks/{id}` | 덱 CRUD |
| cards | `GET/POST /decks/{id}/cards`, `PATCH/DELETE /cards/{id}`, `POST /decks/{id}/cards/bulk` | 카드 CRUD + 대량 추가 |
| import | `POST /import/extract` (멀티파트 이미지 → 후보 카드 리스트), `POST /import/commit` | Gemini OCR |
| study | `GET /decks/{id}/study?mode=...`, `POST /study/answer` | 학습 세션/채점/진척 |

## 5. Gemini 단어장 추출 플로우

1. 프론트: 단어장 사진 1~N장 업로드 (`/api/import/extract`)
2. 백엔드 `services/gemini_service.py`: 이미지 + 구조화 프롬프트 → Gemini Vision → **JSON 스키마**(term/reading/definition/example 배열) 강제
3. 추출 결과를 **편집 가능한 후보 리스트**로 프론트 반환 (자동 커밋 X — 사용자가 검수/수정)
4. 사용자가 확인 → `/api/import/commit` → 덱에 카드 일괄 생성

- API 키: `.env`의 `GEMINI_API_KEY` (gitignored, 절대 커밋 금지)
- 모델: `gemini-2.0-flash` 계열(저렴·빠름·vision 지원). 실패 시 graceful 에러.

## 6. 디자인 시스템 (키위 테마)

| 토큰 | 값 | 용도 |
|---|---|---|
| `kiwi` (primary) | `#7AC74F` ~ `#5FA63C` | 메인 그린 |
| `cream` (bg) | `#FBF8F0` | 배경 |
| `seed` (text) | `#2E3A24` | 진한 텍스트/씨앗 |
| `bark` (accent) | `#A67C52` | 키위 껍질 브라운 |
| `pop` (accent) | `#FF8A7A` | 코랄 — 정답/포인트 강조 |

- **모바일 우선**: 하단 탭바 네비, 풀폭 카드, 큰 터치 타겟(≥44px), 스와이프 제스처(플래시카드)
- **데스크탑**: 중앙 정렬 max-width 컨테이너 + 좌측 사이드바
- 둥근 모서리(radius 16~24), 부드러운 그림자, 통통 튀는 마이크로 인터랙션, 키위 캐릭터 일러스트(이모지/SVG)

자세한 디자인 규칙은 `.claude/agents/frontend-dev.md` 참조.

## 7. 보안 원칙

- JWT access(짧게) + refresh(길게). 비밀번호 bcrypt 해시.
- 모든 덱/카드 쿼리에 `user_id` 소유권 검증.
- 시크릿(`GEMINI_API_KEY`, `SECRET_KEY`, OAuth secret)은 `.env`만, 커밋 금지.
- 업로드 이미지 크기/타입 검증, nginx `client_max_body_size` 제한.
- CORS: 허용 오리진 화이트리스트.

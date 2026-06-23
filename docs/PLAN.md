# 키위보카 개발 계획

목표: 퀴즐렛 스타일 외국어 학습 웹앱 MVP. Docker로 로컬 구동 → 저렴한 VM 배포.
각 단계는 **검증 기준**을 통과해야 다음으로 진행한다.

> 진행 현황: Phase 0~4 + 프로덕션 UI/게임 완료 ✅ · Phase 5(배포 준비/검증) 진행 중 🚧

## Phase 0 — 기반 (인프라 + 골격) ✅ 완료

1. 아키텍처/계획 문서 → `docs/ARCHITECTURE.md`, `docs/PLAN.md`
2. 4개 에이전트 정의 → `.claude/agents/{backend-dev,frontend-dev,qa,deploy}.md`
3. 인프라: `docker-compose.yml`, `docker-compose.prod.yml`, `nginx/`, `.env.example`, `.env`
4. 백엔드 골격: FastAPI 앱 + DB 연결 + `/api/health`
5. 프론트 골격: Vite + React + TS + Tailwind + 키위 테마 토큰 + 랜딩

**검증**: `docker compose up -d --build` → `http://localhost:8080/api/health` 200, 프론트 랜딩 렌더.

## Phase 1 — 인증 ✅ 완료

- 백엔드: users 모델, 이메일 회원가입/로그인/refresh/me (JWT), bcrypt
- 프론트: 회원가입·로그인 화면, 토큰 저장(localStorage), `AuthContext`, 보호 라우트
- (후속) Google/Kakao OAuth 연동

**검증**: 회원가입 → 로그인 → `/auth/me` 통과. 미인증 보호 라우트 차단. 모바일 viewport 확인.

## Phase 2 — 덱 & 카드 CRUD ✅ 완료

- 백엔드: decks/cards 모델 + 마이그레이션 + 소유권 검증 CRUD + bulk 추가
- 프론트: 덱 목록(홈), 덱 생성/수정, 카드 편집기(추가/삭제/정렬)

**검증**: 덱 생성 → 카드 5개 추가 → 목록 노출 → 타 유저 접근 403. 모바일 카드 편집 동작.

## Phase 3 — Gemini 단어장 추출 ✅ 완료

- 백엔드: `gemini_service` (이미지→구조화 JSON), `/import/extract`, `/import/commit`, import_jobs
- 프론트: 사진 업로드 UI(카메라/갤러리), 추출 후보 검수/편집 화면, 덱 커밋

**검증**: 샘플 단어장 사진 → 후보 리스트 추출 → 편집 → 덱 생성. 실패 시 graceful 에러.

## Phase 4 — 학습 게임 (4종) ✅ 완료

- 백엔드: study 세션/채점 API, card_progress(라이트너 박스 SRS)
- 프론트:
  - **플래시카드**: 스와이프 뒤집기/넘기기
  - **객관식**: 4지선다 + 점수/타이머
  - **타이핑**: 스펠링 입력 채점(관대한 정규화)
  - **매칭**: 단어-뜻 짝 타임어택
- 결과 화면(정답률, 틀린 카드 복습)

**검증**: 각 모드 1회 플레이 → 진척 저장 → 재방문 시 약한 카드 우선. 모바일 제스처/터치 검증.

## Phase 5 — 다듬기 & 배포 준비 🚧 진행 중

- 빈 상태/로딩/에러 UX, 토스트, 스켈레톤
- 접근성(대비, 포커스), 모바일 3종 viewport(320/375/414) 회귀
- `docker-compose.prod.yml` + nginx 정적 서빙 ✅ + 배포 가이드(`docs/DEPLOY.md`) ✅

**검증**: prod 빌드 로컬 기동 OK ✅ (격리 prod 스모크 테스트 PASS: 정적 SPA 서빙/SPA fallback/`/api` 프록시/회원가입·로그인 라운드트립), QA 에이전트 전체 회귀 GO/NO-GO(예정).

## 작업 방식 (에이전트 협업)

- **backend-dev**: 모델/라우터/서비스/마이그레이션/Gemini/인증
- **frontend-dev**: 화면/디자인/반응형 — UI 작업 시 `frontend-design` 스킬 호출
- **qa**: 기능/모바일/회귀 검증 (Playwright), 버그 리포트
- **deploy**: Docker/compose/env 동기화, Git workflow, VM 배포

각 Phase: backend-dev + frontend-dev 병렬 구현 → qa 검증 → 수정 루프 → 다음 Phase.

## 미해결/결정 필요

- OAuth(Google/Kakao) 리다이렉트 URI 확정 (로컬 vs 배포 도메인)
- 배포 VM 사양/도메인 (HTTPS 인증서 방식: Caddy vs nginx+certbot)
- `GEMINI_API_KEY` 형식 확인 — 제공된 키가 `AQ.` 접두로 표준 AI Studio 키(`AIza`)와 다름. 연동 시 실제 호출 검증 필요.

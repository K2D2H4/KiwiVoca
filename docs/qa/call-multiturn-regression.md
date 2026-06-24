# AI 전화연습(가상 전화) 멀티턴 회귀 + E2E QA

- **대상 버그**: `_downlink` 가 `session.receive()` 를 1회만 순회 → AI 첫 turn_complete 직후 통화가 끊김("랜덤 종료")
- **수정**: `_downlink` 의 `async for` 를 `while True:` 외부 루프로 감싸 다음 턴 계속 수신
- **브랜치**: `claude/clever-hopper-1b8e87`
- **일자**: 2026-06-24
- **판정 기준**: 측정(가설 금지). 실 Gemini API 미호출(Fake 세션), 마이크 미사용(브라우저 fake)
- **대상 파일**: `backend/app/routers/call.py`, `frontend/src/hooks/useCall.ts`, `frontend/src/pages/Call.tsx`

---

## 종합 판정: GO

백엔드 회귀 7/7 PASS. 회귀 진위(수정 전 FAIL / 수정 후 PASS) 입증 완료.
E2E(프론트 상태머신 + 모바일) 멀티턴 생존 PASS, 버그 시뮬레이션 대조군으로 탐지력 입증.

---

## 1. 백엔드 회귀 테스트 (`tests/test_call_ws.py`, FastAPI WebSocket TestClient)

격리: SQLite 인메모리 DB(StaticPool) 로 인증/소유권 로직 실제 통과 + `genai.Client` 만 Fake 로 monkeypatch.
Fake 세션의 `receive()` 는 실제 google-genai 1.2.0 동작(한 턴마다 종료)을 모사.

| # | 시나리오 | 기대 | 결과 |
|---|----------|------|------|
| 1 | **[회귀 핵심] 멀티턴 생존** — 2턴(각 오디오+turn_complete) | 첫 turn_complete 후에도 WS 유지, 2턴 오디오/turn_complete 전달 | PASS |
| 2 | 정상 종료 — 클라이언트가 WS close | 서버 예외/행 없이 종료, downlink cancel | PASS |
| 3 | 토큰 없음 | close 4401 | PASS |
| 4 | 무효 토큰 | close 4401 | PASS |
| 5 | 덱 미지정 | close 4404 | PASS |
| 6 | 타인 비공개 덱(소유권 격리) | close 4403 | PASS |
| 7 | Gemini 세션 오픈 실패 | error 프레임 + close 4500 | PASS |

실행: `cd backend && python -m pytest tests/test_call_ws.py`
결과(수정본): **7 passed**

## 2. 회귀 진위 검증 (수정 전/후 대조)

컨테이너 사본에서 `_downlink` 만 교체해 측정.

| call.py `_downlink` | 멀티턴 테스트 | 전체 |
|---|---|---|
| PRE-FIX (`async for` 단독, while 루프 없음) | **FAIL** (첫 turn_complete 후 `close 1000` → 2턴 오디오 수신 시 WebSocketDisconnect) | 1 failed, 6 passed |
| POST-FIX (`while True:` 외부 루프) | **PASS** | 7 passed |

멀티턴 테스트가 코드 변경에 정확히 반응 → 가짜 통과 아님(진짜 회귀 테스트).
복원 후 `git diff backend/app/routers/call.py` 로 의도한 수정본 확인 완료.

## 3. E2E (Playwright, Vite dev 5173 + 브라우저 mock)

실 백엔드/Gemini/마이크 미사용. 브라우저 안에서 `WebSocket`/`getUserMedia`/`XMLHttpRequest`(deck API) mock,
실제 `Call.tsx` + `useCall.ts` 상태머신을 구동.

| # | 시나리오 | viewport | 기대 | 결과 |
|---|----------|----------|------|------|
| E1 | 정상 멀티턴(2턴 후 연결 유지) | 데스크탑 | 첫 turn_complete 후에도 `in_call` 유지(타이머 증가), "통화 종료" 화면 아님 | PASS (turns=2, wsClosed=false, "On call / 0:22") |
| E2 | **버그 시뮬레이션 대조군** — 첫 turn_complete 직후 서버 close(1000) | 데스크탑 | `useCall.onclose(1000)` → `ended` 화면 전환 | PASS (turns=1, "Call ended" 전환 확인 = 탐지력 입증) |
| E3 | 정상 멀티턴 | 모바일 375×812 | in_call 유지 + 가로 스크롤 없음 + 터치 타겟 ≥44px | PASS (turns=2, scrollWidth==clientWidth==375, Mute 56², End 64²) |

스크린샷(비커밋, 임시): `/tmp/call_e2e_artifacts/call_e2e_01_precall.png`, `_02_incall_after_multiturn.png`, `_03_bug_ended_after_first_turn.png`, `_04_mobile375_incall.png`

## 4. 환경 제약(솔직히)

- 워크트리에는 nginx/frontend 컨테이너 미기동, 백엔드는 메인 레포 컨테이너만 expose(8000, 호스트 미바인딩) → `localhost:8080` 풀스택 불가.
- 그래서 **실 백엔드 WS + 실 브라우저** 통합 E2E 대신, (a) 백엔드는 TestClient 통합 테스트로 릴레이 전체 경로 커버, (b) 프론트는 dev 서버 + mock WS 로 상태머신 커버. 두 레이어가 멀티턴 회귀를 각각 독립적으로 검증.
- dev 서버에 `/api` 프록시 없음 → deck/auth API 는 브라우저 XHR mock 으로 대체(프로덕션은 nginx 프록시).

## 5. 추가 관찰(프로덕션 버그 아님 / 참고)

- dev 환경에서 `/api/decks/:id` 미프록시 시 axios 가 SPA fallback HTML 을 받아 `Call.tsx` 의 `langLabel(deck.lang_term)` 에서 `undefined.toUpperCase()` 크래시 관찰. 실 환경(nginx 프록시)에선 발생 안 함. 다만 deck 응답이 비정상일 때 방어가 없는 점은 참고 가치 있음(우선순위 🟢 minor).

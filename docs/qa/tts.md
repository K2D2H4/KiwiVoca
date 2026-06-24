# Gemini TTS 발음 기능 QA

- **대상**: Web Speech API → Gemini TTS 서버 합성 교체
- **브랜치**: `feature/kiwivoca-mvp`
- **환경**: Docker, nginx 프록시 `http://localhost:8080` (kiwivoca-{nginx,frontend,backend,db})
- **일자**: 2026-06-24
- **판정**: 측정 기반 (오디오 청취 불가 → HTTP 200 + 유효 WAV + audio 에러 없음 기준)
- **대상 파일**: `backend/app/routers/tts.py`, `backend/app/services/tts_service.py`, `frontend/src/hooks/useTTS.ts`, `frontend/src/components/ui/SpeakButton.tsx`

---

## 종합 판정: GO (조건부)

핵심 계약/캐시/다국어/E2E/모바일/회귀 모두 PASS. 코드 버그 없음.
단, **Gemini preview 모델의 간헐적 빈 응답으로 인한 최종 502가 어려운 입력(특히 한국어 다어절)에서 재현됨** — 이는 모델 한계이며 프론트 Web Speech 폴백으로 graceful 처리됨. 운영 권고 1건 + 경미 1건 보고.

---

## 1. 엔드포인트 계약 (nginx 경유)

| # | 시나리오 | 기대 | 실제 | 결과 |
|---|----------|------|------|------|
| T1 | 토큰 없음 | 401 | 401 | PASS |
| T2 | 토큰 있음 | 200 + audio/wav + Cache-Control | 200, `content-type: audio/wav`, `cache-control: private, max-age=31536000, immutable` | PASS |
| T2b | WAV 유효성 | RIFF/WAVE 헤더 | `RIFF....WAVE fmt`, 24kHz/16bit/mono/1.05s (Python wave 검증) | PASS |
| T3 | 동일 입력 재요청(캐시) | 현저히 빠름 | MISS 6.46s → HIT 0.0067s (**약 960배**), 바이트 동일 | PASS |
| T4 | 빈 text | 400 (명세) | **422** (FastAPI Query min_length) | PASS* |
| T4b | 공백만 `"   "` | 400 | 400 (서비스 strip 후 "읽을 내용이 없습니다") | PASS |
| T5 | 201자 초과 | 400 (명세) | **422** (FastAPI Query max_length) | PASS* |
| T5b | 정확히 200자 경계 | 통과(합성 시도) | 길이검증 통과 → 합성(무의미 입력이라 502) | PASS |

\* 명세는 "400"이라 했으나 라우터가 `Query(min_length=1, max_length=200)`로 제약을 걸어 **FastAPI가 422를 반환**. 거부는 정상 동작하나 코드/메시지 형식이 명세와 다름 → B-02 참조.

## 2. 신뢰성 / 재시도 (캐시 clear 후 1회차 합성)

| 배치 | 입력 | 1회차 성공 | 비고 |
|------|------|-----------|------|
| 영어 단어 10개 (서비스 직접) | mountain, river, ... meadow | **10/10 (100%)** | 재시도 warning 0회 |
| 영어 단어 12개 (HTTP) | apricot, blossom, ... marble | **12/12 (100%)** | |
| 한국어 단어/표현 10개 (HTTP) | 수리 기사, 안녕하세요, ... 운영체제 | **8/10 (80%)** | 회의실·전화번호 502 |

- 재시도 로직 동작 확인: 어려운 입력은 attempt 1/3→2/3→3/3 모두 빈 응답(empty/transient) 후 502.
- 회복성: "회의실"은 즉시 재요청 시 200, "전화번호"는 재요청에도 502 (비결정적). 캐시 HIT 후엔 항상 안정.
- **결론**: 재시도가 영어 단어는 거의 100% 막아주나, 한국어 다어절 등 일부 입력은 3회로 부족 → 최종 502 발생. 모델 본질적 불안정성(명세상 30~50% 빈 응답).

## 3. 다국어 (서비스 직접 호출 `tts_service.synthesize`)

| 언어 | 입력 | 결과 |
|------|------|------|
| en | apple / book | PASS (50490B / 54330B) |
| ko | 사과 / 학교 | PASS (50490B / 50490B) |
| ja | りんご / 学校 | PASS (50490B / 58170B) |

## 4. 프론트 E2E (Playwright) — deck#28 "한국어단어" (lang=ko, 54장)

| # | 검증 | 결과 |
|---|------|------|
| E1 | 토큰 주입 후 Flashcards 진입 (`/study/28/flashcards`) | PASS (localStorage `kiwivoca.access_token`/`refresh_token` + zustand `kiwivoca.auth` 모두 필요) |
| E2 | 스피커 클릭 → `/api/tts?text=상담&lang=ko` | **200 OK**, `content-type: audio/wav`, Cache-Control 헤더 정상 |
| E3 | 재생 중 `aria-pressed=true` | PASS |
| E4 | 재생 중 `.animate-ping` 펄스(bg-kiwi/30) | PASS |
| E5 | 콘솔 에러 (정상 단어) | 0개 (React Router v7 future flag warning만, 무해) |
| E6 | ChoiceQuiz `/study/28/choice` 렌더 + 스피커 | PASS (보기 4개, 스피커 동작) |
| E7 | 프론트가 올바른 text+lang 전송 | PASS (덱 lang_term=ko 전달) |

스크린샷: `.playwright-mcp/tts-flashcards-desktop.png`, `tts-flashcards-mobile-375.png`

## 5. 모바일 반응형 (viewport 375×812)

| # | 체크 | 결과 |
|---|------|------|
| M1 | 가로 스크롤 없음 | PASS (scrollWidth 375 === clientWidth 375) |
| M2 | 스피커 터치 타겟 ≥ 44×44 | PASS (정확히 44×44px) |
| M3 | 모바일 스피커 클릭 → /api/tts 200 | PASS (`text=검색하다&lang=ko` 200) |
| M4 | 재생 중 aria-pressed + ping | PASS |

## 6. 회귀

| 플로우 | 결과 |
|--------|------|
| Flashcards | PASS (flip 버튼, 진행률 1/20, Knew it/Didn't know) |
| ChoiceQuiz | PASS (객관식 4개, 스피커 포함) |
| TypingQuiz | PASS (입력창 + Check, 스피커는 의도적으로 미노출 — 정답 누설 방지로 합리적) |
| 콘솔 | 정상 단어 합성 시 에러 0. 502 발생 시 리소스 로드 에러만 기록되나 앱 크래시 없음(폴백). |

---

## 발견 사항 / 버그

### B-01 [운영 권고] — Gemini preview 모델 간헐적 502 (한국어 다어절 취약)
- **증상**: 일부 입력(특히 한국어 다어절: "수리 기사", "회의실", "전화번호")이 3회 재시도 모두 빈 응답 → 502. 영어는 거의 100%.
- **재현**:
  ```
  curl -G -H "Authorization: Bearer $TOKEN" \
    --data-urlencode "text=전화번호" --data-urlencode "lang=ko" \
    http://localhost:8080/api/tts   # → 502 (재시도해도 간헐 재현)
  ```
  백엔드 로그: `Gemini TTS empty/transient, attempt 1/3 → 2/3 → 3/3` 후 502.
- **기대 / 실제**: 명세 "재시도 덕에 거의 100%" / 한국어 다어절 1회차 80%(2/10 최종 502).
- **원인 위치**: 코드 버그 아님 — `backend/app/services/tts_service.py:36-38` 주석대로 모델 본질적 불안정성. `_MAX_ATTEMPTS=3`으로 어려운 입력 커버 부족.
- **완화 동작**: `frontend/src/hooks/useTTS.ts:165-168` catch → `fallbackSpeak` (Web Speech 폴백)로 사용자는 끊김 없이 발음 청취. 캐시 HIT 후 안정.
- **제안**: (선택) `_MAX_ATTEMPTS`를 4~5로 상향하거나 `_RETRY_BACKOFF_S` 미세 증가로 성공률 개선 검토. 폴백이 있어 critical 아님.
- **우선순위**: 🟡 medium (모델 한계 + 폴백 존재)

### B-02 [경미] — 입력 검증 400 명세 vs 실제 422 불일치
- **증상**: 빈 text·200자 초과 시 명세는 400을 기대하나 실제 **422** 반환. 응답 본문도 서비스의 한국어 메시지가 아니라 FastAPI 기본 형식.
  ```json
  {"detail":[{"type":"string_too_short","loc":["query","text"],"msg":"String should have at least 1 character",...}]}
  ```
- **원인 위치**: `backend/app/routers/tts.py:22` — `text: str = Query(..., min_length=1, max_length=tts_service.MAX_TEXT_LEN)`. FastAPI Query 제약 위반은 422로 매핑되어, 서비스 레이어의 `TTSError(http_status=400)` 분기(`tts_service.py:150-152`)가 도달되지 않음.
- **기대 / 실제**: 400 + `{"detail":"읽을 내용이 없습니다."}` / 422 + Pydantic 검증 배열.
- **사용자 영향**: 없음 — useTTS가 모든 실패를 폴백 처리하므로 422여도 Web Speech로 동작. 단, API 계약 문서/소비자에겐 혼동.
- **제안**: 명세를 422로 정정하거나, 라우터 Query 제약(min/max_length)을 제거하고 길이 검증을 서비스 레이어 `TTSError(400)`에 일임해 일관된 400+한국어 메시지 반환.
- **우선순위**: 🟢 minor

---

## 측정 요약
- **합성 성공률**: 영어 22/22 (100%), 한국어 8/10 (80%, 1회차). 캐시 HIT 시 100%.
- **캐시**: MISS 6.46s → HIT 0.0067s (~960배), 바이트 동일.
- **WAV**: 24kHz / 16bit / mono, RIFF/WAVE 유효.
- **E2E**: Flashcards/Choice 스피커 → /api/tts 200 + audio/wav, aria-pressed + animate-ping 펄스, 콘솔 에러 0(정상 입력).
- **모바일 375px**: 가로 스크롤 없음, 터치 타겟 44×44, TTS 동작.

## GO / NO-GO: **GO**
계약·캐시·다국어·E2E·모바일·회귀 PASS. 기능 코드 버그 없음. B-01(모델 502)은 폴백으로 graceful, B-02(422)는 무해. 운영 시 B-01 재시도 횟수 조정 검토 권고.

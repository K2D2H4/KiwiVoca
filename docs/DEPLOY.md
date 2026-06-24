# 키위보카 (KiwiVoca) 배포 가이드

저렴한 VM(예: Ubuntu 22.04/24.04, 1~2 vCPU / 2GB RAM 이상)에 Docker Compose로 배포하는 절차서다.
복붙 가능한 명령 위주로 정리했다.

> 구성: `nginx` (정적 프론트 서빙 + `/api` 프록시) · `backend` (FastAPI/gunicorn) · `db` (PostgreSQL 16) · `frontend-build` (빌드 후 종료, 산출물을 공유 볼륨에 복사).
> 프론트는 prod에서 **Vite dev 서버를 쓰지 않고** `npm run build` 정적 산출물을 nginx가 직접 서빙한다.

---

## 0. 사전 준비

### 0-1. VM 방화벽
외부에는 **80/443(HTTP/HTTPS)만** 열고, **PostgreSQL(5432)은 절대 외부 노출하지 않는다**.
(prod compose는 db에 호스트 포트를 매핑하지 않으므로 기본적으로 외부 비노출이다.)

```bash
# UFW 예시
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

클라우드 콘솔(보안 그룹/방화벽 규칙)에서도 22/80/443만 허용하고 5432는 막아둔다.

### 0-2. Docker + Compose 설치 (Ubuntu)

```bash
# 공식 스크립트로 Docker Engine + compose plugin 설치
curl -fsSL https://get.docker.com | sudo sh

# sudo 없이 docker 쓰려면 (재로그인 필요)
sudo usermod -aG docker $USER

# 확인
docker --version
docker compose version
```

---

## 1. 레포 클론 & 환경변수 작성

```bash
git clone <레포 URL> kiwivoca
cd kiwivoca

# 템플릿 복사 후 실제 값 작성
cp .env.example .env
nano .env   # 또는 vi
```

### 1-1. 강한 시크릿 생성

`.env`의 `SECRET_KEY`, `POSTGRES_PASSWORD`는 **반드시 강한 랜덤값**으로 바꾼다.

```bash
# SECRET_KEY (JWT 서명용, 64 hex)
openssl rand -hex 32

# POSTGRES_PASSWORD (URL-safe, 특수문자 적게)
openssl rand -base64 24 | tr -d '/+=' | head -c 32; echo
```

생성한 값을 `.env`에 넣고, `DATABASE_URL`의 비밀번호 부분도 **동일하게** 맞춘다.

### 1-2. 배포용 `.env` 예시

```bash
# --- 컨테이너/포트 ---
COMPOSE_CONTAINER_PREFIX=kiwivoca
# nginx가 들을 호스트 포트. HTTPS 리버스 프록시(아래 5장)를 앞에 둘 거면 80 유지.
HOST_PORT=80

# --- PostgreSQL (5432 호스트 매핑 없음 = 외부 비노출) ---
POSTGRES_USER=kiwivoca
POSTGRES_PASSWORD=<openssl로 생성한 강한 값>
POSTGRES_DB=kiwivoca
DATABASE_URL=postgresql+psycopg2://kiwivoca:<위와 동일한 비밀번호>@db:5432/kiwivoca

# --- 인증(JWT) ---
SECRET_KEY=<openssl rand -hex 32 결과>
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=14

# --- Gemini (단어장 OCR) ---
GEMINI_API_KEY=<실제 Gemini API 키>
GEMINI_MODEL=gemini-3.5-flash

# --- OAuth (현재 미연동, 자격증명 받으면 채움 / 4장 참고) ---
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
KAKAO_REDIRECT_URI=https://your-domain.com/api/auth/kakao/callback

# --- CORS / 프론트 ---
# 실제 서비스 도메인(스킴 포함). 여러 개면 콤마로 구분.
CORS_ALLOWED_ORIGINS=https://your-domain.com
VITE_API_BASE=/api
```

> `.env`는 **gitignored**다. 절대 커밋하지 않는다. 시크릿은 이 파일에만 둔다.

---

## 2. 기동

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

빌드 흐름:
1. `frontend-build` 컨테이너가 `npm run build`(타입체크 + Vite 빌드) → `dist`를 공유 볼륨 `frontend_dist`로 복사하고 종료.
2. `backend`가 시작 시 `python -m app.bootstrap`(Alembic `upgrade head` 등)을 실행한 뒤 gunicorn 기동.
3. `nginx`가 `frontend_dist`(정적 프론트)와 `backend`(`/api` 프록시)를 서빙.

### 2-1. 상태/헬스 확인

```bash
docker compose -f docker-compose.prod.yml ps
curl -i http://localhost:${HOST_PORT:-80}/api/health   # {"status":"ok",...,"db":true}
curl -i http://localhost:${HOST_PORT:-80}/             # 200, index.html
```

`frontend-build`는 작업 후 정상 종료(Exited 0)되는 게 정상이다. db는 `(healthy)`, backend/nginx는 `Up`이어야 한다.

---

## 3. HTTPS (권장: Caddy 리버스 프록시 — 자동 인증서)

Caddy를 앞단에 두면 Let's Encrypt 인증서 발급/갱신이 자동이다. 도메인 A 레코드를 VM 공인 IP로 먼저 연결해 둔다.

이 경우 키위보카 nginx는 그대로 두고(80), Caddy가 443 → nginx(80)로 프록시한다.

```bash
# Caddy 설치 (Ubuntu)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```caddyfile
your-domain.com {
    reverse_proxy localhost:80
}
```

```bash
sudo systemctl reload caddy
```

이제 `https://your-domain.com`으로 접속하면 Caddy가 자동 발급한 인증서로 TLS 종료 후 키위보카 nginx(80)로 넘긴다.
방화벽에 443이 열려 있어야 한다.

> 대안(nginx + certbot): 키위보카 nginx 대신 호스트 nginx를 직접 쓰고 `certbot --nginx`로 인증서를 발급할 수도 있다. Caddy가 설정이 가장 단순해 1차 권장한다.

---

## 4. OAuth (Google / Kakao) — 현재 미연동

코드에 OAuth 엔드포인트(`/api/auth/{google,kakao}/...`)는 준비돼 있으나 **자격증명 미발급 상태**다.
자격증명을 받으면 아래를 진행한다.

1. `.env`에 `GOOGLE_CLIENT_ID/SECRET`, `KAKAO_CLIENT_ID/SECRET` 채우기.
2. **리다이렉트 URI를 배포 도메인 기준**으로 콘솔에 등록:
   - Google Cloud Console → 사용자 인증 정보 → 승인된 리디렉션 URI:
     `https://your-domain.com/api/auth/google/callback`
   - Kakao Developers → 카카오 로그인 → Redirect URI:
     `https://your-domain.com/api/auth/kakao/callback`
3. `.env`의 `GOOGLE_REDIRECT_URI`/`KAKAO_REDIRECT_URI`도 위와 **정확히 일치**시킨다(끝 슬래시/스킴까지).
4. 재배포(6장).

> 로컬과 배포는 리다이렉트 URI가 다르므로 콘솔에 둘 다 등록하거나 환경별로 분리한다.

---

## 5. DB 백업 / 복원

### 백업 (마이그레이션·재배포 전 권장)

```bash
docker exec kiwivoca-db pg_dump -U kiwivoca kiwivoca > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 복원

```bash
cat backup_YYYYMMDD_HHMMSS.sql | docker exec -i kiwivoca-db psql -U kiwivoca -d kiwivoca
```

> POSTGRES_USER/DB를 기본값에서 바꿨다면 명령의 `-U`/DB명도 맞춘다.

---

## 6. 업데이트(재배포)

```bash
cd kiwivoca
git pull

# (마이그레이션이 있을 수 있으니) 먼저 DB 백업
docker exec kiwivoca-db pg_dump -U kiwivoca kiwivoca > backup_$(date +%Y%m%d_%H%M%S).sql

# 재빌드 & 기동 (backend 시작 시 alembic upgrade 자동 실행)
docker compose -f docker-compose.prod.yml up -d --build

# 헬스 확인
curl -i http://localhost:${HOST_PORT:-80}/api/health
```

프론트만 바뀌었어도 `frontend-build`가 다시 빌드해 공유 볼륨을 갱신하므로 위 명령 하나로 충분하다.

---

## 7. 로그 확인

```bash
# 전체
docker compose -f docker-compose.prod.yml logs --tail 100

# 특정 서비스 (최근 5분)
docker compose -f docker-compose.prod.yml logs --since 5m backend
docker compose -f docker-compose.prod.yml logs nginx
docker compose -f docker-compose.prod.yml logs frontend-build   # 빌드 성공/실패 확인
```

---

## 8. 트러블슈팅

| 증상 | 점검 |
|---|---|
| `/api/*`만 502/504 | backend 로그 확인. db `(healthy)`인지, `DATABASE_URL` 비밀번호가 `POSTGRES_PASSWORD`와 일치하는지. |
| 프론트가 404/빈 화면 | `frontend-build`가 Exited 0인지, 로그에 `build copied`가 있는지. 빌드 실패면 타입 에러 로그 확인. |
| 새 코드가 반영 안 됨 | `--build` 없이 올렸을 가능성. `up -d --build`로 다시. |
| CORS 에러 | `.env`의 `CORS_ALLOWED_ORIGINS`가 실제 접속 도메인(스킴 포함)과 일치하는지. 변경 후 재배포. |
| OAuth redirect_uri_mismatch | 콘솔 등록 URI와 `.env`의 `*_REDIRECT_URI`가 글자까지 동일한지(스킴/슬래시). |

### 좀비/볼륨 주의 (중요)

- **`docker compose down -v` 금지.** `-v`는 named volume(`pgdata`)을 삭제해 **DB 데이터가 사라진다.**
  - 중지: `docker compose -f docker-compose.prod.yml stop`
  - 컨테이너 제거(볼륨 유지): `docker compose -f docker-compose.prod.yml down` (옵션 `-v` 절대 붙이지 않기)
- `docker kill` / `docker rm -f` 대신 `stop`/`down`(graceful)을 쓴다.
- 볼륨 확인: `docker volume ls | grep kiwivoca` → `kiwivoca_pgdata`, `kiwivoca_uploads_data`가 보존돼야 한다.

---

## 부록 — 검증 이력 (로컬 prod 스모크 테스트)

배포 전, 로컬에서 dev 스택과 **격리된** prod compose를 띄워 다음을 확인했다(모두 PASS):

- 프론트 prod 빌드(`npm run build`, 타입체크 포함) 성공, `dist` 산출.
- nginx 정적 SPA 서빙 `/` → 200(index.html), 임의 경로 → SPA fallback 200.
- 정적 에셋 `Cache-Control: public, immutable, max-age=31536000`.
- `/api/health` 프록시 → 200 (`db:true`), 보안 헤더(X-Frame-Options 등) 적용.
- 회원가입(201) → 로그인(200) → `/api/auth/me`(200) 라운드트립.

검증 후 prodtest 스택/전용 볼륨은 정리했고, dev 스택과 볼륨은 영향 없음.

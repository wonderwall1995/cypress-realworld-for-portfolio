#!/usr/bin/env bash
# 서버 전용: 최신 코드를 받아서 빌드하고, 웹 파일을 Nginx 폴더로 복사하고, API를 다시 시작한다.
# 사용: 서버의 저장소 폴더에서  pnpm server:up
# 내 PC(개발 환경)에서는 실행되지 않는다.
set -euo pipefail

WEB_DIR=/var/www/rwa
SERVICE=rwa-api

# 서버가 아니면 멈춘다 (API 서비스가 없는 곳)
if ! systemctl cat "$SERVICE" >/dev/null 2>&1; then
  echo "이 명령은 서버 전용입니다. ($SERVICE 서비스가 없습니다)"
  exit 1
fi

cd "$(dirname "$0")/.."

echo "[1/6] 코드 받기"
git pull --ff-only

echo "[2/6] 의존성 설치"
HUSKY=0 pnpm install --frozen-lockfile

echo "[3/6] DB 준비 (prisma generate, migrate deploy)"
pnpm --filter @rwa/api exec prisma generate
pnpm --filter @rwa/api exec dotenv -e ../../.env -- prisma migrate deploy

echo "[4/6] 웹 빌드"
pnpm build

echo "[5/6] 웹 파일을 $WEB_DIR 로 복사"
sudo mkdir -p "$WEB_DIR"
sudo find "$WEB_DIR" -mindepth 1 -delete
sudo cp -r apps/web/build/. "$WEB_DIR"/

echo "[6/6] API 다시 시작"
sudo systemctl restart "$SERVICE"

# API가 뜰 때까지 기다린다 (ts-node 시작에 30~60초 걸린다)
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:7302/api/checkAuth || true)
  if [ "$code" = "401" ] || [ "$code" = "200" ]; then
    echo "완료: API가 응답합니다 ($code). 브라우저에서 새로고침하세요."
    exit 0
  fi
  sleep 3
done
echo "경고: 90초 안에 API가 응답하지 않았습니다. 확인: journalctl -u $SERVICE -n 50 --no-pager"
exit 1

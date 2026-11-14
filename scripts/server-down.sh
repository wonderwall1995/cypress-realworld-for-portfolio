#!/usr/bin/env bash
# 서버 전용: 사이트를 내리고 방문자에게 "점검 중" 화면을 보여 준다.
# 사용: 서버의 저장소 폴더에서  pnpm server:down
# 다시 켜기: pnpm server:up (새로 빌드한 웹 파일이 점검 화면을 대신한다)
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

echo "[1/2] API 멈추기"
sudo systemctl stop "$SERVICE"

echo "[2/2] 웹 파일을 점검 화면으로 바꾸기"
sudo mkdir -p "$WEB_DIR"
sudo find "$WEB_DIR" -mindepth 1 -delete
sudo cp scripts/maintenance.html "$WEB_DIR"/index.html

echo "완료: 사이트를 내렸습니다. 방문자에게는 '점검 중' 화면이 보입니다."
echo "다시 켜기: pnpm server:up"

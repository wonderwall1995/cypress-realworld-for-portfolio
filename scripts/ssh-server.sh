#!/usr/bin/env bash
# 내 PC 전용: 서버에 SSH로 바로 접속한다.
#   bash scripts/ssh-server.sh            서버 콘솔을 연다
#   bash scripts/ssh-server.sh db         DB 터널을 연다 (내 PC의 15432 -> 서버의 PostgreSQL)
#   bash scripts/ssh-server.sh web        웹 터널을 연다 (내 PC의 8080 -> 서버의 Nginx)
#   bash scripts/ssh-server.sh --print    접속 명령만 보여 주고 접속하지는 않는다
#
# 서버 주소와 키 파일 경로는 저장소에 올라가지 않는 파일(scripts/ssh-server.local)에 둔다.
# 처음 쓸 때: scripts/ssh-server.local.example 을 복사해서 이름을 ssh-server.local 로 바꾸고 값을 채운다.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f ssh-server.local ]; then
  echo "scripts/ssh-server.local 파일이 없습니다."
  echo "scripts/ssh-server.local.example 을 복사해서 이름을 ssh-server.local 로 바꾸고 값을 채우세요."
  exit 1
fi
# shellcheck disable=SC1091
source ssh-server.local

: "${SERVER_HOST:?ssh-server.local 에 SERVER_HOST 가 없습니다}"
: "${SERVER_KEY:?ssh-server.local 에 SERVER_KEY 가 없습니다}"
SERVER_USER="${SERVER_USER:-ubuntu}"

# Windows에서는 Windows 용 OpenSSH를 우선 쓴다 (PowerShell에서 되던 방식과 같다. 키 파일 권한 검사도 같다)
SSH=ssh
if [ -x /c/Windows/System32/OpenSSH/ssh.exe ]; then
  SSH=/c/Windows/System32/OpenSSH/ssh.exe
fi

MODE="${1:-console}"
PRINT_ONLY=0
if [ "$MODE" = "--print" ]; then
  PRINT_ONLY=1
  MODE=console
fi

case "$MODE" in
  console)
    CMD=("$SSH" -i "$SERVER_KEY" "$SERVER_USER@$SERVER_HOST")
    ;;
  db)
    echo "DB 터널: 내 PC의 localhost:15432 로 서버의 PostgreSQL 에 접속합니다. 끄려면 Ctrl+C"
    CMD=("$SSH" -i "$SERVER_KEY" -N -L 15432:127.0.0.1:5432 "$SERVER_USER@$SERVER_HOST")
    ;;
  web)
    echo "웹 터널: 브라우저에서 http://localhost:8080 을 엽니다. 끄려면 Ctrl+C"
    CMD=("$SSH" -i "$SERVER_KEY" -N -L 8080:127.0.0.1:80 "$SERVER_USER@$SERVER_HOST")
    ;;
  *)
    echo "알 수 없는 옵션: $MODE  (사용: 없음 | db | web | --print)"
    exit 1
    ;;
esac

if [ "$PRINT_ONLY" = 1 ]; then
  printf '%q ' "${CMD[@]}"; echo
  exit 0
fi

exec "${CMD[@]}"

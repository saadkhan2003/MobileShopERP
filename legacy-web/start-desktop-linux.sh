#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-18763}"
SHOP_DATA_DIR="${SHOP_DATA_DIR:-$PWD/data}"
export PORT SHOP_DATA_DIR
node server.js &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
for i in {1..80}; do
  if curl -fsS "http://127.0.0.1:$PORT/api/status" >/dev/null; then break; fi
  sleep 0.1
done
browser="$(command -v google-chrome || command -v chromium || command -v chromium-browser)"
"$browser" --app="http://127.0.0.1:$PORT" --user-data-dir="$HOME/.config/mobile-shop-erp-browser" --no-first-run

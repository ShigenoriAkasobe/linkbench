#!/usr/bin/env bash
# LinkBench — 単一起動スクリプト
# フロントエンドのビルド (必要時) + uvicorn 起動をまとめて行う。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# ---------- venv ----------
if [ ! -d "venv" ]; then
    echo "[linkbench] Creating Python venv..."
    python3 -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate

pip install -q -r backend/requirements.txt

# ---------- Node / npm ----------
if [ ! -d "frontend/node_modules" ]; then
    echo "[linkbench] Installing frontend dependencies..."
    (cd frontend && npm ci --silent)
fi

# ---------- Frontend build ----------
DIST="$PROJECT_ROOT/frontend/dist"
# Rebuild if dist is missing, or if any source file is newer than dist
NEED_BUILD=0
if [ ! -d "$DIST" ]; then
    NEED_BUILD=1
elif [ -n "$(find frontend/src frontend/index.html frontend/package.json -newer "$DIST" -print -quit 2>/dev/null)" ]; then
    NEED_BUILD=1
fi

if [ "$NEED_BUILD" -eq 1 ]; then
    echo "[linkbench] Building frontend..."
    (cd frontend && npm run build)
fi

# ---------- Start server ----------
HOST="${LINKBENCH_HOST:-0.0.0.0}"
PORT="${LINKBENCH_PORT:-28000}"
WORKERS="${LINKBENCH_WORKERS:-1}"

export LINKBENCH_MODE=production

echo "[linkbench] Starting on http://${HOST}:${PORT}"
exec uvicorn backend.main:app \
    --host "$HOST" \
    --port "$PORT" \
    --workers "$WORKERS"

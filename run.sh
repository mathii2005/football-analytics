#!/usr/bin/env bash
# Start the analytics API (:8000) and the dashboard (:3000) from any folder.
# Ctrl+C stops both. Match files: FA_MATCH_DIR (default: the tagger exports).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export FA_MATCH_DIR="${FA_MATCH_DIR:-$ROOT/../laureats-tagger/exports}"

cd "$ROOT"
"$ROOT/.venv/bin/python" -m uvicorn src.api.app:app --port 8000 --reload &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT
npm --prefix "$ROOT/dashboard" run dev

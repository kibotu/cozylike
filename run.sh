#!/usr/bin/env bash
set -euo pipefail

# Convenience script for starting the cozylike server.
# Idempotent: recreates .venv only if missing, installs deps only if needed.
# Kills any previous server instances on the target port first.

cd "$(dirname "$0")"

# ── Kill previous server sessions ──────────────────────────────────
# Extract port from arguments (handles --port 8000 and --port=8000)
PORT=8000
SAVE_ARGS=("$@")

while [ $# -gt 0 ]; do
  case "$1" in
    --port=*) PORT="${1#*=}" ;;
    --port)   shift; PORT="${1:-8000}" ;;
  esac
  shift
done

if command -v lsof &>/dev/null; then
  lsof -ti:"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
elif command -v fuser &>/dev/null; then
  fuser -k "$PORT/tcp" 2>/dev/null || true
fi

# ── Virtualenv (idempotent) ────────────────────────────────────────
if [ ! -d .venv ]; then
  echo "Creating .venv…"
  uv venv .venv
fi

# Install deps (uv pip ignores already-satisfied)
echo "Installing deps…"
uv pip install -q --upgrade -r requirements.txt --python .venv/bin/python

# ── Start server ───────────────────────────────────────────────────
if [ ${#SAVE_ARGS[@]} -gt 0 ]; then
  exec uv run src/server.py "${SAVE_ARGS[@]}"
else
  exec uv run src/server.py
fi

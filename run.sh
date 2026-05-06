#!/usr/bin/env bash
set -euo pipefail

# Convenience script for starting the cozylike server.
# Idempotent: recreates .venv only if missing, installs deps only if needed.

cd "$(dirname "$0")"

# ── Virtualenv (idempotent) ────────────────────────────────────────
if [ ! -d .venv ]; then
  echo "Creating .venv…"
  uv venv .venv
fi

# Install deps (uv pip ignores already-satisfied)
echo "Installing deps…"
uv pip install -q --upgrade -r requirements.txt --python .venv/bin/python

# ── Start server ───────────────────────────────────────────────────
exec uv run src/server.py "$@"

#!/usr/bin/env python3
"""Cozy Top-Down Roguelite — lightweight static file server."""

import argparse
import sys
from pathlib import Path

import uvicorn

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="cozylike")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = PROJECT_ROOT / "static"


@app.get("/")
async def index():
    with open(STATIC_DIR / "index.html", "r") as f:
        return HTMLResponse(content=f.read())


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def main():
    parser = argparse.ArgumentParser(description="Cozy Roguelite server")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to bind to")
    args = parser.parse_args()

    print(f"Starting cozylike on {args.host}:{args.port}")
    sys.stdout.flush()

    uvicorn_config = {
        "app": "server:app",
        "host": args.host,
        "port": args.port,
        "log_level": "warning",
    }
    uvicorn.run(**uvicorn_config)


if __name__ == "__main__":
    main()

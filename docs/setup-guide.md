# Setup Guide

## Prerequisites
- Docker Desktop
- Python 3.11+
- uv (`pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Bun (`curl -fsSL https://bun.sh/install | bash`)
- Node.js 18+ (for concurrently at root)

## Steps

1. Clone the repo
2. Start Postgres: `docker-compose up -d db`
3. `cd src && cp .env.example .env` (optionally add LLM_API_KEY)
4. `uv sync`
5. `uv run python -m app.seed` (seeds 100 FIRs + runs detection)
6. `uv run uvicorn app.main:app --reload` (backend on :8000)
7. `cd src/web && bun install && bun run dev` (frontend on :5173)

## Without LLM key
Everything works. Pattern matches show deterministic match_reasons only; reasoning_gloss is null/absent.

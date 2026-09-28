# Bob Engine — FIR Intelligence & Crime Pattern Detector

IBM Bob AI Hackathon · Problem Statement #10 · Track 4: AI & Predictive

## What it does
Bob Engine ingests digitized FIR records and uses deterministic entity resolution + MO-similarity clustering to surface explainable cross-district pattern correlations — showing who links to what and exactly why, on a UP crime map with automatic alerts when new syndicate patterns form.

## Quick start

```bash
# 1. Start PostgreSQL
docker-compose up -d db

# 2. Install backend deps
cd src && uv sync

# 3. Seed database
uv run python -m app.seed

# 4. Start backend
uv run uvicorn app.main:app --reload

# 5. Install frontend deps (new terminal)
cd src/web && bun install

# 6. Start frontend
bun run dev
```

Or: `bun run dev` at repo root to start both concurrently.

## Docs
See `docs/` for full documentation.

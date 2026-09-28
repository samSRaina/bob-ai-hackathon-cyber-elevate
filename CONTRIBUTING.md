# Contributing

This project is a hackathon submission for IBM Bob AI Hackathon (Problem Statement #10, Track 4).

## Setup
See docs/setup-guide.md for full instructions.

## Development
- Backend: `cd src && uv run uvicorn app.main:app --reload`
- Frontend: `cd src/web && bun run dev`
- Both: `bun run dev` at repo root

## Code style
- Python: follow PEP 8, use type hints throughout
- TypeScript: strict mode, no `any`

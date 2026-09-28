# Architecture

See Section 3 of the build prompt for the full architecture diagram.

## Key components
- **FastAPI backend** at `src/app/`
- **PostgreSQL 16** via Docker
- **React 18 + Vite + Tailwind** at `src/web/`
- **Engine layer**: entity_resolution, mo_similarity, graph_builder, geo_aggregation, pattern_alerts
- **LLM**: DeepSeek-V4.1-Flash (pluggable, gracefully absent)

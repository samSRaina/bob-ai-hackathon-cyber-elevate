# 🚀 Bob Engine — FIR Intelligence & Crime Pattern Detector

---

## 👥 Team

| Field | Value |
|---|---|
| **Team Name** | CyberElevate |
| **Track** | AI & Predictive |
| **Team Lead** | Aryan Sakaria — aryansakaria1@gmail.com |
| **Members** | Prerana Wagh, Soham Khardikar, Samanyu Sameer Raina |

---

## 🎯 Problem Statement

> In 2–3 sentences: What problem does your project solve? Who experiences this problem?

Uttar Pradesh Police's CCTNS system holds over 3 crore digitized FIR records without an automated NLP correlation layer, allowing serial and inter-district criminal syndicates to evade detection because cross-jurisdictional links are never surfaced. Police leadership, investigative officers, and crime analysts are constrained to manual, siloed case reviews that remain completely invisible on geographical maps. Furthermore, investigative teams receive no automated alerts when fragmented FIRs across separate police stations form an active cross-district syndicate pattern.

---

## 💡 Solution

> In 2–3 sentences: What did you build? How does it solve the problem above?

Bob Engine is an explainable FIR intelligence and crime pattern detector that ingests digitized FIR records and surfaces multi-district criminal correlations across Uttar Pradesh. It couples deterministic entity resolution (exact phone numbers, vehicle registrations, and phonetic name matching via Double-Metaphone and RapidFuzz) with sentence-transformer Modus Operandi (MO) semantic clustering to automatically connect disparate cases. Correlated syndicates are visualized on an interactive UP crime map with instant cluster alerts and optional AI reasoning summaries, delivering transparent, evidence-weighted links directly to investigators.

---

## ✨ Key Features

- **Feature 1:** **Explainable Cross-District Pattern Correlation** — Deterministic entity resolution combining exact identifier matching (phone numbers, vehicle registrations) with Double-Metaphone phonetic encoding and RapidFuzz string similarity, outputting human-readable match reasons and evidence-weighted confidence scores.
- **Feature 2:** **Modus Operandi (MO) Semantic Clustering** — Vector embeddings via sentence-transformers comparing crime narrative semantics to uncover operational patterns and recurring tactics across disparate police stations.
- **Feature 3:** **Interactive UP Crime Map & Heatmap** — Real-time Leaflet geospatial visualization rendering police station spot pins and incident density heatmaps filterable by crime category across Uttar Pradesh districts.
- **Feature 4:** **Automated Real-Time Syndicate Alerts** — Event-driven pattern alerting engine that immediately flags newly discovered clusters, expanding networks, and multi-district syndicates exceeding confidence thresholds.
- **Feature 5:** **Hierarchical 4-Tier RBAC & Pluggable AI Gloss** — Header-toggled police jurisdictional scoping (State Admin, Range Commissioner, City Police, and Police Inspector) paired with an optional DeepSeek-V4.1-Flash LLM layer for natural-language intelligence glosses that fails gracefully if unconfigured.

---

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| **Languages** | Python 3.11+, TypeScript, SQL, HTML5/CSS3 |
| **Frameworks** | FastAPI, React 18, Vite, Tailwind CSS, Leaflet |
| **IBM Technologies** | IBM Bob (AI-assisted codebase architecture & engineering), watsonx.ai-ready pluggable LLM interface |
| **Databases** | PostgreSQL 16 (with relational indexing & vector support), SQLModel, SQLAlchemy |
| **Other** | Docker, Docker Compose, uv, Bun, Sentence-Transformers, RapidFuzz, Concurrently |

---

## 📁 Repository Structure

```
Directory structure:
├── README.md
├── CONTRIBUTING.md
├── docker-compose.yml
├── package.json
├── submission.yaml
├── demo/
│   ├── demo-video-link.txt
│   ├── live-demo-url.txt
│   └── screenshots/
│       ├── README.md
│       └── .gitkeep
├── docs/
│   ├── architecture.md
│   ├── problem-statement.md
│   ├── setup-guide.md
│   ├── solution-overview.md
│   └── template-guide.md
├── presentation/
│   ├── README.md
│   └── .gitkeep
├── src/
│   ├── README.md
│   ├── export_openapi.py
│   ├── openapi.json
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── .env.example
│   ├── .python-version
│   ├── app/
│   │   ├── main.py
│   │   ├── seed.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── routes_alerts.py
│   │   │   ├── routes_firs.py
│   │   │   └── routes_rest.py
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── rbac.py
│   │   ├── data/
│   │   │   └── generate_seed_firs.py
│   │   ├── engine/
│   │   │   ├── __init__.py
│   │   │   ├── entity_resolution.py
│   │   │   ├── geo_aggregation.py
│   │   │   ├── graph_builder.py
│   │   │   ├── llm_client.py
│   │   │   ├── mo_similarity.py
│   │   │   └── pattern_alerts.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── fir_models.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   └── fir_schema.py
│   │   └── services/
│   │       ├── __init__.py
│   │       └── intelligence.py
│   └── web/
│       ├── index.html
│       ├── package.json
│       ├── postcss.config.mjs
│       ├── tailwind.config.js
│       ├── tsconfig.json
│       ├── tsconfig.node.json
│       ├── vite.config.ts
│       └── src/
│           ├── App.tsx
│           ├── index.css
│           ├── main.tsx
│           ├── api/
│           │   └── client.ts
│           ├── components/
│           │   ├── layout/
│           │   │   ├── Sidebar.tsx
│           │   │   └── Topbar.tsx
│           │   └── ui/
│           │       ├── Badge.tsx
│           │       ├── Card.tsx
│           │       ├── ConfidenceBar.tsx
│           │       ├── ReasoningLine.tsx
│           │       └── StatCard.tsx
│           └── routes/
│               ├── AddFir.tsx
│               ├── Alerts.tsx
│               ├── CrimeMap.tsx
│               ├── Dashboard.tsx
│               ├── Firs.tsx
│               ├── Graph.tsx
│               └── Offenders.tsx
└── .github/
    ├── ISSUE_TEMPLATE/
    │   └── config.yml
    └── workflows/
        └── validate.yml

```

---

## ⚡ How to Run

> **Copy these exact steps from your [`docs/setup-guide.md`](docs/setup-guide.md)**

```bash
# 1. Clone the repo
git clone https://github.com/samSRaina/bob-ai-hackathon-cyber-elevate.git
cd bob-ai-hackathon-cyber-elevate

# 2. Start PostgreSQL
docker-compose up -d db

# 3. Configure environment & install dependencies
cd src && cp .env.example .env
uv sync
cd web && bun install
cd ../..

# 4. Seed database (generates 100 FIRs & runs detection pipeline)
cd src && uv run python -m app.seed && cd ..

# 5. Run the project (starts backend on :8000 and frontend on :5173 concurrently)
bun run dev
```

---

## 🖥️ Demo

| Artifact | Link |
|---|---|
| 📹 Demo Video | [See demo/demo-video-link.txt](demo/demo-video-link.txt) |
| 🌐 Live Demo | [See demo/live-demo-url.txt](demo/live-demo-url.txt) |
| 🖼️ Screenshots | [See demo/screenshots/](demo/screenshots/) |
| 📊 Presentation | [See presentation/](presentation/) |

---

## ⚠️ Known Limitations

> Be honest — judges appreciate transparency over overclaiming.

- **Seed MO Narrative Phrasing Diversity:** In synthetic test data, some crime modus-operandi narrative templates share phrasing patterns, occasionally causing unrelated cases to embed closely via MO semantic similarity before deterministic identifier pruning.
- **Local-Only Deployment:** The system is currently configured and optimized for local execution via Docker and native processes; cloud container hosting is pending deployment (documented in `demo/live-demo-url.txt`).
- **Demonstration RBAC Header Switching:** The 4-tier RBAC system uses direct request header switching (State Admin, Commissioner, City Police, and PI) to enable seamless evaluation without requiring a complex production SSO/OIDC login flow.
- **Scanned Document OCR Ingestion:** The complete NCRB Integrated Investigation Form-I (IIF-I) relational data schema is implemented, but unstructured physical paper OCR scanning is planned for a subsequent milestone.

---

## 🏅 What We're Most Proud Of

We are most proud of our **deterministic, explainable pattern correlation engine**. In critical policing and public safety operations, black-box AI predictions cannot stand up in court or guide high-stakes field operations. Bob Engine provides complete investigative transparency: every discovered cross-district syndicate is accompanied by clear, human-verifiable match reasons—such as exact vehicle registration matches, normalized phone numbers, and Double-Metaphone phonetic suspect matches—alongside evidence-weighted confidence scores. Furthermore, the entire core intelligence pipeline operates deterministically with zero external cloud dependencies, ensuring 100% operational resilience even when external LLMs are unavailable.

---

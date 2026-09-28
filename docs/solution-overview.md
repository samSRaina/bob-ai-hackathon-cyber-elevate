# Solution Overview

Bob Engine directly and immediately surfaces pattern correlations — who/what links to what, and exactly why — geographically and as an explainable ranked list.

## Core features
- Deterministic entity resolution (phone/vehicle exact match + Double-Metaphone + RapidFuzz)
- MO-similarity clustering using sentence-transformer embeddings
- 4-tier RBAC (State/Commissioner/City/PI) via direct header toggle
- UP crime map: spot pins + heatmap, filterable by crime category
- Automatic alerts when clusters form or grow
- One-sentence AI reasoning gloss per cluster (DeepSeek, gracefully absent if unconfigured)

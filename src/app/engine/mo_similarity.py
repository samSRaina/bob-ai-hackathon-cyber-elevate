"""
MO (Modus Operandi) similarity engine.

Uses sentence-transformers (all-MiniLM-L6-v2) to embed the distilled
modus_operandi field (not the full narrative) and computes cross-station
cosine similarity.

Key design decisions:
- Operates on modus_operandi text (Section 6.1 item 12 note), NOT the
  full narrative, to reduce noise from case-specific details.
- Cross-FIR-only: same-FIR suspects are never linked by MO alone.
- Threshold tuned to 0.82 — above the typical cosine for different-category
  noise but below 1.0 for the deliberately-reused syndicate MO variants.
- Returns edges of the form (suspect_id_a, suspect_id_b, score, reason_str)
  that are fed directly into entity_resolution.resolve_entities().
"""
from __future__ import annotations

import numpy as np
from typing import Optional

MO_SIMILARITY_THRESHOLD = 0.82

# Lazy-load the model to avoid import-time cost and allow graceful absence
_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Numerically stable cosine similarity."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


class MORecord:
    def __init__(self, suspect_id: int, fir_id: int, mo_text: str):
        self.suspect_id = suspect_id
        self.fir_id = fir_id
        self.mo_text = mo_text.strip() if mo_text else ""


def compute_mo_edges(
    records: list[MORecord],
    threshold: float = MO_SIMILARITY_THRESHOLD,
) -> list[tuple[int, int, float, str]]:
    """
    Compute MO similarity edges between suspects from DIFFERENT FIRs.

    Returns list of (suspect_id_a, suspect_id_b, score, reason_str).
    Returns empty list if no records or model unavailable.
    """
    if not records:
        return []

    # Filter to records that have actual MO text
    valid = [r for r in records if r.mo_text]
    if len(valid) < 2:
        return []

    try:
        model = _get_model()
    except Exception:
        # Model unavailable — graceful degradation, entity resolution still runs
        return []

    texts = [r.mo_text for r in valid]
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)

    edges: list[tuple[int, int, float, str]] = []

    for i in range(len(valid)):
        for j in range(i + 1, len(valid)):
            ra, rb = valid[i], valid[j]

            # Never link same-FIR suspects via MO
            if ra.fir_id == rb.fir_id:
                continue

            score = cosine_similarity(embeddings[i], embeddings[j])
            if score >= threshold:
                reason = describe_mo_match(score)
                edges.append((ra.suspect_id, rb.suspect_id, score, reason))

    return edges


def describe_mo_match(score: float) -> str:
    """Plain-language sentence for an MO-embedding similarity match — shared with
    the Add FIR similarity check so the same evidence reads identically everywhere."""
    pct = round(score * 100)
    return (
        f"The described modus operandi (method of crime) is {pct}% textually similar "
        f"to another case - suggesting a matching criminal technique or pattern."
    )

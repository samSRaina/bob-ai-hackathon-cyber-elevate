"""
Deterministic, human-readable reasoning composer.

entity_resolution.py and mo_similarity.py already produce descriptive,
plain-English match_reasons (not just raw scores) for every kind of
evidence — exact identifiers, name/phonetic similarity, MO-embedding
similarity. This module composes those into one short summary paragraph
per cluster or candidate match, so there is always a readable "why" shown
wherever a match appears, without depending on an LLM being configured.

llm_client.explain() is tried first when an LLM key is set (nicer prose);
this is the always-available fallback — and, since most local/demo runs
have no LLM key, it is in practice the primary source everywhere in this app.
"""
from __future__ import annotations


def compose_gloss(
    match_reasons: list[str],
    confidence_score: float,
    primary_name: str | None = None,
    syndicate_flag: bool = False,
    districts_involved: list[str] | None = None,
) -> str:
    """
    Build one readable paragraph from a cluster/match's evidence list.
    Never raises — an empty match_reasons list just yields an empty string,
    so callers can skip rendering a gloss line entirely in that case.
    """
    if not match_reasons:
        return ""

    who = f"'{primary_name}'" if primary_name else "the suspects in these records"
    pct = round(confidence_score * 100)
    evidence = " ".join(match_reasons)

    gloss = f"These FIRs appear connected to {who} with {pct}% confidence. {evidence}"

    if syndicate_flag and districts_involved:
        districts = ", ".join(districts_involved)
        gloss += (
            f" Because this pattern spans multiple districts ({districts}), "
            f"it has been flagged as a suspected organized syndicate requiring "
            f"cross-jurisdiction coordination."
        )
    elif confidence_score < 0.85:
        gloss += " This is a lower-confidence pattern worth an investigator's review, not yet a confirmed link."

    return gloss

"""
Entity resolution engine — the headline engine for Bob Engine.

Priority system (deterministic, no black-box scores):
  Priority 1: Exact phone / vehicle match → score 1.0 per shared identifier
  Priority 2: Double-Metaphone blocking + RapidFuzz token_sort_ratio (≥82)
              composite = 0.5·string_ratio + 0.3·phonetic_match + 0.2·alias_overlap
  Priority 3: MO-similarity edges (fed in from mo_similarity.py)

Merge via union-find. Confidence weighted by evidence:
  - exact identifier evidence → high (0.97)
  - phonetic/name evidence    → composite
  - MO-similarity-only        → dampened (capped ≤ 0.80)

syndicate_flag: requires ≥2 districts/cities AND (exact evidence OR high confidence ≥0.92)
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime
from typing import Optional

from rapidfuzz import fuzz
from metaphone import doublemetaphone

# ---------------------------------------------------------------------------
# Union-Find (path compression + union-by-rank)
# ---------------------------------------------------------------------------

class UnionFind:
    def __init__(self):
        self.parent: dict[int, int] = {}
        self.rank: dict[int, int] = {}

    def find(self, x: int) -> int:
        if x not in self.parent:
            self.parent[x] = x
            self.rank[x] = 0
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x: int, y: int) -> bool:
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1
        return True

    def groups(self) -> dict[int, list[int]]:
        result: dict[int, list[int]] = defaultdict(list)
        for x in self.parent:
            result[self.find(x)].append(x)
        return dict(result)


# ---------------------------------------------------------------------------
# Suspect record (lightweight DTO — avoids live DB objects during computation)
# ---------------------------------------------------------------------------

class SuspectRecord:
    def __init__(
        self,
        suspect_id: int,
        fir_id: int,
        name: Optional[str],
        alias: Optional[str],
        aliases: Optional[list],
        phone_numbers: Optional[list],
        vehicle_numbers: Optional[list],
        modus_operandi: Optional[str],
        district: str,
        city: str,
        station_id: int,
    ):
        self.suspect_id = suspect_id
        self.fir_id = fir_id
        self.name = name
        self.alias = alias
        self.aliases: list[str] = list(aliases or [])
        if alias and alias not in self.aliases:
            self.aliases.append(alias)
        self.phone_numbers: list[str] = [str(p).strip() for p in (phone_numbers or []) if p]
        self.vehicle_numbers: list[str] = [str(v).strip().upper() for v in (vehicle_numbers or []) if v]
        self.modus_operandi = modus_operandi or ""
        self.district = district
        self.city = city
        self.station_id = station_id

    def metaphones(self) -> tuple[str, str]:
        """Double Metaphone of the primary name."""
        if not self.name:
            return ("", "")
        first_word = self.name.split()[0] if self.name else ""
        return doublemetaphone(first_word)

    def all_name_tokens(self) -> list[str]:
        tokens = []
        if self.name:
            tokens.append(self.name)
        tokens.extend(self.aliases)
        return tokens


# ---------------------------------------------------------------------------
# Evidence accumulator
# ---------------------------------------------------------------------------

class EdgeEvidence:
    """Accumulates all evidence between a pair of suspects."""

    def __init__(self):
        self.reasons: list[str] = []
        self.max_score: float = 0.0
        self.has_exact: bool = False

    def add(self, reason: str, score: float, is_exact: bool = False):
        self.reasons.append(reason)
        self.max_score = max(self.max_score, score)
        if is_exact:
            self.has_exact = True

    def final_score(self) -> float:
        """Weighted final score — exact evidence floats to top; MO-only is capped."""
        if self.has_exact:
            return min(0.97, self.max_score)
        return min(0.80, self.max_score)  # MO-only / name-only evidence capped at 0.80


# ---------------------------------------------------------------------------
# Core matching functions
# ---------------------------------------------------------------------------

FUZZY_THRESHOLD = 82  # RapidFuzz token_sort_ratio threshold (0–100 scale)
PHONETIC_THRESHOLD = 0.5  # weight contribution when metaphone primary codes match


def _name_similarity(a: SuspectRecord, b: SuspectRecord) -> float:
    """
    Composite name score:
      0.5 * string_ratio  (best across all name token pairs)
    + 0.3 * phonetic_match (metaphone primary codes match?)
    + 0.2 * alias_overlap  (any token in common across all aliases)
    Returns 0.0–1.0.
    """
    a_tokens = a.all_name_tokens()
    b_tokens = b.all_name_tokens()

    if not a_tokens or not b_tokens:
        return 0.0

    # String ratio: best pair
    best_ratio = 0.0
    for at in a_tokens:
        for bt in b_tokens:
            r = fuzz.token_sort_ratio(at, bt) / 100.0
            best_ratio = max(best_ratio, r)

    # Phonetic match
    a_meta = a.metaphones()
    b_meta = b.metaphones()
    phonetic = (
        1.0
        if (a_meta[0] and b_meta[0] and a_meta[0] == b_meta[0])
        else (0.5 if (a_meta[1] and b_meta[1] and a_meta[1] == b_meta[1]) else 0.0)
    )

    # Alias overlap
    a_set = {t.lower() for t in a_tokens}
    b_set = {t.lower() for t in b_tokens}
    alias_overlap = 1.0 if a_set & b_set else 0.0

    composite = 0.5 * best_ratio + 0.3 * phonetic + 0.2 * alias_overlap
    return composite


def describe_name_match(a_names: str, b_names: str, score: float) -> str:
    """Plain-language sentence for a name/phonetic/alias similarity match — shared
    with the Add FIR similarity check so the same evidence reads identically everywhere."""
    pct = round(score * 100)
    return (
        f"The suspect name(s) '{a_names}' and '{b_names}' match with {pct}% similarity "
        f"(spelling, phonetics, and known aliases) - likely the same individual, "
        f"possibly recorded with slightly different spelling."
    )


def _exact_identifiers(a: SuspectRecord, b: SuspectRecord) -> list[str]:
    """Return descriptive, plain-language sentences for shared exact phone/vehicle identifiers."""
    shared = []
    phone_overlap = set(a.phone_numbers) & set(b.phone_numbers)
    for p in phone_overlap:
        shared.append(
            f"The exact same phone number ({p}) appears on both records - "
            f"strong direct evidence of the same person."
        )
    vehicle_overlap = set(a.vehicle_numbers) & set(b.vehicle_numbers)
    for v in vehicle_overlap:
        shared.append(
            f"The exact same vehicle registration ({v}) appears on both records - "
            f"strong direct evidence of the same person or group."
        )
    return shared


def _should_block(a: SuspectRecord, b: SuspectRecord) -> bool:
    """
    Phonetic blocking gate: only compare suspects whose Double Metaphone
    primary codes share at least one code with each other OR who share
    an exact identifier. This avoids O(n²) full comparison.
    """
    # Always process pairs with exact identifiers
    if set(a.phone_numbers) & set(b.phone_numbers):
        return True
    if set(a.vehicle_numbers) & set(b.vehicle_numbers):
        return True
    # Metaphone gate for named suspects
    if a.name and b.name:
        am = a.metaphones()
        bm = b.metaphones()
        if am[0] and bm[0] and am[0] == bm[0]:
            return True
        # Also pass partial-name abbreviation (first char match is weak but low FP
        # when combined with fuzzy threshold below)
        if a.name[0].upper() == b.name[0].upper():
            return True
    return False


# ---------------------------------------------------------------------------
# Main detection function
# ---------------------------------------------------------------------------

def resolve_entities(
    suspects: list[SuspectRecord],
    mo_similarity_edges: list[tuple[int, int, float, str]],
    fir_station_map: dict[int, tuple[str, str]],  # fir_id -> (district, city)
) -> list[dict]:
    """
    Runs entity resolution over all suspects.
    mo_similarity_edges: list of (suspect_id_a, suspect_id_b, score, reason_str)
    fir_station_map: {fir_id: (district, city)}

    Returns list of cluster dicts:
    {
        canonical_id: str,
        primary_name: str | None,
        linked_suspect_ids: list[int],
        linked_fir_ids: list[int],
        districts_involved: list[str],
        cities_involved: list[str],
        confidence_score: float,
        match_reasons: list[str],
        syndicate_flag: bool,
    }
    """
    uf = UnionFind()
    edge_evidence: dict[tuple[int, int], EdgeEvidence] = {}

    def _get_evidence(a_id: int, b_id: int) -> EdgeEvidence:
        key = (min(a_id, b_id), max(a_id, b_id))
        if key not in edge_evidence:
            edge_evidence[key] = EdgeEvidence()
        return edge_evidence[key]

    suspect_map: dict[int, SuspectRecord] = {s.suspect_id: s for s in suspects}

    # --- Pass 1: Exact identifier matches (Priority 1) ---
    for i, sa in enumerate(suspects):
        for sb in suspects[i + 1:]:
            exact_reasons = _exact_identifiers(sa, sb)
            if exact_reasons:
                ev = _get_evidence(sa.suspect_id, sb.suspect_id)
                for r in exact_reasons:
                    ev.add(r, 0.97, is_exact=True)
                uf.union(sa.suspect_id, sb.suspect_id)

    # --- Pass 2: Phonetic blocking + RapidFuzz (Priority 2) ---
    for i, sa in enumerate(suspects):
        for sb in suspects[i + 1:]:
            if sa.fir_id == sb.fir_id:
                continue  # same FIR suspects don't cluster each other
            if not _should_block(sa, sb):
                continue
            score = _name_similarity(sa, sb)
            if score * 100 >= FUZZY_THRESHOLD:
                ev = _get_evidence(sa.suspect_id, sb.suspect_id)
                a_names = ", ".join(sa.all_name_tokens()) or "(unknown)"
                b_names = ", ".join(sb.all_name_tokens()) or "(unknown)"
                ev.add(
                    describe_name_match(a_names, b_names, score),
                    score,
                    is_exact=False,
                )
                uf.union(sa.suspect_id, sb.suspect_id)

    # --- Pass 3: MO similarity edges (Priority 3) ---
    for sid_a, sid_b, mo_score, mo_reason in mo_similarity_edges:
        ev = _get_evidence(sid_a, sid_b)
        ev.add(mo_reason, mo_score, is_exact=False)
        uf.union(sid_a, sid_b)

    # --- Build clusters from union-find groups ---
    groups = uf.groups()
    clusters = []

    for root, member_ids in groups.items():
        if len(member_ids) < 2:
            continue  # singleton — not a repeat-offender cluster

        # Gather all evidence for this cluster
        all_reasons: list[str] = []
        max_score: float = 0.0
        has_exact = False
        for i, a_id in enumerate(member_ids):
            for b_id in member_ids[i + 1:]:
                key = (min(a_id, b_id), max(a_id, b_id))
                if key in edge_evidence:
                    ev = edge_evidence[key]
                    all_reasons.extend(ev.reasons)
                    max_score = max(max_score, ev.final_score())
                    if ev.has_exact:
                        has_exact = True

        # Deduplicate reasons
        all_reasons = list(dict.fromkeys(all_reasons))

        # Geography
        member_fir_ids = list({suspect_map[sid].fir_id for sid in member_ids})
        districts = list({suspect_map[sid].district for sid in member_ids})
        cities = list({suspect_map[sid].city for sid in member_ids})

        # Primary name: most-common non-null name
        names = [suspect_map[sid].name for sid in member_ids if suspect_map[sid].name]
        primary_name = max(set(names), key=names.count) if names else None

        # Syndicate: ≥2 districts/cities + (exact evidence OR confidence ≥ 0.92)
        multi_district = len(districts) >= 2 or len(cities) >= 2
        syndicate = multi_district and (has_exact or max_score >= 0.92)

        clusters.append({
            "canonical_id": str(uuid.uuid4()),
            "primary_name": primary_name,
            "linked_suspect_ids": member_ids,
            "linked_fir_ids": member_fir_ids,
            "districts_involved": districts,
            "cities_involved": cities,
            "confidence_score": round(max_score, 4),
            "match_reasons": all_reasons,
            "syndicate_flag": syndicate,
        })

    # Sort by confidence descending
    clusters.sort(key=lambda c: c["confidence_score"], reverse=True)
    return clusters

"""
Pattern alerts engine.

Diffs cluster state before/after a detection run and creates Alert rows.
Alert kinds:
  - new_cluster     : a cluster that didn't exist before
  - cluster_grew    : existing cluster gained new FIRs
  - became_syndicate: cluster newly qualified as syndicate

Scope determination: alerts are scoped to the union of all jurisdictions
touched by the cluster (one alert per level: STATE, DISTRICT, CITY, STATION
would be too noisy — we create alerts at the DISTRICT level for multi-district
clusters and STATION level for single-station ones; syndicates get STATE + DISTRICT).
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional


class ClusterSnapshot:
    """Lightweight snapshot of cluster state for diffing."""
    def __init__(
        self,
        canonical_id: str,
        linked_fir_ids: list,
        syndicate_flag: bool,
        districts_involved: list,
        cities_involved: list,
        match_reasons: list,
        confidence_score: float,
    ):
        self.canonical_id = canonical_id
        self.fir_ids = set(int(x) for x in (linked_fir_ids or []))
        self.syndicate_flag = syndicate_flag
        self.districts = list(districts_involved or [])
        self.cities = list(cities_involved or [])
        self.match_reasons = list(match_reasons or [])
        self.confidence_score = confidence_score


def diff_and_create_alerts(
    before: list[ClusterSnapshot],   # cluster state BEFORE this detection run
    after: list[ClusterSnapshot],    # cluster state AFTER this detection run
    triggering_fir_id: Optional[int] = None,
) -> list[dict]:
    """
    Compare before/after cluster snapshots and produce Alert dicts.

    Returns list of alert dicts (not yet inserted — caller inserts):
    {
        cluster_canonical_id, triggering_fir_id, kind,
        scope_level, scope_ref, message, match_reasons
    }
    """
    before_map = {s.canonical_id: s for s in before}
    after_map = {s.canonical_id: s for s in after}

    alerts: list[dict] = []

    for cid, snap in after_map.items():
        prev = before_map.get(cid)

        if prev is None:
            # New cluster
            alerts.extend(
                _make_alerts(snap, "new_cluster", triggering_fir_id,
                             f"New repeat offender pattern detected (confidence {snap.confidence_score:.0%})")
            )
        else:
            if len(snap.fir_ids) > len(prev.fir_ids):
                # Cluster grew
                alerts.extend(
                    _make_alerts(snap, "cluster_grew", triggering_fir_id,
                                 f"Existing pattern expanded: {len(snap.fir_ids)} FIRs now linked")
                )
            if snap.syndicate_flag and not prev.syndicate_flag:
                # Newly qualified as syndicate
                alerts.extend(
                    _make_alerts(snap, "became_syndicate", triggering_fir_id,
                                 f"Pattern upgraded to SYNDICATE: spans {len(snap.districts)} district(s)")
                )

    return alerts


def _make_alerts(
    snap: ClusterSnapshot,
    kind: str,
    triggering_fir_id: Optional[int],
    base_message: str,
) -> list[dict]:
    """
    Produce alert dicts for a cluster change.
    - Syndicate → STATE + each distinct DISTRICT
    - Multi-district (not syndicate) → each DISTRICT
    - Single district → each CITY in the cluster
    """
    alerts = []

    def _alert(scope_level: str, scope_ref: str, message: str) -> dict:
        return {
            "cluster_canonical_id": snap.canonical_id,
            "triggering_fir_id": triggering_fir_id,
            "kind": kind,
            "scope_level": scope_level,
            "scope_ref": scope_ref,
            "message": message,
            "match_reasons": snap.match_reasons,
        }

    if snap.syndicate_flag:
        alerts.append(_alert("STATE", "Uttar Pradesh", f"[SYNDICATE ALERT] {base_message}"))
        for district in snap.districts:
            alerts.append(_alert("DISTRICT", district, f"[SYNDICATE ALERT] {base_message}"))
    elif len(snap.districts) > 1:
        for district in snap.districts:
            alerts.append(_alert("DISTRICT", district, base_message))
    else:
        for city in snap.cities:
            alerts.append(_alert("CITY", city, base_message))
        # Also at district level if available
        if snap.districts:
            alerts.append(_alert("DISTRICT", snap.districts[0], base_message))

    return alerts

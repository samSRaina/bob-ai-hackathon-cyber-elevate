"""
Intelligence service layer — shared, RBAC-scoped.

This is the bridge between the REST routes and the engine layer.
Every public method takes a Scope object and applies it to all queries.
"""
from __future__ import annotations

from typing import Optional
from sqlmodel import Session, select, col

from app.models.fir_models import (
    FIRRecord, SuspectEntity, PoliceStation,
    RepeatOffenderCluster, Alert,
)
from app.core.rbac import Scope
from app.engine.geo_aggregation import compute_geo_data
from app.engine.graph_builder import build_graph, graph_to_json


def _fir_filter(stmt, scope: Scope):
    """Apply RBAC station_ids filter to a FIRRecord query."""
    if scope.station_ids is not None:
        stmt = stmt.where(col(FIRRecord.station_id).in_(scope.station_ids))
    return stmt


# ---------------------------------------------------------------------------
# FIR queries
# ---------------------------------------------------------------------------

def list_firs(
    session: Session,
    scope: Scope,
    crime_category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[FIRRecord]:
    stmt = select(FIRRecord)
    stmt = _fir_filter(stmt, scope)
    if crime_category:
        stmt = stmt.where(FIRRecord.crime_category == crime_category)
    if search:
        stmt = stmt.where(
            (col(FIRRecord.fir_number).contains(search))
            | (col(FIRRecord.complainant_name).contains(search))
            | (col(FIRRecord.occurrence_address).contains(search))
        )
    stmt = stmt.order_by(col(FIRRecord.fir_date_time).desc()).offset(offset).limit(limit)
    return list(session.exec(stmt).all())


def get_fir(session: Session, fir_id: int, scope: Scope) -> Optional[FIRRecord]:
    fir = session.get(FIRRecord, fir_id)
    if not fir:
        return None
    if scope.station_ids is not None and fir.station_id not in scope.station_ids:
        return None
    return fir


def get_fir_suspects(session: Session, fir_id: int) -> list[SuspectEntity]:
    return list(session.exec(select(SuspectEntity).where(SuspectEntity.fir_id == fir_id)).all())


def get_fir_cluster(session: Session, fir_id: int) -> Optional[RepeatOffenderCluster]:
    """Return the cluster this FIR belongs to, if any."""
    suspects = get_fir_suspects(session, fir_id)
    for s in suspects:
        if s.cluster_canonical_id:
            return session.exec(
                select(RepeatOffenderCluster).where(
                    RepeatOffenderCluster.canonical_id == s.cluster_canonical_id
                )
            ).first()
    return None


def get_fir_cluster_map(session: Session, fir_ids: list[int]) -> dict[int, RepeatOffenderCluster]:
    """Bulk version of get_fir_cluster: one query for suspects + one for
    clusters instead of N+1, so the FIRs LIST view (not just the detail view)
    can show its "Linked / Syndicate" status and reasoning for every row.
    """
    if not fir_ids:
        return {}
    suspects = session.exec(
        select(SuspectEntity).where(col(SuspectEntity.fir_id).in_(fir_ids))
    ).all()
    canonical_ids = {s.cluster_canonical_id for s in suspects if s.cluster_canonical_id}
    if not canonical_ids:
        return {}
    clusters = session.exec(
        select(RepeatOffenderCluster).where(
            col(RepeatOffenderCluster.canonical_id).in_(canonical_ids)
        )
    ).all()
    clusters_by_canonical = {c.canonical_id: c for c in clusters}

    fir_to_cluster: dict[int, RepeatOffenderCluster] = {}
    for s in suspects:
        if s.cluster_canonical_id and s.cluster_canonical_id in clusters_by_canonical:
            fir_to_cluster.setdefault(s.fir_id, clusters_by_canonical[s.cluster_canonical_id])
    return fir_to_cluster


def get_fir_briefs(session: Session, fir_ids: list[int]) -> dict[int, dict]:
    """Bulk-fetch brief display fields for a set of FIR ids, keyed by id.

    Used everywhere a cluster/correlation view needs to render its linked FIRs
    by their human-readable fir_number (not the raw internal id) without an
    N+1 query per linked FIR.
    """
    if not fir_ids:
        return {}
    rows = session.exec(
        select(FIRRecord).where(col(FIRRecord.id).in_(fir_ids))
    ).all()
    return {
        f.id: {
            "id": f.id,
            "fir_number": f.fir_number,
            "crime_category": f.crime_category,
            "district": f.district,
            "police_station": f.police_station,
            "fir_date_time": str(f.fir_date_time) if f.fir_date_time else None,
            "complainant_name": f.complainant_name,
        }
        for f in rows
    }


# ---------------------------------------------------------------------------
# Cluster / offender queries
# ---------------------------------------------------------------------------

def list_clusters(
    session: Session,
    scope: Scope,
    syndicate_only: bool = False,
) -> list[RepeatOffenderCluster]:
    """
    Return clusters visible under the given scope.
    A cluster is visible if any of its linked FIRs are in scope.
    """
    all_clusters = session.exec(
        select(RepeatOffenderCluster).order_by(
            col(RepeatOffenderCluster.confidence_score).desc()
        )
    ).all()

    if scope.station_ids is None:
        # STATE_ADMIN sees all
        result = list(all_clusters)
    else:
        # Load scoped FIR ids once. session.exec() on a single-column select() returns
        # a flat sequence of scalars (ints here), not row tuples — no r[0] unpacking.
        scoped_fir_ids = set(
            session.exec(
                select(FIRRecord.id).where(col(FIRRecord.station_id).in_(scope.station_ids))
            ).all()
        )
        result = []
        for cluster in all_clusters:
            linked = set(int(x) for x in (cluster.linked_fir_ids or []))
            if linked & scoped_fir_ids:
                result.append(cluster)

    if syndicate_only:
        result = [c for c in result if c.syndicate_flag]

    return result


def get_suspect_dossier(session: Session, suspect_id: int, scope: Scope) -> Optional[dict]:
    suspect = session.get(SuspectEntity, suspect_id)
    if not suspect:
        return None
    fir = get_fir(session, suspect.fir_id, scope)
    if not fir:
        return None  # out of scope

    cluster = None
    if suspect.cluster_canonical_id:
        cluster = session.exec(
            select(RepeatOffenderCluster).where(
                RepeatOffenderCluster.canonical_id == suspect.cluster_canonical_id
            )
        ).first()

    return {
        "suspect": suspect,
        "fir": fir,
        "cluster": cluster,
    }


# ---------------------------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------------------------

def dashboard_summary(session: Session, scope: Scope) -> dict:
    firs = list_firs(session, scope, limit=10000)

    total_firs = len(firs)
    by_category: dict[str, int] = {}
    by_station: dict[str, int] = {}
    by_district: dict[str, int] = {}

    station_cache: dict[int, PoliceStation] = {}

    def _get_station(sid: int) -> Optional[PoliceStation]:
        if sid not in station_cache:
            st = session.get(PoliceStation, sid)
            if st:
                station_cache[sid] = st
        return station_cache.get(sid)

    for fir in firs:
        by_category[fir.crime_category] = by_category.get(fir.crime_category, 0) + 1
        if fir.station_id:
            st = _get_station(fir.station_id)
            if st:
                by_station[st.name] = by_station.get(st.name, 0) + 1
                by_district[st.district] = by_district.get(st.district, 0) + 1

    clusters = list_clusters(session, scope)
    syndicates = [c for c in clusters if c.syndicate_flag]

    return {
        "total_firs": total_firs,
        "total_clusters": len(clusters),
        "total_syndicates": len(syndicates),
        "by_category": by_category,
        "by_station": by_station,
        "by_district": by_district,
    }


# ---------------------------------------------------------------------------
# Geo / map
# ---------------------------------------------------------------------------

def get_heatmap(
    session: Session,
    scope: Scope,
    crime_category: Optional[str] = None,
) -> dict:
    all_stations = list(session.exec(select(PoliceStation)).all())
    scoped_firs = list_firs(session, scope, limit=10000)

    # Map each scoped FIR to its cluster (if any) so the map's click popup can
    # show the same correlation/reasoning that Dashboard, Offenders, and the
    # FIR detail view show — clustering relationships must be visible
    # everywhere a FIR is surfaced, including the map.
    fir_to_cluster = get_fir_cluster_map(session, [f.id for f in scoped_firs])

    def _correlation_brief(fir_id: int) -> Optional[dict]:
        c = fir_to_cluster.get(fir_id)
        if not c:
            return None
        return {
            "cluster_id": c.canonical_id,
            "primary_name": c.primary_name,
            "confidence_score": c.confidence_score,
            "syndicate_flag": c.syndicate_flag,
            "match_reasons": c.match_reasons or [],
        }

    fir_dicts = [
        {
            "id": f.id,
            "station_id": f.station_id,
            "crime_category": f.crime_category,
            "occurrence_date_from": f.occurrence_date_from,
            "fir_number": f.fir_number,
            "fir_date_time": str(f.fir_date_time) if f.fir_date_time else None,
            "complainant_name": f.complainant_name,
            "occurrence_address": f.occurrence_address,
            "narrative": f.narrative,
            "modus_operandi": f.modus_operandi,
            "correlation": _correlation_brief(f.id),
        }
        for f in scoped_firs
    ]
    station_dicts = [
        {
            "id": s.id,
            "name": s.name,
            "city": s.city,
            "district": s.district,
            "latitude": s.latitude,
            "longitude": s.longitude,
        }
        for s in all_stations
    ]

    return compute_geo_data(
        firs=fir_dicts,
        stations=station_dicts,
        crime_category=crime_category,
        station_ids=scope.station_ids,
    )


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------

def get_graph(session: Session, scope: Scope) -> dict:
    scoped_firs = list_firs(session, scope, limit=10000)
    scoped_fir_ids = {f.id for f in scoped_firs}

    suspects = list(session.exec(
        select(SuspectEntity).where(col(SuspectEntity.fir_id).in_(list(scoped_fir_ids)))
    ).all())

    all_stations = list(session.exec(select(PoliceStation)).all())
    clusters = list_clusters(session, scope)

    suspect_dicts = [
        {
            "id": s.id, "name": s.name, "fir_id": s.fir_id,
            "cluster_canonical_id": s.cluster_canonical_id,
        }
        for s in suspects
    ]
    fir_dicts = [
        {"id": f.id, "fir_number": f.fir_number, "crime_category": f.crime_category,
         "station_id": f.station_id, "district": f.district}
        for f in scoped_firs
    ]
    station_dicts = [
        {"id": s.id, "name": s.name, "city": s.city, "district": s.district}
        for s in all_stations
    ]
    cluster_dicts = [
        {
            "canonical_id": c.canonical_id,
            "linked_suspect_ids": c.linked_suspect_ids or [],
            "match_reasons": c.match_reasons or [],
            "confidence_score": c.confidence_score,
            "syndicate_flag": c.syndicate_flag,
        }
        for c in clusters
    ]

    G = build_graph(suspect_dicts, fir_dicts, station_dicts, cluster_dicts)
    return graph_to_json(G)


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

def list_alerts(session: Session, scope: Scope, limit: int = 50) -> list[Alert]:
    all_alerts = list(session.exec(
        select(Alert).order_by(col(Alert.created_at).desc()).limit(500)
    ).all())

    return [
        a for a in all_alerts
        if scope.filter_alert(a.scope_level, a.scope_ref)
    ][:limit]


# ---------------------------------------------------------------------------
# Stations
# ---------------------------------------------------------------------------

def list_all_stations(session: Session) -> list[PoliceStation]:
    return list(session.exec(select(PoliceStation).order_by(PoliceStation.name)).all())


def list_scoped_stations(session: Session, scope: Scope) -> list[PoliceStation]:
    stmt = select(PoliceStation)
    if scope.station_ids is not None:
        stmt = stmt.where(col(PoliceStation.id).in_(scope.station_ids))
    return list(session.exec(stmt).all())

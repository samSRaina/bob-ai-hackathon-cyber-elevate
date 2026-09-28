"""
Intelligence service layer — shared, RBAC-scoped.

This is the bridge between the REST routes and the engine layer.
Every public method takes a Scope object and applies it to all queries.
"""
from __future__ import annotations

from collections import defaultdict
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
# Similarity check — draft FIR (Add FIR form), no persistence
# ---------------------------------------------------------------------------

def check_similarity(session: Session, draft) -> list[dict]:
    """
    Compare a draft FIR (not yet saved) against every existing suspect/FIR
    using the same evidence tiers as the real entity-resolution engine
    (exact identifiers, phonetic/fuzzy name match, MO-embedding similarity),
    without writing anything to the database.

    `draft` is a schemas.fir_schema.SimilarityCheckRequest.

    Returns a list of match dicts sorted by confidence descending, one per
    matching FIR (its best-evidence suspect + reasons), capped to 15.
    """
    from app.engine.entity_resolution import SuspectRecord, _exact_identifiers, _should_block, _name_similarity
    from app.engine.mo_similarity import MORecord, compute_mo_edges

    if not draft.suspects and not (draft.modus_operandi or "").strip():
        return []

    suspects_db = list(session.exec(select(SuspectEntity)).all())
    fir_ids = list({s.fir_id for s in suspects_db})
    firs_db = {
        f.id: f for f in session.exec(
            select(FIRRecord).where(col(FIRRecord.id).in_(fir_ids))
        ).all()
    } if fir_ids else {}
    stations_db = {s.id: s for s in session.exec(select(PoliceStation)).all()}

    def _fir_location(fir: FIRRecord) -> tuple[str, str]:
        if fir.station_id and fir.station_id in stations_db:
            st = stations_db[fir.station_id]
            return (st.district, st.city)
        return (fir.district, fir.district)

    existing_records: list[SuspectRecord] = []
    for s in suspects_db:
        fir = firs_db.get(s.fir_id)
        if not fir:
            continue
        district, city = _fir_location(fir)
        existing_records.append(SuspectRecord(
            suspect_id=s.id, fir_id=s.fir_id, name=s.name, alias=s.alias,
            aliases=s.aliases or [], phone_numbers=s.phone_numbers or [],
            vehicle_numbers=s.vehicle_numbers or [], modus_operandi=fir.modus_operandi or "",
            district=district, city=city, station_id=fir.station_id or 0,
        ))

    # Evidence per candidate FIR id: list of (reason, score, is_exact)
    fir_evidence: dict[int, list[tuple[str, float, bool]]] = defaultdict(list)

    # --- Draft suspects vs every existing suspect: exact identifiers + name similarity ---
    for i, ds in enumerate(draft.suspects):
        draft_record = SuspectRecord(
            suspect_id=-(i + 1), fir_id=-1, name=ds.name, alias=ds.alias,
            aliases=[], phone_numbers=ds.phone_numbers, vehicle_numbers=ds.vehicle_numbers,
            modus_operandi=draft.modus_operandi or "", district="", city="", station_id=0,
        )
        for existing in existing_records:
            exact_reasons = _exact_identifiers(draft_record, existing)
            if exact_reasons:
                for r in exact_reasons:
                    fir_evidence[existing.fir_id].append((r, 0.97, True))
            elif _should_block(draft_record, existing):
                score = _name_similarity(draft_record, existing)
                if score * 100 >= 82:
                    a_names = ", ".join(draft_record.all_name_tokens()) or "(unknown)"
                    b_names = ", ".join(existing.all_name_tokens()) or "(unknown)"
                    reason = f"name similarity {score:.2f}: '{a_names}' ~ '{b_names}'"
                    fir_evidence[existing.fir_id].append((reason, score, False))

    # --- Draft MO text vs every existing FIR's MO text ---
    mo_text = (draft.modus_operandi or "").strip()
    if mo_text:
        records = [MORecord(suspect_id=-9999, fir_id=-1, mo_text=mo_text)]
        seen_firs: set[int] = set()
        for fir in firs_db.values():
            if fir.id in seen_firs or not (fir.modus_operandi or "").strip():
                continue
            seen_firs.add(fir.id)
            records.append(MORecord(suspect_id=fir.id, fir_id=fir.id, mo_text=fir.modus_operandi))
        try:
            edges = compute_mo_edges(records)
        except Exception:
            edges = []
        for sid_a, sid_b, score, reason in edges:
            other_fir_id = sid_b if sid_a == -9999 else sid_a
            fir_evidence[other_fir_id].append((reason, score, False))

    if not fir_evidence:
        return []

    fir_briefs = get_fir_briefs(session, list(fir_evidence.keys()))

    matches = []
    for fid, evidence in fir_evidence.items():
        brief = fir_briefs.get(fid)
        if not brief:
            continue
        has_exact = any(e[2] for e in evidence)
        max_score = max(e[1] for e in evidence)
        confidence = min(0.97, max_score) if has_exact else min(0.80, max_score)
        reasons = list(dict.fromkeys(e[0] for e in evidence))
        matches.append({
            **brief,
            "confidence": round(confidence, 4),
            "match_reasons": reasons,
        })

    matches.sort(key=lambda m: m["confidence"], reverse=True)
    return matches[:15]


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


# ---------------------------------------------------------------------------
# FIR creation — the "Add FIR" form
# ---------------------------------------------------------------------------

def create_fir(session: Session, draft) -> FIRRecord:
    """
    Persist a new FIR (+ suspects) from an Add-FIR form submission, then
    re-run full syndicate detection so it's immediately clustered against
    every existing FIR — the same engine the seed data and /detect use, so
    there's exactly one source of truth for "what counts as a match".

    `draft` is a schemas.fir_schema.FIRCreateRequest.
    """
    from app.models.fir_models import utcnow
    from app.data.generate_seed_firs import ACTS_BY_CATEGORY
    from app.seed import run_syndicate_detection

    station = session.get(PoliceStation, draft.station_id)
    if not station:
        raise ValueError(f"Unknown station_id {draft.station_id}")

    year = draft.fir_date_time.year
    existing_count = session.exec(
        select(FIRRecord).where(FIRRecord.station_id == draft.station_id)
    ).all()
    seq = len(existing_count) + 1
    fir_number = f"{year:04d}/{draft.station_id:02d}/{seq:04d}"

    fir = FIRRecord(
        district=station.district,
        police_station=station.name,
        year=year,
        fir_number=fir_number,
        fir_date_time=draft.fir_date_time,
        acts_sections=ACTS_BY_CATEGORY.get(draft.crime_category, []),
        information_type=draft.information_type,
        occurrence_address=draft.occurrence_address,
        complainant_name=draft.complainant_name,
        complainant_phone=draft.complainant_phone,
        complainant_mobile=draft.complainant_mobile,
        narrative=draft.narrative,
        modus_operandi=draft.modus_operandi,
        action_taken="registered_and_investigating",
        crime_category=draft.crime_category,
        station_id=draft.station_id,
    )
    session.add(fir)
    session.flush()  # assign fir.id

    for ds in draft.suspects:
        suspect = SuspectEntity(
            fir_id=fir.id,
            name=ds.name,
            alias=ds.alias,
            aliases=[ds.alias] if ds.alias else [],
            relative_name=ds.relative_name,
            present_address=ds.present_address,
            sex=ds.sex,
            phone_numbers=ds.phone_numbers,
            vehicle_numbers=ds.vehicle_numbers,
        )
        session.add(suspect)

    session.commit()
    session.refresh(fir)

    # Re-cluster against every existing FIR so this one's correlation is
    # available immediately, and so any newly-formed pattern touching older
    # FIRs is picked up too (not just this FIR's own matches).
    run_syndicate_detection(session, triggering_fir_id=fir.id)
    session.refresh(fir)

    return fir


def list_scoped_stations(session: Session, scope: Scope) -> list[PoliceStation]:
    stmt = select(PoliceStation)
    if scope.station_ids is not None:
        stmt = stmt.where(col(PoliceStation.id).in_(scope.station_ids))
    return list(session.exec(stmt).all())

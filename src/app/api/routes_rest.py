"""
Main REST routes — dashboard, offenders, graph, stations, heatmap, detect.
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlmodel import Session

from app.core.database import get_session
from app.core.rbac import Scope, get_scope
from app.services import intelligence as svc

router = APIRouter()


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard/summary")
def dashboard_summary(
    scope: Scope = Depends(get_scope),
    session: Session = Depends(get_session),
):
    return svc.dashboard_summary(session, scope)


# ---------------------------------------------------------------------------
# Offenders / Clusters (primary pattern-correlation view)
# ---------------------------------------------------------------------------

@router.get("/offenders")
def list_offenders(
    syndicate_only: bool = Query(False),
    scope: Scope = Depends(get_scope),
    session: Session = Depends(get_session),
):
    clusters = svc.list_clusters(session, scope, syndicate_only=syndicate_only)

    # Bulk-fetch brief info (fir_number etc.) for every linked FIR across all
    # clusters in one query, so cluster cards can render human-readable FIR
    # numbers instead of raw internal ids — matching the FIRs list/detail views.
    all_fir_ids = sorted({fid for c in clusters for fid in (c.linked_fir_ids or [])})
    fir_briefs = svc.get_fir_briefs(session, all_fir_ids)

    return {
        "offenders": [
            {
                "cluster_id": c.canonical_id,
                "primary_name": c.primary_name,
                "confidence_score": c.confidence_score,
                "syndicate_flag": c.syndicate_flag,
                "districts_involved": c.districts_involved or [],
                "cities_involved": c.cities_involved or [],
                "linked_fir_ids": c.linked_fir_ids or [],
                "linked_suspect_ids": c.linked_suspect_ids or [],
                "match_reasons": c.match_reasons or [],
                "reasoning_gloss": c.reasoning_gloss,
                "updated_at": str(c.updated_at) if c.updated_at else None,
                "linked_firs": [
                    fir_briefs[fid] for fid in (c.linked_fir_ids or []) if fid in fir_briefs
                ],
            }
            for c in clusters
        ],
        "total": len(clusters),
    }


@router.get("/suspects/{suspect_id}")
def get_dossier(
    suspect_id: int,
    scope: Scope = Depends(get_scope),
    session: Session = Depends(get_session),
):
    result = svc.get_suspect_dossier(session, suspect_id, scope)
    if not result:
        raise HTTPException(status_code=404, detail="Suspect not found or out of scope")

    s = result["suspect"]
    fir = result["fir"]
    cluster = result["cluster"]
    linked_firs = (
        svc.get_fir_briefs(session, [fid for fid in (cluster.linked_fir_ids or []) if fid != fir.id])
        if cluster else {}
    )

    return {
        "suspect": {
            "id": s.id,
            "name": s.name,
            "alias": s.alias,
            "aliases": s.aliases or [],
            "relative_name": s.relative_name,
            "present_address": s.present_address,
            "sex": s.sex,
            "dob_or_year": s.dob_or_year,
            "build": s.build,
            "height_cms": s.height_cms,
            "complexion": s.complexion,
            "identification_marks": s.identification_marks,
            "phone_numbers": s.phone_numbers or [],
            "vehicle_numbers": s.vehicle_numbers or [],
            "cluster_canonical_id": s.cluster_canonical_id,
        },
        "fir": {
            "id": fir.id,
            "fir_number": fir.fir_number,
            "crime_category": fir.crime_category,
            "district": fir.district,
            "police_station": fir.police_station,
            "fir_date_time": str(fir.fir_date_time) if fir.fir_date_time else None,
        },
        "cluster": {
            "cluster_id": cluster.canonical_id,
            "primary_name": cluster.primary_name,
            "confidence_score": cluster.confidence_score,
            "syndicate_flag": cluster.syndicate_flag,
            "match_reasons": cluster.match_reasons or [],
            "reasoning_gloss": cluster.reasoning_gloss,
            "linked_fir_ids": cluster.linked_fir_ids or [],
            "districts_involved": cluster.districts_involved or [],
            "linked_firs": list(linked_firs.values()),
        } if cluster else None,
    }


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------

@router.get("/graph")
def get_graph(
    scope: Scope = Depends(get_scope),
    session: Session = Depends(get_session),
):
    return svc.get_graph(session, scope)


# ---------------------------------------------------------------------------
# Stations
# ---------------------------------------------------------------------------

@router.get("/stations/all")
def list_all_stations(session: Session = Depends(get_session)):
    """Unscoped — feeds the Topbar station picker for all roles."""
    stations = svc.list_all_stations(session)
    return {
        "stations": [
            {
                "id": s.id,
                "name": s.name,
                "city": s.city,
                "district": s.district,
                "latitude": s.latitude,
                "longitude": s.longitude,
            }
            for s in stations
        ]
    }


@router.get("/stations")
def list_stations(
    scope: Scope = Depends(get_scope),
    session: Session = Depends(get_session),
):
    stations = svc.list_scoped_stations(session, scope)
    return {
        "stations": [
            {
                "id": s.id,
                "name": s.name,
                "city": s.city,
                "district": s.district,
                "latitude": s.latitude,
                "longitude": s.longitude,
            }
            for s in stations
        ]
    }


# ---------------------------------------------------------------------------
# Heatmap / crime map
# ---------------------------------------------------------------------------

@router.get("/heatmap")
def get_heatmap(
    crime_category: Optional[str] = Query(None),
    scope: Scope = Depends(get_scope),
    session: Session = Depends(get_session),
):
    return svc.get_heatmap(session, scope, crime_category=crime_category)


# ---------------------------------------------------------------------------
# Manual detect re-run (POST /detect — for debugging / post-seed use)
# ---------------------------------------------------------------------------

@router.post("/detect")
def run_detect(
    scope: Scope = Depends(get_scope),
    session: Session = Depends(get_session),
):
    """Manually trigger syndicate detection. Mainly for debugging."""
    from app.seed import run_syndicate_detection
    clusters = run_syndicate_detection(session)
    return {
        "message": f"Detection complete: {len(clusters)} clusters",
        "syndicates": sum(1 for c in clusters if c.syndicate_flag),
    }

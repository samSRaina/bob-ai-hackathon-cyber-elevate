"""
FIR routes — list, detail (with correlation + reasoning inline).
Every route requires RBAC scope headers.
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.core.database import get_session
from app.core.rbac import Scope, get_scope
from app.services import intelligence as svc
from app.schemas.fir_schema import SimilarityCheckRequest, FIRCreateRequest

router = APIRouter()


def _fir_to_dict(fir, suspects=None, cluster=None, linked_firs=None) -> dict:
    """Serialize a FIRRecord to a dict including suspects and correlation."""
    d = {
        # Item 1: Header
        "id": fir.id,
        "district": fir.district,
        "police_station": fir.police_station,
        "year": fir.year,
        "fir_number": fir.fir_number,
        "fir_date_time": str(fir.fir_date_time) if fir.fir_date_time else None,
        # Item 2
        "acts_sections": fir.acts_sections or [],
        # Item 3
        "occurrence_day": fir.occurrence_day,
        "occurrence_date_from": str(fir.occurrence_date_from) if fir.occurrence_date_from else None,
        "occurrence_date_to": str(fir.occurrence_date_to) if fir.occurrence_date_to else None,
        "occurrence_time_period": fir.occurrence_time_period,
        "occurrence_time_from": fir.occurrence_time_from,
        "occurrence_time_to": fir.occurrence_time_to,
        "info_received_date": str(fir.info_received_date) if fir.info_received_date else None,
        "info_received_time": fir.info_received_time,
        "gd_entry_no": fir.gd_entry_no,
        "gd_date_time": str(fir.gd_date_time) if fir.gd_date_time else None,
        # Item 4
        "information_type": fir.information_type,
        # Item 5
        "direction_distance_from_ps": fir.direction_distance_from_ps,
        "beat_no": fir.beat_no,
        "occurrence_address": fir.occurrence_address,
        "outside_jurisdiction_ps": fir.outside_jurisdiction_ps,
        "outside_jurisdiction_district": fir.outside_jurisdiction_district,
        # Item 6: Complainant
        "complainant_name": fir.complainant_name,
        "complainant_relative_name": fir.complainant_relative_name,
        "complainant_dob_or_year": fir.complainant_dob_or_year,
        "complainant_nationality": fir.complainant_nationality,
        "complainant_id_details": fir.complainant_id_details or [],
        "complainant_addresses": fir.complainant_addresses or [],
        "complainant_occupation": fir.complainant_occupation,
        "complainant_phone": fir.complainant_phone,
        "complainant_mobile": fir.complainant_mobile,
        # Item 8
        "delay_reason": fir.delay_reason,
        # Item 9
        "properties": fir.properties or [],
        # Item 10
        "total_property_value": fir.total_property_value,
        # Item 11
        "inquest_ud_case_no": fir.inquest_ud_case_no,
        # Item 12
        "narrative": fir.narrative,
        "modus_operandi": fir.modus_operandi,
        # Item 13
        "action_taken": fir.action_taken,
        "investigating_officer_name": fir.investigating_officer_name,
        "investigating_officer_rank": fir.investigating_officer_rank,
        "investigating_officer_number": fir.investigating_officer_number,
        # Item 14
        "complainant_signature_on_file": fir.complainant_signature_on_file,
        # Item 15
        "dispatch_to_court_datetime": str(fir.dispatch_to_court_datetime) if fir.dispatch_to_court_datetime else None,
        # App fields
        "crime_category": fir.crime_category,
        "station_id": fir.station_id,
    }

    if suspects is not None:
        d["suspects"] = [_suspect_to_dict(s) for s in suspects]

    if cluster is not None:
        d["correlation"] = {
            "cluster_id": cluster.canonical_id,
            "primary_name": cluster.primary_name,
            "confidence_score": cluster.confidence_score,
            "syndicate_flag": cluster.syndicate_flag,
            "districts_involved": cluster.districts_involved or [],
            "cities_involved": cluster.cities_involved or [],
            "linked_fir_ids": cluster.linked_fir_ids or [],
            "match_reasons": cluster.match_reasons or [],
            "reasoning_gloss": cluster.reasoning_gloss,
            # Brief, human-readable info (fir_number, category, station...) for
            # every other FIR in this cluster, so the FIR detail view can show
            # what it's linked to inline rather than just a bare FIR count.
            "linked_firs": [
                brief for fid in (cluster.linked_fir_ids or [])
                if fid != fir.id and (brief := (linked_firs or {}).get(fid))
            ],
        }
    else:
        d["correlation"] = None

    return d


def _suspect_to_dict(s) -> dict:
    return {
        "id": s.id,
        "fir_id": s.fir_id,
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
        "deformities": s.deformities,
        "teeth": s.teeth,
        "hair": s.hair,
        "eyes": s.eyes,
        "habits": s.habits,
        "dress_habits": s.dress_habits,
        "language_dialect": s.language_dialect,
        "burn_mark": s.burn_mark,
        "leucoderma": s.leucoderma,
        "mole": s.mole,
        "scar": s.scar,
        "tattoo": s.tattoo,
        "others": s.others,
        # Derived identifier fields (see Section 6.1 realism note)
        "phone_numbers": s.phone_numbers or [],
        "vehicle_numbers": s.vehicle_numbers or [],
        "cluster_canonical_id": s.cluster_canonical_id,
    }


@router.get("")
def list_firs(
    crime_category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    scope: Scope = Depends(get_scope),
    session: Session = Depends(get_session),
):
    firs = svc.list_firs(session, scope, crime_category=crime_category,
                         search=search, limit=limit, offset=offset)
    # Bulk-computed so the FIRs list table can show "Linked / Syndicate"
    # status and its reasoning per row, not just the single-FIR detail view.
    cluster_map = svc.get_fir_cluster_map(session, [f.id for f in firs])
    return {
        "firs": [_fir_to_dict(f, cluster=cluster_map.get(f.id)) for f in firs],
        "total": len(firs),
    }


@router.post("/check-similarity")
def check_similarity(
    draft: SimilarityCheckRequest,
    session: Session = Depends(get_session),
    scope: Scope = Depends(get_scope),  # not used for scoping — see check_similarity docstring
):
    """
    Live similarity check for the Add FIR form — nothing is persisted. Runs
    the draft's suspects/MO text through the same evidence tiers as the real
    entity-resolution engine and returns candidate matching FIRs, so an
    officer sees "you may be interested in these" before they even submit.
    """
    matches = svc.check_similarity(session, draft)
    return {"matches": matches}


@router.post("")
def create_fir(
    draft: FIRCreateRequest,
    session: Session = Depends(get_session),
    scope: Scope = Depends(get_scope),
):
    fir = svc.create_fir(session, draft)
    suspects = svc.get_fir_suspects(session, fir.id)
    cluster = svc.get_fir_cluster(session, fir.id)
    linked_firs = svc.get_fir_briefs(session, cluster.linked_fir_ids or []) if cluster else None
    return _fir_to_dict(fir, suspects=suspects, cluster=cluster, linked_firs=linked_firs)


@router.get("/{fir_id}")
def get_fir(
    fir_id: int,
    scope: Scope = Depends(get_scope),
    session: Session = Depends(get_session),
):
    fir = svc.get_fir(session, fir_id, scope)
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found or out of scope")

    suspects = svc.get_fir_suspects(session, fir_id)
    cluster = svc.get_fir_cluster(session, fir_id)
    linked_firs = svc.get_fir_briefs(session, cluster.linked_fir_ids or []) if cluster else None

    return _fir_to_dict(fir, suspects=suspects, cluster=cluster, linked_firs=linked_firs)

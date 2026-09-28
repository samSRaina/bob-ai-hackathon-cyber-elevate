"""
Alert routes.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.database import get_session
from app.core.rbac import Scope, get_scope
from app.services import intelligence as svc

router = APIRouter()


@router.get("")
def list_alerts(
    limit: int = Query(50, ge=1, le=200),
    scope: Scope = Depends(get_scope),
    session: Session = Depends(get_session),
):
    alerts = svc.list_alerts(session, scope, limit=limit)
    return {
        "alerts": [
            {
                "id": a.id,
                "cluster_canonical_id": a.cluster_canonical_id,
                "triggering_fir_id": a.triggering_fir_id,
                "kind": a.kind,
                "scope_level": a.scope_level,
                "scope_ref": a.scope_ref,
                "message": a.message,
                "match_reasons": a.match_reasons or [],
                "created_at": str(a.created_at) if a.created_at else None,
            }
            for a in alerts
        ],
        "total": len(alerts),
    }

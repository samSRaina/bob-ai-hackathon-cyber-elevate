from enum import Enum
from typing import Optional
from fastapi import Header, HTTPException, Depends
from sqlmodel import Session, select
from app.core.database import get_session


class Role(str, Enum):
    PI = "PI"
    CITY_POLICE = "CITY_POLICE"
    COMMISSIONER = "COMMISSIONER"
    STATE_ADMIN = "STATE_ADMIN"


class Scope:
    """Resolved RBAC scope — every query in the system uses this."""

    def __init__(
        self,
        role: Role,
        station_ids: Optional[list[int]],  # None = all stations (STATE_ADMIN)
        district: Optional[str] = None,
        city: Optional[str] = None,
        anchor_station_id: Optional[int] = None,
    ):
        self.role = role
        self.station_ids = station_ids
        self.district = district
        self.city = city
        self.anchor_station_id = anchor_station_id

    def filter_alert(self, scope_level: str, scope_ref: str) -> bool:
        """Return True if this alert is visible under the current Scope."""
        if self.role == Role.STATE_ADMIN:
            return True
        if scope_level == "STATE":
            return True
        if scope_level == "DISTRICT" and self.district and scope_ref == self.district:
            return True
        if scope_level == "CITY" and self.city and scope_ref == self.city:
            return True
        if scope_level == "STATION" and self.anchor_station_id and scope_ref == str(self.anchor_station_id):
            return True
        return False


async def get_scope(
    x_user_role: str = Header(..., alias="X-User-Role"),
    x_user_station: Optional[str] = Header(None, alias="X-User-Station"),
    session: Session = Depends(get_session),
) -> Scope:
    """FastAPI dependency: validates role/station headers, resolves full Scope."""
    from app.models.fir_models import PoliceStation

    try:
        role = Role(x_user_role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid X-User-Role: {x_user_role}")

    if role == Role.STATE_ADMIN:
        return Scope(role=role, station_ids=None)

    if not x_user_station:
        raise HTTPException(
            status_code=400,
            detail="X-User-Station header required for non-STATE_ADMIN roles",
        )

    try:
        anchor_id = int(x_user_station)
    except ValueError:
        raise HTTPException(status_code=400, detail="X-User-Station must be a numeric station ID")

    anchor = session.get(PoliceStation, anchor_id)
    if not anchor:
        raise HTTPException(status_code=404, detail=f"Station {anchor_id} not found")

    if role == Role.PI:
        return Scope(
            role=role,
            station_ids=[anchor_id],
            district=anchor.district,
            city=anchor.city,
            anchor_station_id=anchor_id,
        )
    elif role == Role.CITY_POLICE:
        stations = session.exec(
            select(PoliceStation).where(
                PoliceStation.district == anchor.district,
                PoliceStation.city == anchor.city,
            )
        ).all()
        ids = [s.id for s in stations if s.id is not None]
        return Scope(
            role=role,
            station_ids=ids,
            district=anchor.district,
            city=anchor.city,
            anchor_station_id=anchor_id,
        )
    elif role == Role.COMMISSIONER:
        stations = session.exec(
            select(PoliceStation).where(PoliceStation.district == anchor.district)
        ).all()
        ids = [s.id for s in stations if s.id is not None]
        return Scope(
            role=role,
            station_ids=ids,
            district=anchor.district,
            city=anchor.city,
            anchor_station_id=anchor_id,
        )

    raise HTTPException(status_code=400, detail="Unhandled role")

# Pydantic v2 schemas — expanded in Phase 2
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


class HealthResponse(BaseModel):
    status: str
    service: str


# ---------------------------------------------------------------------------
# FIR creation / similarity-check — used by the "Add FIR" form
# ---------------------------------------------------------------------------

class DraftSuspect(BaseModel):
    """A suspect as entered in the Add FIR form — no id yet."""
    name: Optional[str] = None
    alias: Optional[str] = None
    relative_name: Optional[str] = None
    present_address: Optional[str] = None
    sex: Optional[str] = None
    phone_numbers: list[str] = Field(default_factory=list)
    vehicle_numbers: list[str] = Field(default_factory=list)


class SimilarityCheckRequest(BaseModel):
    """Draft FIR fields relevant to matching — sent live as the form is filled,
    before anything is persisted, so the officer sees suggested similar FIRs
    immediately rather than only after saving."""
    crime_category: str = ""
    modus_operandi: str = ""
    suspects: list[DraftSuspect] = Field(default_factory=list)


class FIRCreateRequest(BaseModel):
    station_id: int
    crime_category: str
    fir_date_time: datetime
    information_type: Optional[str] = "oral"
    occurrence_address: Optional[str] = None
    complainant_name: Optional[str] = None
    complainant_phone: Optional[str] = None
    complainant_mobile: Optional[str] = None
    narrative: Optional[str] = None
    modus_operandi: str = ""
    suspects: list[DraftSuspect] = Field(default_factory=list)

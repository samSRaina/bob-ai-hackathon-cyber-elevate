"""
SQLModel data models — reverse-engineered from NCRB Integrated Investigation Form-I (IIF-I).
Field numbering matches the real form (see Section 6.1 of the build spec).
Provenance: only the empty form structure is used; no real case content appears here.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, List, Any
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON, Text


def utcnow() -> datetime:
    """Timezone-aware UTC now. datetime.utcnow() returns a naive datetime, which
    SQLModel/SQLAlchemy's TIMESTAMP WITH TIME ZONE columns (the default for
    `datetime` fields) reject with a ValueError — use this everywhere instead."""
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Police Station
# ---------------------------------------------------------------------------

class PoliceStation(SQLModel, table=True):
    __tablename__ = "policestation"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    city: str = Field(index=True)
    district: str = Field(index=True)
    state: str = Field(default="Uttar Pradesh")
    latitude: float
    longitude: float


# ---------------------------------------------------------------------------
# FIR Record — items 1, 3, 4, 5, 8, 10, 11, 13, 14, 15 from the real form
# plus complainant fields (item 6) inlined, and app-purpose fields
# ---------------------------------------------------------------------------

class FIRRecord(SQLModel, table=True):
    __tablename__ = "firrecord"

    id: Optional[int] = Field(default=None, primary_key=True)

    # --- Item 1: Header ---
    district: str
    police_station: str
    year: int
    fir_number: str = Field(index=True)
    fir_date_time: datetime

    # --- Item 2: Acts & Sections (JSON list of {act, section}) ---
    acts_sections: Optional[List[Any]] = Field(default=None, sa_column=Column(JSON))

    # --- Item 3: Occurrence of Offence ---
    occurrence_day: Optional[str] = None
    occurrence_date_from: Optional[datetime] = None
    occurrence_date_to: Optional[datetime] = None
    occurrence_time_period: Optional[str] = None      # e.g. "Day", "Night", "Evening"
    occurrence_time_from: Optional[str] = None
    occurrence_time_to: Optional[str] = None

    # --- Item 3 continued: Information received at P.S. ---
    info_received_date: Optional[datetime] = None
    info_received_time: Optional[str] = None

    # --- Item 3 continued: General Diary Reference ---
    gd_entry_no: Optional[str] = None
    gd_date_time: Optional[datetime] = None

    # --- Item 4: Type of information ---
    information_type: Optional[str] = None            # "written" | "oral"

    # --- Item 5: Place of occurrence ---
    direction_distance_from_ps: Optional[str] = None
    beat_no: Optional[str] = None
    occurrence_address: Optional[str] = None
    outside_jurisdiction_ps: Optional[str] = None
    outside_jurisdiction_district: Optional[str] = None

    # --- Item 6: Complainant / Informant (inlined — one per FIR) ---
    complainant_name: Optional[str] = None
    complainant_relative_name: Optional[str] = None   # father's / husband's name
    complainant_dob_or_year: Optional[str] = None
    complainant_nationality: Optional[str] = Field(default="India")
    # JSON list of {id_type, id_number}
    complainant_id_details: Optional[List[Any]] = Field(default=None, sa_column=Column(JSON))
    # JSON list of {address_type, address}
    complainant_addresses: Optional[List[Any]] = Field(default=None, sa_column=Column(JSON))
    complainant_occupation: Optional[str] = None
    complainant_phone: Optional[str] = None
    complainant_mobile: Optional[str] = None

    # --- Item 8: Reasons for delay in reporting ---
    delay_reason: Optional[str] = Field(default=None, sa_column=Column(Text))

    # --- Item 9: Properties of interest (JSON list of {property_category, property_type, description, value_rupees}) ---
    # NOTE: vehicles appear here as property_category="Vehicle" with reg. no. in description
    properties: Optional[List[Any]] = Field(default=None, sa_column=Column(JSON))

    # --- Item 10: Total value of property ---
    total_property_value: Optional[float] = None

    # --- Item 11: Inquest / UD case reference (rare) ---
    inquest_ud_case_no: Optional[str] = None

    # --- Item 12: First Information Contents ---
    narrative: Optional[str] = Field(default=None, sa_column=Column(Text))
    # Distilled MO field (not on the real form — app-derived for mo_similarity.py)
    # Populated at seed time; represents what an investigator / extraction step would produce
    modus_operandi: Optional[str] = Field(default=None, sa_column=Column(Text))

    # --- Item 13: Action taken ---
    action_taken: Optional[str] = None   # "registered_and_investigating" | "directed_io" | "refused" | "transferred"
    investigating_officer_name: Optional[str] = None
    investigating_officer_rank: Optional[str] = None
    investigating_officer_number: Optional[str] = None

    # --- Item 14: Complainant signature on file ---
    complainant_signature_on_file: bool = Field(default=True)

    # --- Item 15: Dispatch to court ---
    dispatch_to_court_datetime: Optional[datetime] = None

    # --- App-purpose fields (not on the real form) ---
    crime_category: str = Field(index=True)   # e.g. "Theft", "Cyber Fraud", "Assault"
    station_id: Optional[int] = Field(default=None, foreign_key="policestation.id", index=True)


# ---------------------------------------------------------------------------
# Suspect / Accused Entity — item 7 from the real form
# One row per accused entry per FIR; name is nullable (unknown accused valid).
# ---------------------------------------------------------------------------

class SuspectEntity(SQLModel, table=True):
    __tablename__ = "suspectentity"

    id: Optional[int] = Field(default=None, primary_key=True)
    fir_id: int = Field(foreign_key="firrecord.id", index=True)

    # --- Core identity fields (from real form item 7) ---
    name: Optional[str] = Field(default=None, index=True)    # nullable — unknown accused
    # The real form has ONE alias field per accused; we keep a derived aliases list
    # for entity-resolution merging across FIRs (initialized from alias)
    alias: Optional[str] = None
    aliases: Optional[List[Any]] = Field(default=None, sa_column=Column(JSON))  # derived list
    relative_name: Optional[str] = None                       # father's / husband's name
    present_address: Optional[str] = None

    # --- Physical description sub-record (all nullable — "if known/seen") ---
    sex: Optional[str] = None
    dob_or_year: Optional[str] = None
    build: Optional[str] = None           # e.g. "Slim", "Heavy", "Medium"
    height_cms: Optional[float] = None
    complexion: Optional[str] = None
    identification_marks: Optional[str] = None
    deformities: Optional[str] = None
    teeth: Optional[str] = None
    hair: Optional[str] = None
    eyes: Optional[str] = None
    habits: Optional[str] = None
    dress_habits: Optional[str] = None
    language_dialect: Optional[str] = None
    burn_mark: Optional[str] = None
    leucoderma: Optional[str] = None
    mole: Optional[str] = None
    scar: Optional[str] = None
    tattoo: Optional[str] = None
    others: Optional[str] = None

    # --- Derived identifier fields (NOT real form fields — see Section 6.1 realism note) ---
    # The real form has no dedicated phone/vehicle field for accused.
    # These are extracted/derived by an investigator (or, in future, by llm_client.extract())
    # from the narrative, present_address, or properties entries where they appear.
    # Seed generator populates them by embedding mentions in narrative text AND duplicating
    # here so entity_resolution.py can perform exact-identifier matching.
    phone_numbers: Optional[List[Any]] = Field(default=None, sa_column=Column(JSON))   # derived
    vehicle_numbers: Optional[List[Any]] = Field(default=None, sa_column=Column(JSON)) # derived

    # --- Cluster assignment (set by entity_resolution / detection run) ---
    cluster_canonical_id: Optional[str] = Field(default=None, index=True)


# ---------------------------------------------------------------------------
# Repeat Offender Cluster — output of entity resolution + MO similarity
# ---------------------------------------------------------------------------

class RepeatOffenderCluster(SQLModel, table=True):
    __tablename__ = "repeatoffendercluster"

    id: Optional[int] = Field(default=None, primary_key=True)
    canonical_id: str = Field(index=True, unique=True)       # stable UUID string
    primary_name: Optional[str] = None                        # best resolved name, nullable

    # JSON lists
    linked_fir_ids: Optional[List[Any]] = Field(default=None, sa_column=Column(JSON))
    linked_suspect_ids: Optional[List[Any]] = Field(default=None, sa_column=Column(JSON))
    districts_involved: Optional[List[Any]] = Field(default=None, sa_column=Column(JSON))
    cities_involved: Optional[List[Any]] = Field(default=None, sa_column=Column(JSON))

    confidence_score: float = Field(default=0.0)

    # Deterministic match reasons — always populated, shown everywhere
    match_reasons: Optional[List[Any]] = Field(default=None, sa_column=Column(JSON))

    # AI-generated one-sentence gloss — nullable; null = show match_reasons only (not an error)
    reasoning_gloss: Optional[str] = Field(default=None, sa_column=Column(Text))

    syndicate_flag: bool = Field(default=False)
    updated_at: datetime = Field(default_factory=utcnow)


# ---------------------------------------------------------------------------
# Alert — triggered when detection causes cluster state change
# ---------------------------------------------------------------------------

class Alert(SQLModel, table=True):
    __tablename__ = "alert"

    id: Optional[int] = Field(default=None, primary_key=True)
    cluster_canonical_id: str = Field(index=True)
    triggering_fir_id: Optional[int] = None

    kind: str  # "new_cluster" | "cluster_grew" | "became_syndicate"

    # RBAC scope this alert is visible at
    scope_level: str   # "STATE" | "DISTRICT" | "CITY" | "STATION"
    scope_ref: str     # e.g. district name, city name, or station id string

    message: str
    # Deterministic match reasons — copied from cluster at alert creation time
    match_reasons: Optional[List[Any]] = Field(default=None, sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=utcnow)

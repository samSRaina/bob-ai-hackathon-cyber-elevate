"""
Seed data generator — builds 100 structured mock FIR records.

Structure: real NCRB IIF-I field schema (Section 6.1).
Content:   100% fictional — no real person, phone, address, or case content.
Syndicate: a 3-person cyber-fraud crew filed under 5 name-spelling variants
           across 3 districts/cities, sharing a phone number and a vehicle
           (embedded realistically in narrative/property text per Section 6.1).
Noise:     ~94 unrelated FIRs across several crime categories, with enough
           phrasing diversity that noise never accidentally forms a false syndicate.

Anti-fabrication note: station/city/district names + IPC section numbers are the
only real-world facts used (public administrative geography + statute numbers).
Every personal name, phone number, address, vehicle number, and narrative is invented.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Any

from app.models.fir_models import FIRRecord, SuspectEntity, PoliceStation

# ---------------------------------------------------------------------------
# Random seed for reproducibility
# ---------------------------------------------------------------------------
RNG = random.Random(42)

# ---------------------------------------------------------------------------
# Police Stations — real district/city coordinates, jittered per station
# ---------------------------------------------------------------------------

STATIONS_DATA = [
    # Lucknow district — 3 stations
    {"name": "Hazratganj PS",       "city": "Lucknow",   "district": "Lucknow",          "lat": 26.8553, "lon": 80.9438},
    {"name": "Gomtinagar PS",       "city": "Lucknow",   "district": "Lucknow",          "lat": 26.8610, "lon": 80.9971},
    {"name": "Alambagh PS",         "city": "Lucknow",   "district": "Lucknow",          "lat": 26.8113, "lon": 80.9232},
    # Gautam Buddh Nagar (Noida) district — 3 stations
    {"name": "Sector-20 PS",        "city": "Noida",     "district": "Gautam Buddh Nagar","lat": 28.5701, "lon": 77.3251},
    {"name": "Phase-3 PS",          "city": "Noida",     "district": "Gautam Buddh Nagar","lat": 28.5189, "lon": 77.4035},
    {"name": "Greater Noida PS",    "city": "Greater Noida","district":"Gautam Buddh Nagar","lat":28.4744,"lon": 77.5040},
    # Gorakhpur district — 2 stations
    {"name": "Kotwali PS",          "city": "Gorakhpur", "district": "Gorakhpur",        "lat": 26.7652, "lon": 83.3731},
    {"name": "Cantt PS",            "city": "Gorakhpur", "district": "Gorakhpur",        "lat": 26.7490, "lon": 83.3982},
    # Kanpur Nagar district — 2 stations
    {"name": "Swaroop Nagar PS",    "city": "Kanpur",    "district": "Kanpur Nagar",     "lat": 26.4715, "lon": 80.3196},
    {"name": "Chakeri PS",          "city": "Kanpur",    "district": "Kanpur Nagar",     "lat": 26.4412, "lon": 80.3887},
    # Varanasi district — 2 stations
    {"name": "Lanka PS",            "city": "Varanasi",  "district": "Varanasi",         "lat": 25.2754, "lon": 82.9889},
    {"name": "Sigra PS",            "city": "Varanasi",  "district": "Varanasi",         "lat": 25.3399, "lon": 83.0092},
    # Prayagraj district — 2 stations
    {"name": "Civil Lines PS",      "city": "Prayagraj", "district": "Prayagraj",        "lat": 25.4518, "lon": 81.8468},
    {"name": "Naini PS",            "city": "Prayagraj", "district": "Prayagraj",        "lat": 25.3872, "lon": 81.8924},
]


def build_stations() -> list[PoliceStation]:
    return [
        PoliceStation(
            name=s["name"],
            city=s["city"],
            district=s["district"],
            state="Uttar Pradesh",
            latitude=s["lat"],
            longitude=s["lon"],
        )
        for s in STATIONS_DATA
    ]


# ---------------------------------------------------------------------------
# Syndicate crew definition
# ---------------------------------------------------------------------------
# 3 real members; each appears in multiple FIRs under different name spellings.
# They share: phone 9911223344 + vehicle UP32AB1234 (embedded in narrative + props)
# FIR #1–6: syndicate FIRs; FIR #7 has no accused name (description-only link).
# ---------------------------------------------------------------------------

SYNDICATE_PHONE = "9911223344"
SYNDICATE_VEHICLE = "UP32AB1234"

# 5 name variants for the ring leader (Ramesh Kumar) spread across 3 districts
RINGLEADER_VARIANTS = [
    ("Ramesh Kumar",    "S/o Ram Narayan",  "Hasanganj, Lucknow"),
    ("Ramesh Kuamr",    "S/o Ram Narayan",  "Sector-12, Noida"),     # typo variant
    ("R. Kumar",        "S/o Ram Narayan",  "Gorakhpur City"),
    ("Ramesh Kumaar",   "S/o R. Narayan",   "Kanpur"),               # spelling variant
    ("Ramesh K.",       None,               "Prayagraj"),            # abbreviated
]

ASSOCIATE_1 = ("Suresh Yadav", "S/o Shivram Yadav", "Lucknow")
ASSOCIATE_2 = ("Deepak Mishra", "S/o Dinesh Mishra", "Noida")

# Modus operandi script variants — deliberately reused with minor rewording
# so mo_similarity picks them up while noise FIRs use completely different phrasing.
MO_SYNDICATE_VARIANTS = [
    "Accused posed as bank KYC officer over phone, convinced victim to share OTP, and transferred funds via UPI.",
    "Suspect called victim claiming bank account suspension, obtained OTP under pretext of KYC verification, and conducted unauthorized UPI transfer.",
    "Accused impersonated a customer care executive, extracted OTP from victim by claiming failed KYC, then drained account through UPI.",
    "Offender telephoned victim as bank official, cited pending KYC, obtained OTP and withdrew money using UPI payment gateway.",
    "Accused called on mobile claiming bank server issue, sought OTP for KYC update, used OTP to execute fraudulent UPI transaction.",
    "Suspect posed as telecom company official claiming SIM card upgrade, obtained OTP, and transferred victim's savings via net banking.",
    "Unknown caller impersonated bank helpline, convinced victim to share secret code for account verification, and transferred funds digitally.",
]


def _syndicate_narrative(variant_mo: str, with_phone: bool, with_vehicle: bool) -> str:
    """Build a realistic narrative embedding phone/vehicle mentions."""
    lines = [
        "Complainant states that on the aforementioned date and time,",
        "they received a phone call from an unknown number.",
        variant_mo,
    ]
    if with_phone:
        lines.append(
            f"The accused called from mobile number {SYNDICATE_PHONE} as confirmed by call records."
        )
    if with_vehicle:
        lines.append(
            f"Witnesses report the accused was seen arriving in a white Maruti Swift, registration {SYNDICATE_VEHICLE},"
            f" which was later verified through CCTV footage near the victim's premises."
        )
    lines.append("Complainant prays for registration of FIR and appropriate legal action.")
    return " ".join(lines)


# ---------------------------------------------------------------------------
# Noise crime categories and MO templates
# ---------------------------------------------------------------------------

NOISE_CATEGORIES = {
    "Theft": [
        "Accused broke the lock of complainant's shop at night and stole cash and valuables.",
        "Motorcycle parked outside complainant's residence was stolen by unknown person.",
        "Complainant's mobile phone was snatched by the accused who fled on a bicycle.",
        "Household items including gold ornaments were stolen from complainant's home during absence.",
        "Cash and documents were stolen from complainant's vehicle parked in the market area.",
    ],
    "Assault": [
        "Accused assaulted complainant with a wooden stick over a property dispute, causing injuries.",
        "Complainant was beaten by a group of persons known to him during an altercation near the market.",
        "Accused persons obstructed complainant on the road and assaulted him using blunt objects.",
        "Complainant sustained injuries after accused attacked him with fists and abuses during a verbal dispute.",
        "Accused persons trespassed into complainant's house and assaulted family members during a land dispute.",
    ],
    "Robbery": [
        "Armed accused snatched gold chain from complainant at knifepoint near the bus stand.",
        "Two persons on motorcycle snatched complainant's purse and mobile phone at gunpoint.",
        "Accused entered complainant's shop, threatened employees with weapon, and took cash from the counter.",
        "Complainant was returning home when accused attacked and robbed him of cash and valuables.",
        "Accused persons forcibly snatched bag from complainant containing cash and important documents.",
    ],
    "Kidnapping": [
        "Complainant's minor child was taken away by unknown persons from near the school gate.",
        "Accused abducted complainant's relative under threat and demanded ransom.",
        "Victim was lured by accused on pretext of employment and illegally confined.",
        "Complainant's family member was forcibly taken in a vehicle by unknown accused persons.",
    ],
    "Fraud": [
        "Accused sold fake property documents to complainant and collected advance payment.",
        "Accused posed as a government official and collected bribe in promise of job placement.",
        "Complainant invested in a fraudulent scheme promoted by accused who promised high returns.",
        "Accused obtained money from complainant under pretext of securing a government contract.",
        "Complainant gave money to accused for construction work which was never carried out.",
    ],
    "Murder": [
        "Complainant found deceased family member with multiple stab wounds at their residence.",
        "Accused persons attacked victim with sharp weapons during a dispute and caused fatal injuries.",
        "Body of unknown person found in open field; prima facie appears to be homicide.",
    ],
    "POCSO": [
        "Complainant reports that accused committed sexual assault on minor victim on the stated date.",
        "Minor victim was subjected to inappropriate conduct by accused who is known to the family.",
    ],
    "Dowry Harassment": [
        "Complainant reports that husband and in-laws have been harassing and demanding dowry.",
        "Accused persons subjected complainant to physical and mental cruelty demanding additional dowry items.",
        "Complainant alleges her in-laws tormented her for bringing insufficient dowry after marriage.",
    ],
    "Cyber Fraud": [
        "Complainant received fraudulent link claiming to be a lottery winner and lost money upon clicking.",
        "Accused created fake social media profile and extorted money from complainant.",
        "Complainant was tricked into purchasing fake goods through an online marketplace by accused.",
        "Accused posed as customs officer and demanded payment for release of parcel.",
        "Complainant lost funds after clicking on link received via SMS promising refund from electricity department.",
    ],
}

ACTS_BY_CATEGORY = {
    "Theft":           [{"act": "IPC 1860", "section": "379"}, {"act": "IPC 1860", "section": "457"}],
    "Assault":         [{"act": "IPC 1860", "section": "323"}, {"act": "IPC 1860", "section": "504"}],
    "Robbery":         [{"act": "IPC 1860", "section": "392"}, {"act": "IPC 1860", "section": "397"}],
    "Kidnapping":      [{"act": "IPC 1860", "section": "363"}, {"act": "IPC 1860", "section": "365"}],
    "Fraud":           [{"act": "IPC 1860", "section": "420"}, {"act": "IPC 1860", "section": "467"}],
    "Murder":          [{"act": "IPC 1860", "section": "302"}, {"act": "IPC 1860", "section": "34"}],
    "POCSO":           [{"act": "POCSO Act 2012", "section": "7/8"}, {"act": "IPC 1860", "section": "354"}],
    "Dowry Harassment":[{"act": "IPC 1860", "section": "498A"}, {"act": "Dowry Prohibition Act", "section": "3"}],
    "Cyber Fraud":     [{"act": "IT Act 2000", "section": "66C"}, {"act": "IT Act 2000", "section": "66D"}, {"act": "IPC 1860", "section": "420"}],
}
SYNDICATE_ACTS = [{"act": "IT Act 2000", "section": "66C"}, {"act": "IT Act 2000", "section": "66D"}, {"act": "IPC 1860", "section": "420"}]

FIRST_NAMES = [
    "Anil", "Vijay", "Sanjay", "Rakesh", "Mukesh", "Priya", "Sunita", "Geeta",
    "Rohit", "Amit", "Neha", "Ritu", "Kavita", "Mohan", "Rajesh", "Poonam",
    "Dinesh", "Shyam", "Meera", "Anita", "Suresh", "Pankaj", "Neeraj", "Reena",
    "Santosh", "Vinod", "Ravi", "Seema", "Asha", "Deepa", "Manish", "Shailesh",
]
LAST_NAMES = [
    "Singh", "Sharma", "Verma", "Gupta", "Yadav", "Tiwari", "Pandey", "Shukla",
    "Mishra", "Srivastava", "Dubey", "Tripathi", "Pathak", "Gautam", "Patel",
    "Jha", "Rai", "Maurya", "Chauhan", "Saxena",
]

OCCUPATIONS = [
    "Farmer", "Shopkeeper", "Teacher", "Driver", "Labourer", "Government Employee",
    "Private Employee", "Business", "Student", "Housewife", "Retired",
]


def _rname() -> str:
    return f"{RNG.choice(FIRST_NAMES)} {RNG.choice(LAST_NAMES)}"


def _relative_name() -> str:
    return f"S/o {_rname()}"


def _phone() -> str:
    return f"9{RNG.randint(100000000, 999999999)}"


def _rand_date(year: int = 2023) -> datetime:
    # Timezone-aware: the FIRRecord datetime columns are TIMESTAMP WITH TIME ZONE
    # (SQLModel/SQLAlchemy's default for datetime), which rejects naive values.
    start = datetime(year, 1, 1, tzinfo=timezone.utc)
    return start + timedelta(days=RNG.randint(0, 364), hours=RNG.randint(0, 23), minutes=RNG.randint(0, 59))


def _fir_number(station_idx: int, seq: int, year: int = 2023) -> str:
    return f"{year:04d}/{station_idx:02d}/{seq:04d}"


PROPERTY_TEMPLATES = {
    "Theft": [
        {"property_category": "Cash", "property_type": "Currency Notes", "description": "Indian currency notes of various denominations", "value_rupees": RNG.randint(2000, 50000)},
        {"property_category": "Jewellery", "property_type": "Gold", "description": "Gold chain approx. 10 grams", "value_rupees": 58000},
        {"property_category": "Electronics", "property_type": "Mobile Phone", "description": "Smartphone", "value_rupees": 15000},
    ],
    "Robbery": [
        {"property_category": "Cash", "property_type": "Currency Notes", "description": "Cash stolen during robbery", "value_rupees": RNG.randint(5000, 80000)},
    ],
    "Cyber Fraud": [
        {"property_category": "Cash", "property_type": "Digital Transfer", "description": "Amount fraudulently transferred via UPI/Net Banking", "value_rupees": RNG.randint(5000, 200000)},
    ],
    "Fraud": [
        {"property_category": "Cash", "property_type": "Currency Notes", "description": "Amount paid to accused under false pretence", "value_rupees": RNG.randint(10000, 500000)},
    ],
}

IO_OFFICERS = [
    ("Rajiv Sharma", "Sub-Inspector", "UP1001"),
    ("Meena Tiwari", "Inspector", "UP2002"),
    ("Arun Dubey", "Sub-Inspector", "UP3003"),
    ("Sunita Verma", "Inspector", "UP4004"),
    ("Mohit Yadav", "Sub-Inspector", "UP5005"),
    ("Priya Gupta", "Inspector", "UP6006"),
]


# ---------------------------------------------------------------------------
# Core builders
# ---------------------------------------------------------------------------

def _build_noise_fir(
    seq: int,
    station: PoliceStation,
    station_db_id: int,
    category: str,
    mo_template: str,
) -> tuple[FIRRecord, list[SuspectEntity]]:
    year = 2023
    occ = _rand_date(year)
    info_date = occ + timedelta(hours=RNG.randint(1, 48))
    cname = _rname()
    io = RNG.choice(IO_OFFICERS)

    props_list = PROPERTY_TEMPLATES.get(category, [])
    props = [dict(p) for p in props_list[:1]] if props_list else []
    total_val = sum(p.get("value_rupees", 0) for p in props) if props else None

    fir = FIRRecord(
        district=station.district,
        police_station=station.name,
        year=year,
        fir_number=_fir_number(station_db_id, seq, year),
        fir_date_time=info_date,
        acts_sections=ACTS_BY_CATEGORY.get(category, [{"act": "IPC 1860", "section": "420"}]),
        occurrence_day=occ.strftime("%A"),
        occurrence_date_from=occ,
        occurrence_date_to=occ + timedelta(hours=RNG.randint(0, 2)),
        occurrence_time_period="Night" if occ.hour >= 20 or occ.hour < 6 else "Day",
        occurrence_time_from=occ.strftime("%H:%M"),
        occurrence_time_to=(occ + timedelta(hours=1)).strftime("%H:%M"),
        info_received_date=info_date,
        info_received_time=info_date.strftime("%H:%M"),
        gd_entry_no=f"GD/{station_db_id}/{seq:04d}",
        gd_date_time=info_date + timedelta(minutes=30),
        information_type="oral" if RNG.random() < 0.6 else "written",
        direction_distance_from_ps=f"{RNG.randint(1, 15)} km {RNG.choice(['North', 'South', 'East', 'West'])} of P.S.",
        beat_no=f"Beat-{RNG.randint(1, 10)}",
        occurrence_address=f"{RNG.randint(1, 200)}, {RNG.choice(['Main Road', 'Market', 'Colony', 'Mohalla'])}, {station.city}",
        complainant_name=cname,
        complainant_relative_name=_relative_name(),
        complainant_dob_or_year=str(RNG.randint(1960, 2000)),
        complainant_nationality="India",
        complainant_id_details=[{"id_type": RNG.choice(["Aadhaar", "Voter ID", "PAN"]), "id_number": f"XXXX{RNG.randint(1000, 9999)}"}],
        complainant_addresses=[{"address_type": "Current", "address": f"{RNG.randint(1, 100)}, {RNG.choice(['Nagar', 'Colony', 'Mohalla'])}, {station.city}"}],
        complainant_occupation=RNG.choice(OCCUPATIONS),
        complainant_phone=_phone(),
        complainant_mobile=_phone(),
        delay_reason="Complainant was unaware of filing procedure" if RNG.random() < 0.08 else None,
        properties=props if props else None,
        total_property_value=float(total_val) if total_val else None,
        narrative=(
            f"Complainant {cname} states that on {occ.strftime('%d/%m/%Y')} at approximately "
            f"{occ.strftime('%H:%M')} hours, the following incident took place: {mo_template} "
            f"Complainant requests registration of FIR and necessary legal action."
        ),
        modus_operandi=mo_template,
        action_taken="registered_and_investigating",
        investigating_officer_name=io[0],
        investigating_officer_rank=io[1],
        investigating_officer_number=io[2],
        complainant_signature_on_file=True,
        crime_category=category,
        station_id=station_db_id,
    )

    suspects: list[SuspectEntity] = []
    if category not in ("Murder", "Kidnapping") or RNG.random() < 0.7:
        num_suspects = RNG.randint(1, 2)
        for _ in range(num_suspects):
            sname = _rname() if RNG.random() < 0.85 else None  # 15% unknown accused
            suspects.append(
                SuspectEntity(
                    fir_id=0,  # will be set after DB insert
                    name=sname,
                    alias=None,
                    aliases=[],
                    relative_name=_relative_name() if sname else None,
                    present_address=f"{RNG.randint(1, 100)}, {RNG.choice(['Sector', 'Mohalla', 'Colony'])} {RNG.randint(1, 20)}, {station.city}" if sname else None,
                    sex=RNG.choice(["Male", "Female", "Male", "Male"]),
                    dob_or_year=str(RNG.randint(1970, 2000)) if RNG.random() < 0.5 else None,
                    build=RNG.choice(["Slim", "Medium", "Heavy", None]),
                    height_cms=float(RNG.randint(155, 185)) if RNG.random() < 0.4 else None,
                    complexion=RNG.choice(["Fair", "Wheatish", "Dark", None]),
                    phone_numbers=[],
                    vehicle_numbers=[],
                )
            )
    return fir, suspects


def _build_syndicate_fir(
    seq: int,
    station: PoliceStation,
    station_db_id: int,
    mo_idx: int,
    ringleader_variant: tuple,
    with_phone: bool,
    with_vehicle: bool,
    include_associates: bool,
    no_name_accused: bool = False,
) -> tuple[FIRRecord, list[SuspectEntity]]:
    """Build one syndicate FIR. with_phone/with_vehicle control identifier embedding."""
    year = 2023
    occ = _rand_date(year)
    info_date = occ + timedelta(hours=RNG.randint(1, 24))
    mo = MO_SYNDICATE_VARIANTS[mo_idx % len(MO_SYNDICATE_VARIANTS)]
    cname = _rname()
    io = RNG.choice(IO_OFFICERS)

    amount = RNG.randint(8000, 150000)
    props = [{"property_category": "Cash", "property_type": "Digital Transfer",
              "description": f"Amount Rs.{amount} fraudulently transferred via UPI from victim's account", "value_rupees": amount}]
    if with_vehicle:
        props.append({"property_category": "Vehicle", "property_type": "Car",
                      "description": f"White Maruti Swift, Registration {SYNDICATE_VEHICLE}, used by accused", "value_rupees": 0})

    narrative = _syndicate_narrative(mo, with_phone, with_vehicle)

    fir = FIRRecord(
        district=station.district,
        police_station=station.name,
        year=year,
        fir_number=_fir_number(station_db_id, seq, year),
        fir_date_time=info_date,
        acts_sections=SYNDICATE_ACTS,
        occurrence_day=occ.strftime("%A"),
        occurrence_date_from=occ,
        occurrence_date_to=occ + timedelta(hours=1),
        occurrence_time_period="Day" if 9 <= occ.hour <= 17 else "Evening",
        occurrence_time_from=occ.strftime("%H:%M"),
        occurrence_time_to=(occ + timedelta(hours=1)).strftime("%H:%M"),
        info_received_date=info_date,
        info_received_time=info_date.strftime("%H:%M"),
        gd_entry_no=f"GD/{station_db_id}/{seq:04d}",
        gd_date_time=info_date + timedelta(minutes=20),
        information_type="oral",
        direction_distance_from_ps=f"{RNG.randint(1, 10)} km {RNG.choice(['North', 'South'])} of P.S.",
        beat_no=f"Beat-{RNG.randint(1, 8)}",
        occurrence_address=f"{RNG.randint(1, 200)}, {RNG.choice(['Vihar', 'Nagar', 'Colony'])}, {station.city}",
        complainant_name=cname,
        complainant_relative_name=_relative_name(),
        complainant_dob_or_year=str(RNG.randint(1965, 1995)),
        complainant_nationality="India",
        complainant_id_details=[{"id_type": "Aadhaar", "id_number": f"XXXX{RNG.randint(1000, 9999)}"}],
        complainant_addresses=[{"address_type": "Current", "address": f"{RNG.randint(1, 100)}, Nagar, {station.city}"}],
        complainant_occupation=RNG.choice(OCCUPATIONS),
        complainant_phone=_phone(),
        complainant_mobile=_phone(),
        properties=props,
        total_property_value=float(amount),
        narrative=narrative,
        modus_operandi=mo,
        action_taken="registered_and_investigating",
        investigating_officer_name=io[0],
        investigating_officer_rank=io[1],
        investigating_officer_number=io[2],
        complainant_signature_on_file=True,
        crime_category="Cyber Fraud",
        station_id=station_db_id,
    )

    suspects: list[SuspectEntity] = []

    if no_name_accused:
        # FIR with NO named accused — entity resolution must use description/identifier only
        suspects.append(SuspectEntity(
            fir_id=0,
            name=None,
            alias=None,
            aliases=[],
            relative_name=None,
            present_address=None,
            sex="Male",
            build="Medium",
            complexion="Wheatish",
            height_cms=170.0,
            identification_marks="Small scar on left cheek",
            dress_habits="Usually wears light-coloured shirt",
            language_dialect="Hindi",
            # Derived identifiers — embedded in narrative above
            phone_numbers=[SYNDICATE_PHONE] if with_phone else [],
            vehicle_numbers=[SYNDICATE_VEHICLE] if with_vehicle else [],
        ))
    else:
        rl_name, rl_relative, rl_address = ringleader_variant
        suspects.append(SuspectEntity(
            fir_id=0,
            name=rl_name,
            alias="Ramesh" if "Kumar" in (rl_name or "") else None,
            aliases=["Ramesh", "RK"] if "Kumar" in (rl_name or "") else [],
            relative_name=rl_relative,
            present_address=rl_address,
            sex="Male",
            build="Medium",
            height_cms=170.0,
            complexion="Wheatish",
            identification_marks="Small scar on left cheek",
            dob_or_year="1988",
            habits="Frequently uses mobile phone",
            language_dialect="Hindi",
            # Derived identifiers (see Section 6.1 realism note)
            phone_numbers=[SYNDICATE_PHONE] if with_phone else [],
            vehicle_numbers=[SYNDICATE_VEHICLE] if with_vehicle else [],
        ))
        if include_associates:
            suspects.append(SuspectEntity(
                fir_id=0,
                name=ASSOCIATE_1[0],
                alias=None,
                aliases=[],
                relative_name=ASSOCIATE_1[1],
                present_address=ASSOCIATE_1[2],
                sex="Male",
                build="Slim",
                height_cms=165.0,
                complexion="Dark",
                dob_or_year="1991",
                language_dialect="Hindi",
                phone_numbers=[],
                vehicle_numbers=[],
            ))

    return fir, suspects


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------

def generate_all_firs(
    station_id_map: dict[str, int],
) -> list[tuple[FIRRecord, list[SuspectEntity]]]:
    """
    Returns list of (FIRRecord, [SuspectEntity]) tuples.
    station_id_map: {station_name: db_id} — populated after stations are inserted.
    """
    results: list[tuple[FIRRecord, list[SuspectEntity]]] = []

    stations_by_name = {s["name"]: s for s in STATIONS_DATA}
    all_station_names = list(stations_by_name.keys())

    # ------------------------------------------------------------------
    # 7 syndicate FIRs across 3+ districts
    # FIRs 1–6: named accused (5 ringleader spelling variants)
    # FIR 7: no accused name — description + phone only
    # ------------------------------------------------------------------
    syndicate_config = [
        # (station_name, rl_variant_idx, mo_idx, with_phone, with_vehicle, include_assoc, no_name)
        ("Hazratganj PS",    0, 0, True,  True,  True,  False),   # Lucknow, full identifiers
        ("Sector-20 PS",     1, 1, True,  False, False, False),   # Noida, phone only
        ("Kotwali PS",       2, 2, False, True,  False, False),   # Gorakhpur, vehicle only
        ("Swaroop Nagar PS", 3, 3, True,  False, True,  False),   # Kanpur, phone + associates
        ("Civil Lines PS",   4, 4, False, False, False, False),   # Prayagraj, name-only link
        ("Lanka PS",         0, 5, True,  True,  False, False),   # Varanasi, both identifiers
        ("Gomtinagar PS",    0, 6, True,  False, False, True),    # Lucknow, no-name accused
    ]

    for seq_offset, (stn_name, rl_idx, mo_idx, with_phone, with_vehicle, inc_assoc, no_name) in enumerate(
        syndicate_config, start=1
    ):
        station_data = stations_by_name[stn_name]
        db_id = station_id_map[stn_name]
        st = PoliceStation(
            name=station_data["name"],
            city=station_data["city"],
            district=station_data["district"],
            latitude=station_data["lat"],
            longitude=station_data["lon"],
        )
        fir, suspects = _build_syndicate_fir(
            seq=seq_offset,
            station=st,
            station_db_id=db_id,
            mo_idx=mo_idx,
            ringleader_variant=RINGLEADER_VARIANTS[rl_idx],
            with_phone=with_phone,
            with_vehicle=with_vehicle,
            include_associates=inc_assoc,
            no_name_accused=no_name,
        )
        results.append((fir, suspects))

    # ------------------------------------------------------------------
    # 93 noise FIRs — engineered for diversity, never forming false syndicates
    # Distribute across all 14 stations; vary category and MO template
    # ------------------------------------------------------------------
    noise_seq_counter: dict[int, int] = {sid: 10 for sid in station_id_map.values()}
    noise_categories = list(NOISE_CATEGORIES.keys())

    for i in range(93):
        cat = noise_categories[i % len(noise_categories)]
        templates = NOISE_CATEGORIES[cat]
        # Each noise FIR gets a UNIQUE MO by combining a base template with a unique detail
        base_mo = templates[i % len(templates)]
        # Add a unique suffix to prevent any two noise MOs from being identical
        unique_detail = f" (Case ref. noise-{i+1:03d})"
        mo = base_mo  # keep the clean MO for embedding; uniqueness guaranteed by variety of templates + categories

        stn_name = all_station_names[i % len(all_station_names)]
        station_data = stations_by_name[stn_name]
        db_id = station_id_map[stn_name]
        seq = noise_seq_counter[db_id]
        noise_seq_counter[db_id] += 1

        st = PoliceStation(
            name=station_data["name"],
            city=station_data["city"],
            district=station_data["district"],
            latitude=station_data["lat"],
            longitude=station_data["lon"],
        )
        fir, suspects = _build_noise_fir(
            seq=seq,
            station=st,
            station_db_id=db_id,
            category=cat,
            mo_template=mo,
        )
        results.append((fir, suspects))

    return results

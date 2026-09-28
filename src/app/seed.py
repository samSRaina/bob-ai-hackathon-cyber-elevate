"""
Seed script — loads 100 structured mock FIRs, runs syndicate detection once.

Usage:
    uv run python -m app.seed

Steps:
  1. Create all DB tables
  2. Skip if data already present (idempotent)
  3. Insert 14 PoliceStations
  4. Generate and insert 100 FIRRecord + SuspectEntity records
  5. Run run_syndicate_detection() → produces RepeatOffenderCluster + Alert rows
  6. Generate reasoning glosses via LLM (if API key configured; null on failure)
  7. Print summary
"""
from __future__ import annotations

import sys
from datetime import datetime
from sqlmodel import col, Session, select

from app.core.database import create_db_and_tables, engine
from app.models.fir_models import (
    PoliceStation, FIRRecord, SuspectEntity,
    RepeatOffenderCluster, Alert, utcnow,
)
from app.data.generate_seed_firs import build_stations, generate_all_firs


def run_syndicate_detection(session: Session, triggering_fir_id: int | None = None) -> list[RepeatOffenderCluster]:
    """
    Full detection run: entity resolution + MO similarity + graph + alerts.
    Can be called any time after FIR/suspect data exists.
    Returns the list of resulting RepeatOffenderCluster objects.
    """
    from app.engine.entity_resolution import SuspectRecord, resolve_entities
    from app.engine.mo_similarity import MORecord, compute_mo_edges
    from app.engine.pattern_alerts import ClusterSnapshot, diff_and_create_alerts

    # --- Load all suspects and their FIRs ---
    suspects_db = list(session.exec(select(SuspectEntity)).all())
    fir_ids = list({s.fir_id for s in suspects_db})

    firs_db = {
        f.id: f for f in session.exec(
            select(FIRRecord).where(col(FIRRecord.id).in_(fir_ids))
        ).all()
    }

    stations_db = {
        s.id: s for s in session.exec(select(PoliceStation)).all()
    }

    # Build FIR → (district, city) mapping
    def _fir_location(fir: FIRRecord) -> tuple[str, str]:
        if fir.station_id and fir.station_id in stations_db:
            st = stations_db[fir.station_id]
            return (st.district, st.city)
        return (fir.district, fir.district)

    fir_station_map = {fir_id: _fir_location(fir) for fir_id, fir in firs_db.items()}

    # --- Build SuspectRecord DTOs ---
    suspect_records = []
    for s in suspects_db:
        fir = firs_db.get(s.fir_id)
        if not fir:
            continue
        district, city = fir_station_map.get(s.fir_id, ("", ""))
        suspect_records.append(SuspectRecord(
            suspect_id=s.id,
            fir_id=s.fir_id,
            name=s.name,
            alias=s.alias,
            aliases=s.aliases or [],
            phone_numbers=s.phone_numbers or [],
            vehicle_numbers=s.vehicle_numbers or [],
            modus_operandi=fir.modus_operandi or "",
            district=district,
            city=city,
            station_id=fir.station_id or 0,
        ))

    print(f"  Running entity resolution on {len(suspect_records)} suspects...")

    # --- MO similarity ---
    mo_records = []
    for sr in suspect_records:
        mo_records.append(MORecord(
            suspect_id=sr.suspect_id,
            fir_id=sr.fir_id,
            mo_text=sr.modus_operandi,
        ))

    print("  Computing MO similarity (loading sentence-transformers model)...")
    try:
        mo_edges = compute_mo_edges(mo_records)
        print(f"  MO edges: {len(mo_edges)}")
    except Exception as e:
        print(f"  WARNING: MO similarity failed ({e}), proceeding without it")
        mo_edges = []

    # --- Entity resolution ---
    cluster_dicts = resolve_entities(suspect_records, mo_edges, fir_station_map)
    print(f"  Clusters found: {len(cluster_dicts)}")

    # --- Snapshot before (for alert diffing) ---
    existing_clusters = list(session.exec(select(RepeatOffenderCluster)).all())
    before_snapshots = [
        ClusterSnapshot(
            canonical_id=c.canonical_id,
            linked_fir_ids=c.linked_fir_ids or [],
            syndicate_flag=c.syndicate_flag,
            districts_involved=c.districts_involved or [],
            cities_involved=c.cities_involved or [],
            match_reasons=c.match_reasons or [],
            confidence_score=c.confidence_score,
        )
        for c in existing_clusters
    ]

    # --- Clear existing clusters and suspect cluster assignments ---
    for existing in existing_clusters:
        session.delete(existing)
    for s in suspects_db:
        s.cluster_canonical_id = None
    session.flush()

    # --- Insert new clusters and update suspect assignments ---
    from app.engine.reasoning import compose_gloss

    new_cluster_objs = []
    for cd in cluster_dicts:
        cluster = RepeatOffenderCluster(
            canonical_id=cd["canonical_id"],
            primary_name=cd["primary_name"],
            linked_fir_ids=cd["linked_fir_ids"],
            linked_suspect_ids=cd["linked_suspect_ids"],
            districts_involved=cd["districts_involved"],
            cities_involved=cd["cities_involved"],
            confidence_score=cd["confidence_score"],
            match_reasons=cd["match_reasons"],
            # Deterministic gloss, always present — generate_reasoning_glosses()
            # can upgrade this to an LLM-written one later if a key is configured,
            # but every cluster gets a readable "why" the moment it's created.
            reasoning_gloss=compose_gloss(
                cd["match_reasons"], cd["confidence_score"], cd["primary_name"],
                cd["syndicate_flag"], cd["districts_involved"],
            ),
            syndicate_flag=cd["syndicate_flag"],
            updated_at=utcnow(),
        )
        session.add(cluster)
        new_cluster_objs.append(cluster)

        # Update suspect assignments
        for sid in cd["linked_suspect_ids"]:
            suspect = session.get(SuspectEntity, sid)
            if suspect:
                suspect.cluster_canonical_id = cd["canonical_id"]

    session.flush()

    # --- Diff and create alerts ---
    after_snapshots = [
        ClusterSnapshot(
            canonical_id=cd["canonical_id"],
            linked_fir_ids=cd["linked_fir_ids"],
            syndicate_flag=cd["syndicate_flag"],
            districts_involved=cd["districts_involved"],
            cities_involved=cd["cities_involved"],
            match_reasons=cd["match_reasons"],
            confidence_score=cd["confidence_score"],
        )
        for cd in cluster_dicts
    ]

    alert_dicts = diff_and_create_alerts(before_snapshots, after_snapshots, triggering_fir_id)
    for ad in alert_dicts:
        alert = Alert(
            cluster_canonical_id=ad["cluster_canonical_id"],
            triggering_fir_id=ad.get("triggering_fir_id"),
            kind=ad["kind"],
            scope_level=ad["scope_level"],
            scope_ref=ad["scope_ref"],
            message=ad["message"],
            match_reasons=ad.get("match_reasons", []),
        )
        session.add(alert)

    session.commit()
    print(f"  Alerts created: {len(alert_dicts)}")

    return new_cluster_objs


def generate_reasoning_glosses(session: Session, clusters: list[RepeatOffenderCluster]):
    """
    For each cluster, try to upgrade its reasoning_gloss to an LLM-written one
    via llm_client.explain(). Every cluster already has a deterministic gloss
    set at creation time (see run_syndicate_detection), so on any failure here
    that gloss is simply left in place — never null.
    """
    from app.engine.llm_client import llm_client, LLMError

    generated = 0
    skipped = 0
    for cluster in clusters:
        reasons = cluster.match_reasons or []
        if not reasons:
            continue
        try:
            gloss = llm_client.explain(reasons)
            cluster.reasoning_gloss = gloss
            generated += 1
        except LLMError:
            skipped += 1
        except Exception:
            skipped += 1

    if generated > 0 or skipped > 0:
        session.commit()

    if skipped > 0 and generated == 0:
        print(f"  Reasoning glosses: skipped all {skipped} (LLM not configured or unavailable)")
    else:
        print(f"  Reasoning glosses: {generated} generated, {skipped} skipped")


def run_seed():
    """Main seed entry point."""
    print("=" * 60)
    print("Bob Engine — Seed Script")
    print("=" * 60)

    print("\n[1] Creating database tables...")
    create_db_and_tables()

    with Session(engine) as session:
        # Idempotency check
        existing_count = len(list(session.exec(select(FIRRecord)).all()))
        if existing_count > 0:
            print(f"\n  Database already has {existing_count} FIR records.")
            resp = input("  Re-seed? This will clear existing data. [y/N]: ").strip().lower()
            if resp != "y":
                print("  Skipping seed. Run with a clean database to re-seed.")
                return

            print("  Clearing existing data...")
            for model in [Alert, RepeatOffenderCluster, SuspectEntity, FIRRecord, PoliceStation]:
                rows = list(session.exec(select(model)).all())
                for row in rows:
                    session.delete(row)
            session.commit()
            print("  Cleared.")

        # Step 1: Insert police stations
        print("\n[2] Inserting 14 police stations...")
        stations = build_stations()
        for st in stations:
            session.add(st)
        session.flush()

        # Build station name → id map
        db_stations = list(session.exec(select(PoliceStation)).all())
        station_id_map = {s.name: s.id for s in db_stations}
        print(f"  Inserted: {len(db_stations)} stations")

        # Step 2: Generate and insert FIRs + suspects
        print("\n[3] Generating 100 mock FIR records...")
        all_pairs = generate_all_firs(station_id_map)
        print(f"  Generated {len(all_pairs)} FIR records")

        print("\n[4] Inserting FIRs and suspects into database...")
        for fir, suspects in all_pairs:
            session.add(fir)
            session.flush()  # get fir.id
            for suspect in suspects:
                suspect.fir_id = fir.id
                session.add(suspect)
        session.commit()

        total_firs = len(list(session.exec(select(FIRRecord)).all()))
        total_suspects = len(list(session.exec(select(SuspectEntity)).all()))
        print(f"  FIRs: {total_firs}, Suspects: {total_suspects}")

        # Step 3: Run detection
        print("\n[5] Running syndicate detection...")
        clusters = run_syndicate_detection(session)

        syndicate_clusters = [c for c in clusters if c.syndicate_flag]
        print(f"\n  Clusters: {len(clusters)} total, {len(syndicate_clusters)} syndicates")
        for c in clusters:
            # Plain ASCII only — Windows' default console codepage (cp1252) can't
            # encode emoji or non-ASCII punctuation, and will crash mid-print.
            flag = "SYNDICATE" if c.syndicate_flag else "cluster"
            print(f"    [{flag}] {c.primary_name or '(unknown)'} - "
                  f"confidence {c.confidence_score:.0%}, "
                  f"{len(c.linked_fir_ids or [])} FIRs, "
                  f"districts: {c.districts_involved}")

        # Step 4: Reasoning glosses
        print("\n[6] Generating reasoning glosses (LLM)...")
        generate_reasoning_glosses(session, clusters)

    print("\n" + "=" * 60)
    print("Seed complete!")
    print("  Backend: uv run uvicorn app.main:app --reload")
    print("  Frontend: cd src/web && bun run dev")
    print("=" * 60)


if __name__ == "__main__":
    run_seed()

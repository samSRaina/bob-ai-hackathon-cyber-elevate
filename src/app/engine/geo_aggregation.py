"""
Geo aggregation engine.

Produces:
  spot_points   — individual FIR pins: {fir_id, fir_number, lat, lon, crime_category,
                  station_name, district, occurrence_date, fir_date_time,
                  complainant_name, occurrence_address, narrative, modus_operandi,
                  correlation} — enough for both a brief hover tooltip and a full
                  click popup on the map, including cluster/pattern reasoning.
  heatmap_points — aggregated density: {lat, lon, weight} (count of FIRs per station per category)

Both are filterable by crime_category and scoped by the RBAC station_ids list.
"""
from __future__ import annotations


def compute_geo_data(
    firs: list[dict],          # {id, station_id, crime_category, occurrence_date_from}
    stations: list[dict],      # {id, name, city, district, latitude, longitude}
    crime_category: str | None = None,
    station_ids: list[int] | None = None,  # None = all
) -> dict:
    """
    firs: list of dicts with keys: id, station_id, crime_category, occurrence_date_from
    stations: list of dicts with keys: id, name, city, district, latitude, longitude

    Returns:
    {
        "spots": [...],   # individual FIR pin data
        "heatmap": [...], # aggregated heatmap points
    }
    """
    station_map = {s["id"]: s for s in stations}

    # Apply RBAC scope filter
    def _in_scope(fir: dict) -> bool:
        if station_ids is not None:
            return fir.get("station_id") in station_ids
        return True

    # Apply category filter
    def _in_category(fir: dict) -> bool:
        if crime_category:
            return fir.get("crime_category", "") == crime_category
        return True

    filtered = [f for f in firs if _in_scope(f) and _in_category(f)]

    spots = []
    heatmap_acc: dict[tuple, dict] = {}  # (station_id, crime_category) → {lat, lon, weight}

    for fir in filtered:
        sid = fir.get("station_id")
        if not sid or sid not in station_map:
            continue
        st = station_map[sid]
        # Small random jitter per FIR so co-located FIRs don't overlap exactly
        import random
        rng = random.Random(fir["id"])
        jitter_lat = rng.uniform(-0.005, 0.005)
        jitter_lon = rng.uniform(-0.005, 0.005)

        spots.append({
            "fir_id": fir["id"],
            "fir_number": fir.get("fir_number"),
            "lat": st["latitude"] + jitter_lat,
            "lon": st["longitude"] + jitter_lon,
            "crime_category": fir.get("crime_category", ""),
            "station_name": st["name"],
            "district": st.get("district", ""),
            "occurrence_date": str(fir.get("occurrence_date_from", ""))[:10] if fir.get("occurrence_date_from") else None,
            "fir_date_time": fir.get("fir_date_time"),
            "complainant_name": fir.get("complainant_name"),
            "occurrence_address": fir.get("occurrence_address"),
            "narrative": fir.get("narrative"),
            "modus_operandi": fir.get("modus_operandi"),
            "correlation": fir.get("correlation"),
        })

        # Heatmap: aggregate at station × category
        key = (sid, fir.get("crime_category", ""))
        if key not in heatmap_acc:
            heatmap_acc[key] = {"lat": st["latitude"], "lon": st["longitude"], "weight": 0}
        heatmap_acc[key]["weight"] += 1

    heatmap = list(heatmap_acc.values())

    return {"spots": spots, "heatmap": heatmap}

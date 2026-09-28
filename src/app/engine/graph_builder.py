"""
Graph builder — NetworkX-based suspect/FIR/station graph.
Nodes: suspects (type='suspect'), FIRs (type='fir'), stations (type='station')
Edges: suspect-fir (IN_FIR), suspect-suspect (LINKED_TO, with evidence), fir-station (AT_STATION)
"""
from __future__ import annotations

import networkx as nx
from typing import Any


def build_graph(
    suspects: list[dict],   # {id, name, fir_id, cluster_canonical_id, ...}
    firs: list[dict],        # {id, fir_number, crime_category, station_id, district}
    stations: list[dict],    # {id, name, city, district}
    clusters: list[dict],    # {canonical_id, linked_suspect_ids, match_reasons, ...}
) -> nx.Graph:
    """
    Builds a NetworkX graph of the intelligence knowledge base.

    Node types:
        suspect  — SuspectEntity rows
        fir      — FIRRecord rows
        station  — PoliceStation rows

    Edge types:
        IN_FIR          — suspect → fir
        AT_STATION      — fir → station
        LINKED_TO       — suspect → suspect (cluster link, with match_reasons)
    """
    G = nx.Graph()

    # Add station nodes
    for st in stations:
        G.add_node(f"station:{st['id']}", type="station", label=st["name"],
                   city=st.get("city", ""), district=st.get("district", ""))

    # Add FIR nodes
    for fir in firs:
        G.add_node(f"fir:{fir['id']}", type="fir", label=fir.get("fir_number", str(fir["id"])),
                   crime_category=fir.get("crime_category", ""), district=fir.get("district", ""))
        if fir.get("station_id"):
            G.add_edge(f"fir:{fir['id']}", f"station:{fir['station_id']}", edge_type="AT_STATION")

    # Add suspect nodes
    for s in suspects:
        G.add_node(f"suspect:{s['id']}", type="suspect",
                   label=s.get("name") or "(unknown)", fir_id=s.get("fir_id"),
                   cluster=s.get("cluster_canonical_id"))
        G.add_edge(f"suspect:{s['id']}", f"fir:{s['fir_id']}", edge_type="IN_FIR")

    # Add cluster edges (LINKED_TO between suspects in the same cluster)
    for cluster in clusters:
        member_ids = cluster.get("linked_suspect_ids", [])
        reasons = cluster.get("match_reasons", [])
        gloss = cluster.get("reasoning_gloss") or ""
        for i in range(len(member_ids)):
            for j in range(i + 1, len(member_ids)):
                G.add_edge(
                    f"suspect:{member_ids[i]}",
                    f"suspect:{member_ids[j]}",
                    edge_type="LINKED_TO",
                    reasons=reasons,
                    gloss=gloss,
                    confidence=cluster.get("confidence_score", 0.0),
                    syndicate=cluster.get("syndicate_flag", False),
                )

    return G


def graph_to_json(G: nx.Graph) -> dict:
    """Convert graph to a JSON-serializable format for the frontend."""
    nodes = []
    for node_id, data in G.nodes(data=True):
        nodes.append({
            "id": node_id,
            "type": data.get("type", "unknown"),
            "label": data.get("label", node_id),
            "cluster": data.get("cluster"),
            "crime_category": data.get("crime_category"),
            "district": data.get("district"),
        })

    links = []
    for u, v, data in G.edges(data=True):
        links.append({
            "source": u,
            "target": v,
            "edge_type": data.get("edge_type", "UNKNOWN"),
            "reasons": data.get("reasons", []),
            "gloss": data.get("gloss"),
            "confidence": data.get("confidence"),
            "syndicate": data.get("syndicate", False),
        })

    return {"nodes": nodes, "links": links}

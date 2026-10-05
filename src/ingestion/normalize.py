"""
normalize - the single entry point from a match file to the engine.

    schema 0.x (old tagger)   -> unchanged: (raw, possessions_from_match(raw))
    schema 1.x (two-pass)     -> effective log -> timeline -> labels -> gates,
                                 presented in v0 shape (adapter) so every
                                 existing module works, with the v1 objects
                                 under match["v1"].
"""

from src.analytics.possessions import possessions_from_match
from src.v1.adapter import legacy_events, attach_events
from src.v1.answers import latest_answers, root_seq
from src.v1.gates import integrity_gates
from src.v1.labels import label_match
from src.v1.log import effective_ops
from src.v1.metrics import compute_metrics
from src.analytics.classic import classic_report
from src.v1.timeline import build_timeline


def _round(x):
    return None if x is None else round(x, 4)


def is_v1(raw: dict) -> bool:
    return str(raw.get("schema_version", "")).startswith("1.") and isinstance(raw.get("meta"), dict)


def normalize_match(raw: dict, match_id: str):
    if not is_v1(raw):
        return raw, possessions_from_match(raw, match_id)
    meta = raw["meta"]
    tl = build_timeline(effective_ops(raw["events"]))
    lab = label_match(tl, match_id)
    events = legacy_events(tl, lab)
    possessions = attach_events(lab.possessions, events)
    veo = meta.get("veo") or {}
    kickoff = next((r.team for r in tl.restarts if r.half == 1 and r.type == "KICKOFF"), None)
    match = {
        "schema_version": raw["schema_version"],
        "match": {"id": meta.get("id"), "date": meta.get("date"), "opponent": meta.get("opponent"),
                  "venue": meta.get("venue"), "schemaVersion": raw["schema_version"],
                  "veoUrl": veo.get("url") or "", "veoKickoffOffsetMs": veo.get("offset_h1_ms"),
                  "veoKickoffOffsetMs2": veo.get("offset_h2_ms"),
                  "kickoffTeam": {"US": "us", "THEM": "them"}.get(kickoff)},
        "final_score": {"us": tl.score["US"], "them": tl.score["THEM"]},
        "events": events,
        "v1": {"timeline": tl, "labels": lab, "gates": integrity_gates(raw, tl),
               "meta": meta, "reviewed": raw.get("reviewed", []),
               "answers": latest_answers(raw.get("reviewed", [])), "roots": root_seq(raw["events"]), "ops": raw["events"]},
    }
    v1 = match["v1"]
    v1["metrics"] = compute_metrics(tl, lab, v1["answers"], v1["roots"], meta,
                                    classic_tilt=_round(classic_report(match, possessions)["headline"]["field_tilt"]))
    return match, possessions

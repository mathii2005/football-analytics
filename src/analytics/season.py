"""
season - one profile per tagged match, and the season summary the radar and
bullet charts compare a match against (our own matches, not a league).

RADAR / BULLET METRICS (definitions reuse the existing modules)
    possession                 : strict possession share (metrics.py)
    field_tilt                 : share of events in zone 3/4/box (classic.py)
    high_recup_share           : RECUP in zone 3/4/box / all RECUP (classic.py)
    regain_10s                 : losses won back within 10 s (phases.py)
    shots_per_possession       : our shots / our possessions (phases.py)
    box_entries_per_possession : dangerous actions into the box / our possessions
    verticality                : vertical / (vertical + lateral) (classic.py)
    not_cheap_loss             : 1 - cheap losses / our possessions
    shots                      : our shots
    losses_opp_half_share      : our losses in zone 3/4/box / all our losses
summary: mean / min / max over matches where the metric exists. The same
match exported twice (same match.id) counts once.
"""

import json

from src.analytics.classic import classic_report
from src.analytics.metrics import match_metrics, share
from src.analytics.phases import counter_press, finishing
from src.analytics.possessions import US, possessions_from_match

METRICS = ("possession", "field_tilt", "high_recup_share", "regain_10s", "shots_per_possession",
           "box_entries_per_possession", "verticality", "not_cheap_loss", "shots", "losses_opp_half_share")


def match_profile(match_data: dict, possessions) -> dict:
    c = classic_report(match_data, possessions)
    m = match_metrics(possessions) if possessions else None
    n_ours = sum(p.team == US for p in possessions)
    zones = {z["zone"]: z for z in c["zones"]}
    losses = sum(z["losses"] for z in c["zones"])
    return {
        "possession": m["possession_pct"]["strict"] if m else None,
        "field_tilt": c["headline"]["field_tilt"],
        "high_recup_share": c["headline"]["high_recup_share"],
        "regain_10s": counter_press(possessions)["within_10s"],
        "shots_per_possession": finishing(possessions)["shots_per_possession"],
        "box_entries_per_possession": share(c["funnel"][1]["n"], n_ours),
        "verticality": c["attack_style"]["vertical_pct"],
        "not_cheap_loss": (1 - m["outcomes"]["cheap_loss"] / n_ours) if m and n_ours else None,
        "shots": c["headline"]["shots"],
        "losses_opp_half_share": share(sum(zones[z]["losses"] for z in ("3", "4", "BOX")), losses),
    }


def summarize(profiles: list[dict]) -> dict:
    out = {}
    for k in METRICS:
        vals = [p[k] for p in profiles if p.get(k) is not None]
        out[k] = {"mean": sum(vals) / len(vals), "min": min(vals), "max": max(vals)} if vals else None
    return out


def season_from(items) -> dict:
    """items: [(match_id, match_data, possessions)]"""
    matches, seen = [], set()
    for mid, match, ps in items:
        meta = match.get("match") or {}
        key = meta.get("id") or mid
        if key in seen:
            continue
        seen.add(key)
        matches.append({"id": mid, "date": meta.get("date"), "opponent": meta.get("opponent"),
                        "metrics": match_profile(match, ps)})
    matches.sort(key=lambda x: x["date"] or "")
    return {"matches": matches, "summary": summarize([x["metrics"] for x in matches])}


def season_profile(paths) -> dict:
    items = []
    for path in paths:
        try:
            match = json.loads(path.read_text())
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        if not isinstance(match, dict) or not isinstance(match.get("events"), list) or not isinstance(match.get("match"), dict):
            continue
        items.append((path.stem, match, possessions_from_match(match, path.stem)))
    return season_from(items)

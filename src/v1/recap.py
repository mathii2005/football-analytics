"""
recap - the Monday breakdown (PIPELINE §9): the match in brief, what worked,
what to work on, the trend. About 10 minutes, at most 3 numbers per slide.

The comparison depends on what exists (the mode is shown on the slides):
    vs_opponent  fewer than MIN_SEASON other v1 matches: each pair "ours /
                 theirs" (PAIRS) is scored by the relative gap
                 (us - them) / max(us, them), sign by direction; best = the
                 largest positive gaps, worst = the largest negative ones.
    vs_season    at least MIN_SEASON other v1 matches: each metric is scored by
                 z = (value - mean of the other matches) / their sd, sign by
                 direction (only metrics whose status is ok or partiel, sd > 0).
                 Best = the highest z (>= Z_MIN), worst = the lowest (<= -Z_MIN).
    A metric needs a value on both sides; at most TOP per slide; each item
    carries up to CLIPS clips (typical first).
    Against the opponent, a pair only counts when both sides rest on at least
    MIN_N cases and the gap is large enough to mean something (MIN_GAP: 10
    points for a rate, 0.3 xG, 3 for a count); otherwise noise would top the slides.
"""

from statistics import mean, pstdev

MIN_SEASON = 3
Z_MIN = 0.5
TOP = 2
CLIPS = 3
PAIRS = [("shots_for", "shots_against"), ("xg_for", "xg_against"), ("chances_for", "chances_against"),
         ("transition_to_box", "transition_to_box_against"), ("buildup_progression", "buildup_progression_against"),
         ("setpiece_shot_rate", "setpiece_shot_rate_against"), ("first_contact_won", "first_contact_won_against")]
BRIEF = ["goals_for", "goals_against", "xg_for", "xg_against", "chances_for", "field_tilt_time"]
SKIP_SEASON = {"goals_for", "goals_against", "field_tilt_classic", "xgd"}     # outcomes / duplicates, not levers
MIN_N = 8
MIN_GAP = {"%": 0.10, "xG": 0.3}
MIN_GAP_COUNT = 3


def _meaningful(us, them):
    if min(us.get("n") or 0, them.get("n") or 0) < MIN_N:
        return False
    unit, diff = us.get("unit") or "", abs(us["value"] - them["value"])
    if unit == "%":
        return diff >= MIN_GAP["%"]
    if unit.startswith("xG"):
        return diff >= MIN_GAP["xG"]
    return diff >= MIN_GAP_COUNT


def _num(m):
    return m and isinstance(m.get("value"), (int, float)) and m.get("status") in ("ok", "partiel", "trop tôt")


def _clips(m):
    c = m.get("clips") or {}
    seen, out = set(), []
    for x in (c.get("typical") or []) + (c.get("extreme") or []) + (c.get("all") or []):
        if (x["half"], x["t"]) not in seen:
            seen.add((x["half"], x["t"])); out.append(x)
    return out[:CLIPS]


def _item(m, compare, score, mode):
    return {"id": m["id"], "label_fr": m["label_fr"], "unit": m.get("unit"), "value": m["value"], "n": m["n"],
            "status": m.get("status"), "compare": compare, "score": round(score, 3), "mode": mode, "clips": _clips(m)}


def _vs_opponent(M):
    scored = []
    for us_id, them_id in PAIRS:
        us, them = M.get(us_id), M.get(them_id)
        if not (_num(us) and _num(them)) or not _meaningful(us, them):
            continue
        top = max(abs(us["value"]), abs(them["value"]))
        if top == 0:
            continue
        sign = -1 if us.get("direction") == "↓" else 1
        gap = sign * (us["value"] - them["value"]) / top
        scored.append(_item(us, {"label": "adversaire", "value": them["value"]}, gap, "vs_opponent"))
    return scored


def _vs_season(M, others):
    scored = []
    for mid, m in M.items():
        if mid in SKIP_SEASON or not _num(m) or m.get("status") == "trop tôt":
            continue
        vals = [o[mid]["value"] for o in others if _num(o.get(mid))]
        if len(vals) < MIN_SEASON or pstdev(vals) == 0:
            continue
        mu, sd = mean(vals), pstdev(vals)
        sign = -1 if m.get("direction") == "↓" else 1
        z = sign * (m["value"] - mu) / sd
        scored.append(_item(m, {"label": f"moyenne des {len(vals)} autres matchs", "value": round(mu, 4)}, z, "vs_season"))
    return scored


def build_recap(metrics: dict, others: list[dict], season_status: dict | None = None) -> dict:
    """metrics: this match's catalogue; others: the catalogues of the other v1 matches."""
    mode = "vs_season" if len(others) >= MIN_SEASON else "vs_opponent"
    scored = _vs_season(metrics, others) if mode == "vs_season" else _vs_opponent(metrics)
    ranked = sorted(scored, key=lambda x: -x["score"])
    threshold = Z_MIN if mode == "vs_season" else 0
    best = [x for x in ranked if x["score"] > threshold][:TOP]
    worst = [x for x in reversed(ranked) if x["score"] < -threshold][:TOP]
    trend = None
    if season_status:
        moving = [(k, v) for k, v in season_status.items() if v.get("status") in ("AMÉLIORÉ", "EN BAISSE") and k in metrics]
        if moving:
            k, v = moving[0]
            trend = {"id": k, "label_fr": metrics[k]["label_fr"], "status": v["status"], "series": v.get("series", []),
                     "baseline_source": v.get("baseline_source")}
    return {"mode": mode, "n_other_matches": len(others),
            "brief": {k: metrics[k] for k in BRIEF if k in metrics},
            "best": best, "worst": worst, "trend": trend}

"""
classic - the staff's original dashboard definitions, reproduced verbatim
from laureats-tagger/pipeline/build_dashboard.py so the numbers coaches
already know stay identical (tests/test_classic.py pins Vanier 2026-09-26).

DEFINITIONS
    dangerous action : PASSE_PROF, CONDUITE, CENTRE or SWITCH (ours).
    field tilt       : share of ALL tagged events with zone 3, 4 or BOX.
    high recoveries  : RECUP in zone 3, 4 or BOX, as a share of all RECUP.
    recovery height  : mean RECUP zone weight, zone 1..4 = 1..4, BOX = 5.
    zone balance     : RECUP - PERTE per zone; zone control = RECUP /
                       (RECUP + PERTE).
    attack style     : vertical = PASSE_PROF + CONDUITE, lateral = SWITCH +
                       CENTRE, vertical_pct = vertical / (vertical + lateral);
                       side asymmetry = |left - right| / (left + right) over
                       dangerous actions with a couloir.
    transition speed : for each RECUP, time to the next dangerous action in
                       the same half. Excluded when a PERTE comes first, the
                       gap exceeds TRANSITION_CAP_MS, or it overlaps a tagged
                       stoppage. Buckets: contre < 5 s, rapide 5-15 s,
                       construit >= 15 s. A raw per-event proxy, not a
                       possession metric.
    tempo per half   : dangerous actions, shots, actions per shot, losses.
    shot funnel      : dangerous actions -> box entries (dangerous actions
                       into the box) -> shots -> on target -> goals.
    threat score     : dangerous action 1 (+2 into the box), TIR_HC 3,
                       TIR_C 4, BUT 6; summed per THREAT_BIN_MIN minutes.
                       A proxy of danger, not xG.
    set-piece shot   : one of our set pieces at most SET_PIECE_WINDOW_MS
                       before the shot, same half, no PERTE in between.
"""

from statistics import median

from src.analytics.possessions import (
    US, THEM, SHOT_CODES, SET_PIECE_CODES, GOAL_CODES, HALF_LENGTH_MS, stoppage_spans,
)

DANGEROUS_CODES = {"PASSE_PROF", "CONDUITE", "CENTRE", "SWITCH"}
ACTION_ORDER = ("PASSE_PROF", "CONDUITE", "CENTRE", "SWITCH")
ACTION_LABELS = {"PASSE_PROF": "Passe profondeur", "CONDUITE": "Conduite",
                 "CENTRE": "Centre", "SWITCH": "Changement de jeu"}
THREAT_WEIGHTS = {"dangerous_action": 1, "box_entry_bonus": 2, "TIR_HC": 3, "TIR_C": 4, "BUT": 6}
THREAT_BIN_MIN = 5
RECOVERY_WEIGHTS = {1: 1, 2: 2, 3: 3, 4: 4, "BOX": 5}
HIGH_ZONES = {3, 4, "BOX"}
ZONES = (1, 2, 3, 4, "BOX")
COULOIRS = ("left", "center", "right")
TRANSITION_CAP_MS = 60_000
SET_PIECE_WINDOW_MS = 20_000
SET_PIECE_LABELS = {"CORNER": "Corners", "COUP_FRANC": "Coups francs", "TOUCHE": "Touches",
                    "PENALTY": "Penalties", "DEGAGEMENT": "Dégagements"}
CARD_CODES = {"CARTON_JAUNE", "CARTON_ROUGE"}


def is_ours(e):
    return e.get("team") != THEM


def zone_key(z):
    return z if z in ZONES else None


def arrival_zone(e):
    return "BOX" if e.get("is_box") or e.get("zone") == "BOX" else zone_key(e.get("zone"))


def event_threat(e) -> int:
    code = e["code"]
    if not is_ours(e):
        return 0
    score = 0
    if code in DANGEROUS_CODES:
        score += THREAT_WEIGHTS["dangerous_action"]
        if e.get("is_box"):
            score += THREAT_WEIGHTS["box_entry_bonus"]
    return score + THREAT_WEIGHTS.get(code, 0) if code in ("TIR_HC", "TIR_C", "BUT") else score


def dangerous(events):
    return [e for e in events if e["code"] in DANGEROUS_CODES and is_ours(e)]


def shots_of(events):
    return [e for e in events if e["code"] in SHOT_CODES and is_ours(e)]


# ── headline & zones ───────────────────────────────────────────────

def headline(events) -> dict:
    ours = [e for e in events if is_ours(e)]
    recups = [e for e in ours if e["code"] == "RECUP"]
    losses = [e for e in ours if e["code"] == "PERTE"]
    shots = shots_of(events)
    weights = [RECOVERY_WEIGHTS[e["zone"]] for e in recups if e.get("zone") in RECOVERY_WEIGHTS]
    n_dangerous = len(dangerous(events))
    high = sum(1 for e in recups if e.get("zone") in HIGH_ZONES)
    return {
        "recups": len(recups),
        "losses": len(losses),
        "balance": len(recups) - len(losses),
        "shots": len(shots),
        "shots_on_target": sum(1 for e in shots if e["code"] in ("TIR_C", "BUT")),
        "box_shots": sum(1 for e in shots if e.get("is_box") or e.get("zone") == "BOX"),
        "goals": sum(1 for e in shots if e["code"] in GOAL_CODES),
        "dangerous_actions": n_dangerous,
        "actions_per_shot": n_dangerous / len(shots) if shots else None,
        "field_tilt": (sum(1 for e in events if e.get("zone") in HIGH_ZONES) / len(events)) if events else None,
        "high_recups": high,
        "high_recup_share": high / len(recups) if recups else None,
        "recovery_height": sum(weights) / len(weights) if weights else None,
    }


def zones_report(events) -> list[dict]:
    rows = []
    for z in ZONES:
        rec = sum(1 for e in events if e["code"] == "RECUP" and zone_key(e.get("zone")) == z)
        los = sum(1 for e in events if e["code"] == "PERTE" and zone_key(e.get("zone")) == z)
        rows.append({"zone": str(z), "recups": rec, "losses": los, "balance": rec - los,
                     "control": rec / (rec + los) if rec + los else None})
    return rows


def recovery_distribution(events) -> list[dict]:
    return [{"zone": str(z), "n": sum(1 for e in events if e["code"] == "RECUP" and zone_key(e.get("zone")) == z)}
            for z in ZONES]


# ── attack ─────────────────────────────────────────────────────────

def actions_by_type(events) -> list[dict]:
    acts = dangerous(events)
    return [{"code": c, "label": ACTION_LABELS[c],
             "box": sum(1 for e in acts if e["code"] == c and e.get("is_box")),
             "non_box": sum(1 for e in acts if e["code"] == c and not e.get("is_box"))} for c in ACTION_ORDER]


def box_entries_by_type(events) -> list[dict]:
    acts = [e for e in dangerous(events) if e.get("is_box")]
    return [{"code": c, "label": ACTION_LABELS[c], "n": sum(1 for e in acts if e["code"] == c)} for c in ACTION_ORDER]


def attack_style(events) -> dict:
    acts = dangerous(events)
    vertical = sum(1 for e in acts if e["code"] in ("PASSE_PROF", "CONDUITE"))
    lateral = sum(1 for e in acts if e["code"] in ("SWITCH", "CENTRE"))
    left = sum(1 for e in acts if e.get("couloir") == "left")
    right = sum(1 for e in acts if e.get("couloir") == "right")
    return {"vertical": vertical, "lateral": lateral,
            "vertical_pct": vertical / (vertical + lateral) if vertical + lateral else None,
            "side_asymmetry": abs(left - right) / (left + right) if left + right else None}


def attack_origins(events) -> dict:
    grid = {c: {str(z): 0 for z in ZONES} for c in COULOIRS}
    for e in dangerous(events):
        z = arrival_zone(e)
        if e.get("couloir") in COULOIRS and z is not None:
            grid[e["couloir"]][str(z)] += 1
    return grid


def couloir_origins(events) -> list[dict]:
    acts = [e for e in dangerous(events) if e.get("couloir") in COULOIRS]
    return [{"couloir": c, "n": sum(1 for e in acts if e["couloir"] == c),
             "share": (sum(1 for e in acts if e["couloir"] == c) / len(acts)) if acts else None,
             "by_type": {t: sum(1 for e in acts if e["couloir"] == c and e["code"] == t) for t in ACTION_ORDER}}
            for c in COULOIRS]


def actions_by_arrival_zone(events) -> list[dict]:
    acts = dangerous(events)
    return [{"zone": str(z), "by_type": {t: sum(1 for e in acts if arrival_zone(e) == z and e["code"] == t)
                                         for t in ACTION_ORDER}} for z in ZONES]


def shot_funnel(events) -> list[dict]:
    acts, shots = dangerous(events), shots_of(events)
    return [{"stage": "Actions dangereuses", "n": len(acts)},
            {"stage": "Entrées surface", "n": sum(1 for e in acts if e.get("is_box"))},
            {"stage": "Tirs", "n": len(shots)},
            {"stage": "Cadrés", "n": sum(1 for e in shots if e["code"] in ("TIR_C", "BUT"))},
            {"stage": "Buts", "n": sum(1 for e in shots if e["code"] in GOAL_CODES)}]


def tempo(events) -> list[dict]:
    rows = []
    for half in sorted({e["half"] for e in events}):
        ev = [e for e in events if e["half"] == half]
        n_act, n_shots = len(dangerous(ev)), len(shots_of(ev))
        rows.append({"half": half, "actions": n_act, "shots": n_shots,
                     "actions_per_shot": n_act / n_shots if n_shots else None,
                     "losses": sum(1 for e in ev if e["code"] == "PERTE")})
    return rows


# ── transitions ────────────────────────────────────────────────────

def transition_speed(events) -> dict:
    deltas, recups = [], [e for e in events if e["code"] == "RECUP"]
    for half in sorted({e["half"] for e in events}):
        ev = sorted((e for e in events if e["half"] == half), key=lambda e: e["timestamp_ms"])
        spans = stoppage_spans(ev)
        for i, r in enumerate(ev):
            if r["code"] != "RECUP":
                continue
            nxt = next((e for e in ev[i + 1:] if e["timestamp_ms"] > r["timestamp_ms"] and e["code"] in DANGEROUS_CODES), None)
            if nxt is None:
                continue
            t0, t1 = r["timestamp_ms"], nxt["timestamp_ms"]
            loss_between = any(e["code"] == "PERTE" and t0 < e["timestamp_ms"] < t1 for e in ev)
            crosses = any(s < t1 and e > t0 for s, e in spans)
            if not loss_between and t1 - t0 <= TRANSITION_CAP_MS and not crosses:
                deltas.append((t1 - t0) / 1000)
    n = len(deltas)
    return {"median_s": round(median(deltas), 1) if n else None, "n": n,
            "deltas_s": [round(d, 1) for d in deltas],
            "fast": sum(1 for d in deltas if d < 5), "mid": sum(1 for d in deltas if 5 <= d < 15),
            "slow": sum(1 for d in deltas if d >= 15),
            "pct_leading": n / len(recups) if recups else None}


# ── momentum ───────────────────────────────────────────────────────

def threat_timeline(events, possessions) -> list[dict]:
    """Threat per THREAT_BIN_MIN window, per half, with goals for both sides."""
    out = []
    for half in sorted({e["half"] for e in events}):
        h_events = [e for e in events if e["half"] == half]
        start = (half - 1) * HALF_LENGTH_MS if min(e["timestamp_ms"] for e in h_events) >= (half - 1) * HALF_LENGTH_MS else 0
        end = max(e["timestamp_ms"] for e in h_events)
        bin_ms = THREAT_BIN_MIN * 60_000
        n = int((end - start) // bin_ms) + 1
        bins = [{"half": half, "minute": int((start + i * bin_ms) // 60_000), "threat": 0,
                 "goals_us": 0, "goals_them": 0} for i in range(n)]
        for e in h_events:
            i = int((e["timestamp_ms"] - start) // bin_ms)
            bins[i]["threat"] += event_threat(e)
            if e["code"] in GOAL_CODES and is_ours(e):
                bins[i]["goals_us"] += 1
        for p in possessions:
            if p.half == half and p.end_type == "opp_goal":
                bins[min(int((p.end_ms - start) // bin_ms), n - 1)]["goals_them"] += 1
        out += bins
    return out


def cards(events) -> list[dict]:
    return [{"half": e["half"], "minute": round(e["timestamp_ms"] / 60_000, 1),
             "team": THEM if e.get("team") == THEM else US,
             "code": e["code"]} for e in events if e["code"] in CARD_CODES]


# ── set pieces ─────────────────────────────────────────────────────

def set_pieces(events) -> dict:
    counts = {code: {"us": 0, "them": 0} for code in SET_PIECE_LABELS}
    for e in events:
        if e["code"] in counts:
            counts[e["code"]][THEM if e.get("team") == THEM else US] += 1
    shots_sp = goals_sp = 0
    for s in shots_of(events):
        t, half = s["timestamp_ms"], s["half"]
        window = [e for e in events if e["half"] == half and t - SET_PIECE_WINDOW_MS <= e["timestamp_ms"] < t]
        ours_sp = [e["timestamp_ms"] for e in window if e["code"] in SET_PIECE_CODES and is_ours(e)]
        if not ours_sp:
            continue
        last = max(ours_sp)
        if not any(e["code"] == "PERTE" and e["timestamp_ms"] > last for e in window):
            shots_sp += 1
            goals_sp += s["code"] in GOAL_CODES
    return {"counts": [{"code": c, "label": SET_PIECE_LABELS[c], **v} for c, v in counts.items()],
            "corner_asymmetry": counts["CORNER"],
            "shots_from_set_piece": shots_sp, "goals_from_set_piece": goals_sp}


def classic_report(match_data: dict, possessions) -> dict:
    events = match_data.get("events", [])
    return {
        "headline": headline(events),
        "zones": zones_report(events),
        "recovery_distribution": recovery_distribution(events),
        "actions_by_type": actions_by_type(events),
        "box_entries_by_type": box_entries_by_type(events),
        "attack_style": attack_style(events),
        "attack_origins": attack_origins(events),
        "couloir_origins": couloir_origins(events),
        "actions_by_arrival_zone": actions_by_arrival_zone(events),
        "transition_speed": transition_speed(events),
        "tempo": tempo(events),
        "funnel": shot_funnel(events),
        "threat": threat_timeline(events, possessions) if events else [],
        "cards": cards(events),
        "set_pieces": set_pieces(events),
    }

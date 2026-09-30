"""
match report - everything the dashboard tabs show beyond match_metrics

DEFINITIONS (carried over from the staff's current dashboard so the
numbers coaches already know stay the same)
    dangerous action : PASSE_PROF, CONDUITE, CENTRE or SWITCH by us.
    threat score     : dangerous action 1 (+2 if into the box), TIR_HC 3,
                       TIR_C 4, BUT 6; summed per THREAT_BIN_MIN minutes.
                       A proxy of danger, not xG.
    recovery height  : mean of RECUP zones weighted 1 (zone 1) ... 4,
                       BOX 5.
    zone balance     : RECUP minus PERTE in a zone; zone control =
                       RECUP / (RECUP + PERTE).
    attack origin    : dangerous actions counted by couloir x zone.
    set-piece goal   : our goal whose possession contains one of our set
                       pieces; conceded from a set piece = their scoring
                       possession contains one of their set pieces.
    key points       : factual sentences generated from the numbers, only
                       when a threshold below makes them worth saying.
"""

from src.analytics.metrics import match_metrics, possession_share, OPP_HALF, pct_text
from src.analytics.possessions import US, THEM, SHOT_CODES, SET_PIECE_CODES, GOAL_CODES, HALF_LENGTH_MS

DANGEROUS_CODES = {"PASSE_PROF", "CONDUITE", "CENTRE", "SWITCH"}
THREAT_WEIGHTS = {"dangerous_action": 1, "box_entry_bonus": 2, "TIR_HC": 3, "TIR_C": 4, "BUT": 6}
THREAT_BIN_MIN = 5
RECOVERY_WEIGHTS = {1: 1, 2: 2, 3: 3, 4: 4, "BOX": 5}
ZONES = (1, 2, 3, 4, "BOX")
COULOIRS = ("left", "center", "right")
SET_PIECE_LABELS = {"CORNER": "Corners", "COUP_FRANC": "Coups francs", "TOUCHE": "Touches",
                    "PENALTY": "Penalties", "DEGAGEMENT": "Dégagements"}

# key-point thresholds
KP_LOSS_OPP_HALF_SHARE = 0.5     # "we give it away in their half" when >= 50 % of losses
KP_HALF_SHOTS_DIFF = 3           # half-to-half shot swing worth mentioning
KP_CHEAP_LOSS_SHARE = 0.15       # cheap losses >= 15 % of our possessions


def is_ours(e):
    return e.get("team") != THEM


def zone_key(z):
    return z if z in ZONES else None


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


def zones_report(events) -> list[dict]:
    rows = []
    for z in ZONES:
        rec = sum(1 for e in events if e["code"] == "RECUP" and zone_key(e.get("zone")) == z)
        los = sum(1 for e in events if e["code"] == "PERTE" and zone_key(e.get("zone")) == z)
        rows.append({"zone": str(z), "recups": rec, "losses": los, "balance": rec - los,
                     "control": rec / (rec + los) if rec + los else None})
    return rows


def attack_origins(events) -> dict:
    grid = {c: {str(z): 0 for z in ZONES} for c in COULOIRS}
    for e in events:
        if e["code"] in DANGEROUS_CODES and is_ours(e) and e.get("couloir") in COULOIRS:
            z = "BOX" if e.get("is_box") or e.get("zone") == "BOX" else zone_key(e.get("zone"))
            if z is not None:
                grid[e["couloir"]][str(z)] += 1
    return grid


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


def halves_report(events, possessions) -> list[dict]:
    rows = []
    for half in sorted({p.half for p in possessions}):
        ps = [p for p in possessions if p.half == half]
        ev = [e for e in events if e["half"] == half]
        ours = [p for p in ps if p.team == US]
        losses = [p for p in ours if p.end_type == "perte"]
        rows.append({
            "half": half,
            "possession_strict": possession_share(ps)["strict"],
            "shots": sum(1 for e in ev if e["code"] in SHOT_CODES and is_ours(e)),
            "shots_on_target": sum(1 for e in ev if e["code"] in ("TIR_C", "BUT") and is_ours(e)),
            "goals_us": sum(1 for e in ev if e["code"] in GOAL_CODES and is_ours(e)),
            "goals_them": sum(p.end_type == "opp_goal" for p in ps),
            "dangerous_actions": sum(1 for e in ev if e["code"] in DANGEROUS_CODES and is_ours(e)),
            "threat": sum(event_threat(e) for e in ev),
            "losses": len(losses),
            "losses_opp_half": sum(p.end_zone in OPP_HALF for p in losses),
        })
    return rows


def set_pieces_report(events, possessions) -> dict:
    counts = {code: {"us": 0, "them": 0} for code in SET_PIECE_LABELS}
    for e in events:
        if e["code"] in counts:
            counts[e["code"]][THEM if e.get("team") == THEM else US] += 1
    goals_from_sp = sum(1 for p in possessions if p.team == US and set(p.codes) & GOAL_CODES
                        and set(p.codes) & SET_PIECE_CODES)
    conceded_from_sp = sum(1 for p in possessions if p.team == THEM and p.end_type == "opp_goal"
                           and set(p.codes) & SET_PIECE_CODES)
    return {"counts": [{"code": c, "label": SET_PIECE_LABELS[c], **v} for c, v in counts.items()],
            "goals_from_set_pieces": goals_from_sp, "conceded_from_set_pieces": conceded_from_sp}


def headline(events) -> dict:
    ours = [e for e in events if is_ours(e)]
    recups = [e for e in ours if e["code"] == "RECUP"]
    shots = [e for e in ours if e["code"] in SHOT_CODES]
    weights = [RECOVERY_WEIGHTS[e["zone"]] for e in recups if e.get("zone") in RECOVERY_WEIGHTS]
    dangerous = sum(1 for e in ours if e["code"] in DANGEROUS_CODES)
    return {
        "recups": len(recups),
        "losses": sum(1 for e in ours if e["code"] == "PERTE"),
        "shots": len(shots),
        "shots_on_target": sum(1 for e in shots if e["code"] in ("TIR_C", "BUT")),
        "box_shots": sum(1 for e in shots if e.get("is_box") or e.get("zone") == "BOX"),
        "goals": sum(1 for e in shots if e["code"] in GOAL_CODES),
        "dangerous_actions": dangerous,
        "actions_per_shot": dangerous / len(shots) if shots else None,
        "recovery_height": sum(weights) / len(weights) if weights else None,
    }


def buts(n, suffix=""):
    """'1 but encaissé' / '2 buts encaissés' - suffix agrees in number."""
    return f"{n} but{'s' if n > 1 else ''}" + (f" {suffix}{'s' if n > 1 else ''}" if suffix else "")


def key_points(match_data, events, possessions, m, halves, sp) -> list[str]:
    """Short factual sentences in French, most important first."""
    pts = []
    final = match_data.get("final_score") or {}
    ours = [p for p in possessions if p.team == US]
    losses = [p for p in ours if p.end_type == "perte"]

    # how the goals came
    goals_them_after_loss = sum(1 for i, p in enumerate(possessions[:-1])
                                if p.team == US and p.end_type == "perte"
                                and possessions[i + 1].end_type == "opp_goal")
    if sp["goals_from_set_pieces"]:
        n, total = sp["goals_from_set_pieces"], final.get("us", "?")
        pts.append(f"Nos {n} buts viennent de coups de pied arrêtés." if n > 1 and n == total
                   else f"{n} de nos {total} buts viennent d'un coup de pied arrêté." if n > 1
                   else f"1 de nos {total} buts vient d'un coup de pied arrêté." if total != 1
                   else "Notre but vient d'un coup de pied arrêté.")
    if sp["conceded_from_set_pieces"]:
        pts.append(f"{buts(sp['conceded_from_set_pieces'], 'encaissé')} sur coup de pied arrêté adverse.")
    if goals_them_after_loss:
        pts.append(f"{buts(goals_them_after_loss, 'encaissé')} directement après une de nos pertes.")

    # where we give it away
    if losses:
        opp = sum(p.end_zone in OPP_HALF for p in losses)
        if opp / len(losses) >= KP_LOSS_OPP_HALF_SHARE:
            z3 = sum(p.end_zone == 3 for p in losses)
            pts.append(f"{opp} de nos {len(losses)} pertes ({pct_text(opp / len(losses))}) sont dans leur moitié, "
                       f"dont {z3} en zone 3.")
    cheap = m["outcomes"]["cheap_loss"]
    if ours and cheap / len(ours) >= KP_CHEAP_LOSS_SHARE:
        pts.append(f"{cheap} ballons perdus moins de 5 s après les avoir récupérés.")

    # half-to-half swing
    if len(halves) == 2:
        a, b = halves
        if abs(b["shots"] - a["shots"]) >= KP_HALF_SHOTS_DIFF:
            better = "2e" if b["shots"] > a["shots"] else "1re"
            pts.append(f"Plus dangereux en {better} mi-temps : {a['shots']} tirs en MT1, {b['shots']} en MT2.")

    # finishing
    if m["shot_sequences"]:
        pts.append(f"{m['shot_sequences']} possessions sur {len(ours)} se terminent par un tir "
                   f"({pct_text(m['shot_sequence_rate'])}).")
    return pts


def match_report(match_data: dict, possessions) -> dict:
    events = match_data.get("events", [])
    m = match_metrics(possessions)
    halves = halves_report(events, possessions)
    sp = set_pieces_report(events, possessions)
    return {
        "headline": headline(events),
        "metrics": m,
        "halves": halves,
        "zones": zones_report(events),
        "attack_origins": attack_origins(events),
        "threat": threat_timeline(events, possessions),
        "set_pieces": sp,
        "key_points": key_points(match_data, events, possessions, m, halves, sp),
    }

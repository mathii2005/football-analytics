"""
match report - everything the dashboard tabs show beyond match_metrics

Old staff-dashboard definitions live in classic.py (merged into the
report as-is). This module adds what the old sheet didn't have:
    halves           : per-half possession, shots, threat, losses.
    conceded from SP : their scoring possession contains one of their set
                       pieces (their shots aren't tagged, so the 20 s
                       window rule of classic.py can't apply to them).
    key points       : factual sentences generated from the numbers, only
                       when a threshold below makes them worth saying.
"""

from src.analytics.metrics import match_metrics, possession_share, OPP_HALF, pct_text
from src.analytics.possessions import US, THEM, SHOT_CODES, SET_PIECE_CODES, GOAL_CODES
from src.analytics.classic import (  # noqa: F401  (re-exported for callers/tests)
    DANGEROUS_CODES, THREAT_WEIGHTS, RECOVERY_WEIGHTS, ZONES, COULOIRS, is_ours, event_threat,
    zones_report, attack_origins, threat_timeline, headline, classic_report,
)

# key-point thresholds
KP_LOSS_OPP_HALF_SHARE = 0.5     # "we give it away in their half" when >= 50 % of losses
KP_HALF_SHOTS_DIFF = 3           # half-to-half shot swing worth mentioning
KP_CHEAP_LOSS_SHARE = 0.15       # cheap losses >= 15 % of our possessions


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


def conceded_from_set_pieces(possessions) -> int:
    return sum(1 for p in possessions if p.team == THEM and p.end_type == "opp_goal"
               and set(p.codes) & SET_PIECE_CODES)


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
    if sp["goals_from_set_piece"]:
        n, total = sp["goals_from_set_piece"], final.get("us", "?")
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
    report = classic_report(match_data, possessions)
    report["set_pieces"]["conceded_from_set_pieces"] = conceded_from_set_pieces(possessions)
    report.update(metrics=m, halves=halves,
                  key_points=key_points(match_data, events, possessions, m, halves, report["set_pieces"]))
    return report

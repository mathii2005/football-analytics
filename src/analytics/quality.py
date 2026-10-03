"""
tagging quality checks - automatic verification of a reconstruction
using only the match file (no video)

These don't prove a possession is right; they point at the places where
the tagging is most likely incomplete, so they can be checked on video.

DEFINITIONS
    long gap       : inside one of OUR possessions, more than
                     LONG_GAP_MS of live time between two consecutive
                     tags (or from the start to the first tag). Our
                     actions are tagged, so a long silence usually hides
                     an untagged turnover. Their possessions are not
                     checked: we don't tag their actions.
    score check    : our BUT count must equal final_score.us and the
                     inferred opponent goals final_score.them.
"""

from src.analytics.possessions import US, THEM, ACTION_CODES, REGAIN_CODES, LOSS_CODES, \
    SET_PIECE_CODES, STOPPAGE_START, STOPPAGE_END, GOAL_CODES, format_ms
from src.analytics.metrics import live_between

LONG_GAP_MS = 90_000
KNOWN_CODES = ACTION_CODES | REGAIN_CODES | LOSS_CODES | SET_PIECE_CODES | {
    STOPPAGE_START, STOPPAGE_END, "CARTON_JAUNE", "CARTON_ROUGE"}


def long_gaps(possessions) -> list[dict]:
    out = []
    for p in possessions:
        if p.team != US:
            continue
        # an inexact start is only a bound: the gap before the first tag isn't real
        times = ([p.start_ms] if p.start_exact else []) + [e["timestamp_ms"] for e in p.events]
        for t0, t1 in zip(times, times[1:]):
            gap = live_between(p, t0, t1)
            if gap > LONG_GAP_MS:
                out.append({"possession_id": p.possession_id, "half": p.half, "from_ms": t0,
                            "from": format_ms(t0), "to": format_ms(t1), "live_ms": gap})
    return out


def quality_report(match_data: dict, possessions) -> dict:
    events = match_data.get("events", [])
    final = match_data.get("final_score") or {}
    our_goals = sum(1 for p in possessions if p.team == US for c in p.codes if c in GOAL_CODES)
    their_goals = sum(p.end_type == "opp_goal" for p in possessions if p.team == THEM)

    # one entry per untagged transition: the possession it opened
    inferred = [{"possession_id": p.possession_id, "team": p.team, "half": p.half,
                 "after": format_ms(p.start_ms), "reason": p.start_type}
                for p in possessions if not p.start_exact and p.start_type != "half_start"]
    gaps = long_gaps(possessions)
    unknown = sorted({e["code"] for e in events if e["code"] not in KNOWN_CODES})
    kickoff_known = bool((match_data.get("match") or {}).get("kickoffTeam") in (US, THEM))

    warnings = []
    if final and our_goals != final.get("us"):
        warnings.append(f"our goals {our_goals} != final score {final.get('us')}")
    if final and their_goals != final.get("them"):
        warnings.append(f"inferred opponent goals {their_goals} != final score {final.get('them')}")
    if not kickoff_known:
        warnings.append("kickoff team not recorded: half starts are assumed")
    if unknown:
        warnings.append(f"unknown event codes ignored: {', '.join(unknown)}")
    if inferred:
        warnings.append(f"{len(inferred)} untagged transitions inferred")
    if gaps:
        warnings.append(f"{len(gaps)} long gaps (> {LONG_GAP_MS // 1000}s) inside our possessions")

    return {
        "ok": not warnings,
        "warnings": warnings,
        "score_check": {"our_goals": our_goals, "their_goals": their_goals, "final_score": final},
        "kickoff_known": kickoff_known,
        "inferred_transitions": inferred,
        "long_gaps": gaps,
        "unknown_codes": unknown,
    }

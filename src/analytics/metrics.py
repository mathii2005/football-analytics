"""
match metrics built on reconstructed possessions (see possessions.py)

One-team sparse tagging can't give true possession %, so every metric
here says which possessions it trusts:
    exact     : both boundaries tagged (or at a dead ball) - timing OK
    inclusive : every possession; the unknown gap around an untagged
                transition is split evenly between the two sides
Metrics that only need OUR possessions to be well bounded (outcomes,
sequences to shot, couloir value) are the robust ones; possession % is
reported twice with a coverage number so it is never read alone.

DEFINITIONS (change deliberately, tests pin them down)
    zones          : 1 = own end ... 4 = attacking end, "BOX" = their box.
                     Null zone follows the tagger convention (zone 4)
                     for shots, crosses, corners and penalties; our
                     DEGAGEMENT (goal kick) is zone 1; other null-zone
                     set pieces are unknown (previous zone carries on).
    final third    : zone 4 or BOX.
    box entry      : any event tagged in the box (is_box / zone BOX) or
                     a penalty.
    outcome        : one per possession, first match wins:
                     goal > shot > box_entry > cheap_loss > loss_opp_half
                     > loss_own_half > ball_out > unknown
                     cheap_loss    = PERTE less than CHEAP_LOSS_MS of live
                                     time after winning it (exact start)
                     loss_opp_half = PERTE in zone 3/4/BOX
                     loss_own_half = PERTE in zone 1/2
                     ball_out      = ended by an opponent set piece or a
                                     dead ball (goal kick, their throw...)
                     unknown       = untagged end or half end
    shot sequence  : possession with at least one shot (BUT included).
    direct         : reached the box (box entry or shot) within
                     DIRECT_MAX_MS of live time, counted from the start
                     of the possession or from our last set piece before
                     the box if there was one (a restart resets tempo,
                     and the dead ball before it is rarely marked);
                     sustained otherwise. Needs an exact start.
    turnover->shot : live time from RECUP to the first shot of the same
                     possession (exact start only). A set piece between
                     the RECUP and the shot makes it a set-piece shot,
                     not a transition: excluded.
    PPDA-lite      : opponent possessions per RECUP in zone 3/4/BOX.
                     Not Opta PPDA (no opponent passes), but lower still
                     means a more aggressive high press.
    field tilt     : share of our live possession time spent in the
                     final third. Time between two events belongs to the
                     zone of the earlier one; time with no known zone is
                     left out of the denominator.
    couloir value  : for each couloir (left/center/right), our
                     possessions with at least one event tagged there,
                     and how many reached the box / produced a shot. A
                     possession through two couloirs counts in both.
"""

from statistics import median

from src.analytics.possessions import (
    US, THEM, SHOT_CODES, REGAIN_CODES, GOAL_CODES, SET_PIECE_CODES, overlap_ms,
)

CHEAP_LOSS_MS = 5_000
DIRECT_MAX_MS = 15_000
FINAL_THIRD = {4, "BOX"}
OPP_HALF = {3, 4, "BOX"}
HIGH_PRESS_ZONES = {3, 4, "BOX"}
FINAL_THIRD_NULL_CODES = SHOT_CODES | {"CENTRE", "CORNER", "PENALTY"}
COULOIRS = ("left", "center", "right")
OUTCOMES = ("goal", "shot", "box_entry", "cheap_loss", "loss_opp_half",
            "loss_own_half", "ball_out", "unknown")


# ── per-event helpers ──────────────────────────────────────────────

def field_zone(event: dict):
    """Where on the pitch the event happened, or None if unknown."""
    zone = event.get("zone")
    if zone is not None:
        return zone
    if event["code"] == "DEGAGEMENT":
        return 1 if event.get("team") != THEM else 4
    if event["code"] in FINAL_THIRD_NULL_CODES:
        return 4
    return None


def is_box_event(event: dict) -> bool:
    return bool(event.get("is_box")) or event.get("zone") == "BOX" or event["code"] == "PENALTY"


def live_between(p, t0: float, t1: float) -> float:
    return (t1 - t0) - overlap_ms(t0, t1, p.stoppages)


# ── per-possession ─────────────────────────────────────────────────

def first_time(p, predicate):
    for e in p.events:
        if predicate(e):
            return e["timestamp_ms"]
    return None


def time_to_shot_ms(p):
    if not p.start_exact or p.start_type != "recup":
        return None
    for e in p.events:
        if e["code"] in SET_PIECE_CODES:
            return None     # set-piece shot, not a transition
        if e["code"] in SHOT_CODES:
            return live_between(p, p.start_ms, e["timestamp_ms"])
    return None


def time_to_box_ms(p):
    """Live time from the start (or our last set piece) to the box."""
    if not p.start_exact:
        return None
    t0 = p.start_ms
    for e in p.events:
        if is_box_event(e) or e["code"] in SHOT_CODES:
            return live_between(p, t0, e["timestamp_ms"])
        if e["code"] in SET_PIECE_CODES:
            t0 = e["timestamp_ms"]
    return None


def reached_box(p) -> bool:
    return any(is_box_event(e) or e["code"] in SHOT_CODES for e in p.events)


def outcome(p) -> str:
    codes = set(p.codes)
    if codes & GOAL_CODES:
        return "goal"
    if codes & SHOT_CODES:
        return "shot"
    if any(is_box_event(e) for e in p.events):
        return "box_entry"
    if p.end_type == "perte":
        if p.duration_ms is not None and p.duration_ms < CHEAP_LOSS_MS:
            return "cheap_loss"
        return "loss_opp_half" if p.end_zone in OPP_HALF else "loss_own_half"
    if p.end_type in ("opp_set_piece", "stoppage"):
        return "ball_out"
    return "unknown"


def style(p):
    """direct / sustained for possessions that reached the box, else None."""
    if not reached_box(p):
        return None
    t = time_to_box_ms(p)
    if t is None:
        return "unknown"
    return "direct" if t <= DIRECT_MAX_MS else "sustained"


def zone_time_ms(p) -> dict:
    """Live ms per zone inside the possession (zone None = unknown)."""
    out: dict = {}
    zone = p.start_zone
    t = p.start_ms
    for e in p.events:
        out[zone] = out.get(zone, 0.0) + live_between(p, t, e["timestamp_ms"])
        t = e["timestamp_ms"]
        zone = field_zone(e) if field_zone(e) is not None else zone
    out[zone] = out.get(zone, 0.0) + live_between(p, t, p.end_ms)
    return out


def couloirs(p) -> set:
    return {e["couloir"] for e in p.events if e.get("couloir") in COULOIRS}


def possession_row(p) -> dict:
    zt = zone_time_ms(p)
    row = p.to_dict()
    row.update(
        outcome=outcome(p) if p.team == US else None,
        reached_box=reached_box(p),
        style=style(p) if p.team == US else None,
        time_to_box_ms=time_to_box_ms(p),
        time_to_shot_ms=time_to_shot_ms(p),
        final_third_ms=sum(v for z, v in zt.items() if z in FINAL_THIRD),
        known_zone_ms=sum(v for z, v in zt.items() if z is not None),
        couloirs=" ".join(sorted(couloirs(p))),
        shot_ms=[e["timestamp_ms"] for e in p.events if e["code"] in SHOT_CODES and e["code"] not in GOAL_CODES],
        goal_ms=[e["timestamp_ms"] for e in p.events if e["code"] in GOAL_CODES],
        event_ids=" ".join(str(i) for i in p.event_ids),
        codes=" ".join(p.codes),
    )
    return row


# ── match level ────────────────────────────────────────────────────

def share(part, whole):
    return part / whole if whole else None


def possession_share(possessions) -> dict:
    """strict: exact possessions only. inclusive: everything, with the
    unknown gap around each untagged transition split evenly between
    the two sides (the change is equally likely anywhere in the gap)."""
    live = {id(p): p.live_ms for p in possessions}
    for a, b in zip(possessions, possessions[1:]):
        if a.half != b.half or b.start_exact:
            continue
        # b's start is only a bound: the change happened between a's last
        # known moment and b's first event
        gap_end = b.events[0]["timestamp_ms"] if b.events else b.end_ms
        gap = live_between(b, b.start_ms, gap_end)
        live[id(b)] -= gap / 2
        live[id(a)] += gap / 2

    def split(ps, times):
        us = sum(times[id(p)] for p in ps if p.team == US)
        them = sum(times[id(p)] for p in ps if p.team == THEM)
        return us, them

    exact = [p for p in possessions if not p.is_inferred]
    us_x, them_x = split(exact, {id(p): p.live_ms for p in exact})
    us_all, them_all = split(possessions, live)
    return {
        "strict": share(us_x, us_x + them_x),
        "inclusive": share(us_all, us_all + them_all),
        "coverage": share(us_x + them_x, us_all + them_all),  # live time that is exact
    }


def match_metrics(possessions) -> dict:
    ours = [p for p in possessions if p.team == US]
    theirs = [p for p in possessions if p.team == THEM]
    n = len(ours)

    outcomes = {o: 0 for o in OUTCOMES}
    for p in ours:
        outcomes[outcome(p)] += 1

    shot_seq = [p for p in ours if p.codes and set(p.codes) & SHOT_CODES]
    to_shot = [t for t in (time_to_shot_ms(p) for p in ours) if t is not None]
    styles = [style(p) for p in ours]

    high_recups = sum(1 for p in ours for e in p.events
                      if e["code"] in REGAIN_CODES and e.get("zone") in HIGH_PRESS_ZONES)

    zone_times = [zone_time_ms(p) for p in ours]
    final_third = sum(v for zt in zone_times for z, v in zt.items() if z in FINAL_THIRD)
    known = sum(v for zt in zone_times for z, v in zt.items() if z is not None)

    by_couloir = {}
    for c in COULOIRS:
        through = [p for p in ours if c in couloirs(p)]
        by_couloir[c] = {
            "possessions": len(through),
            "box_rate": share(sum(reached_box(p) for p in through), len(through)),
            "shot_rate": share(sum(bool(set(p.codes) & SHOT_CODES) for p in through), len(through)),
        }

    return {
        "possessions_us": n,
        "possessions_them": len(theirs),
        "inferred_boundaries": sum(p.is_inferred for p in possessions),
        "possession_pct": possession_share(possessions),
        "shot_sequences": len(shot_seq),
        "shot_sequence_rate": share(len(shot_seq), n),
        "ppda_lite": share(len(theirs), high_recups),
        "high_recups": high_recups,
        "turnover_to_shot_ms": {"n": len(to_shot), "median": median(to_shot) if to_shot else None},
        "outcomes": outcomes,
        "outcome_rates": {o: share(k, n) for o, k in outcomes.items()},
        "direct": styles.count("direct"),
        "sustained": styles.count("sustained"),
        "field_tilt": share(final_third, known),
        "couloirs": by_couloir,
    }


# ── output ─────────────────────────────────────────────────────────

def pct(x):
    return "  n/a" if x is None else f"{x * 100:4.0f}%"


def print_metrics(m: dict) -> None:
    pp = m["possession_pct"]
    print(f"possessions      us {m['possessions_us']} / them {m['possessions_them']}  "
          f"({m['inferred_boundaries']} with inferred boundaries)")
    print(f"possession %     strict {pct(pp['strict'])}  inclusive {pct(pp['inclusive'])}  "
          f"(exact coverage {pct(pp['coverage'])})")
    print(f"shot sequences   {m['shot_sequences']} ({pct(m['shot_sequence_rate'])} of our possessions)")
    tts = m["turnover_to_shot_ms"]
    med = f"{tts['median'] / 1000:.1f}s" if tts["median"] is not None else "n/a"
    print(f"recup -> shot    median {med} (n={tts['n']})")
    ppda = f"{m['ppda_lite']:.2f}" if m["ppda_lite"] is not None else "n/a"
    print(f"PPDA-lite        {ppda} opp possessions per high recup ({m['high_recups']} high recups)")
    print(f"direct/sustained {m['direct']} / {m['sustained']}")
    print(f"field tilt       {pct(m['field_tilt'])} of our possession time in final third")
    print("outcomes         " + "  ".join(
        f"{o} {m['outcomes'][o]} ({pct(m['outcome_rates'][o]).strip()})" for o in OUTCOMES if m["outcomes"][o]))
    print("couloirs")
    for c, v in m["couloirs"].items():
        print(f"  {c:<7} n={v['possessions']:<3} box {pct(v['box_rate'])}  shot {pct(v['shot_rate'])}")


def write_outputs(possessions, metrics: dict, name: str, out_dir="data/processed"):
    import json
    from pathlib import Path
    import pandas as pd

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    pd.DataFrame([possession_row(p) for p in possessions]).to_csv(out / f"{name}_possessions.csv", index=False)
    (out / f"{name}_metrics.json").write_text(json.dumps(metrics, indent=2))
    return out / f"{name}_possessions.csv", out / f"{name}_metrics.json"


if __name__ == "__main__":
    import argparse
    import json
    from pathlib import Path
    from src.ingestion.load_match import load_match
    from src.analytics.possessions import possessions_from_match

    parser = argparse.ArgumentParser()
    parser.add_argument("match", nargs="?", default="match_001", help="match id in data/raw, or a JSON path")
    parser.add_argument("--kickoff", choices=[US, THEM], help="who kicked off half 1 (overrides match metadata)")
    parser.add_argument("--write", action="store_true", help="write CSV + JSON to data/processed/")
    args = parser.parse_args()

    path = Path(args.match)
    match = json.loads(path.read_text()) if path.is_file() else load_match(args.match)
    if args.kickoff:
        match["match"]["kickoffTeam"] = args.kickoff
    name = path.stem if path.is_file() else args.match

    ps = possessions_from_match(match, name)
    m = match_metrics(ps)
    print_metrics(m)
    if args.write:
        for f in write_outputs(ps, m, name):
            print(f"wrote {f}")

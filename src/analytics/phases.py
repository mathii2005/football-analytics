"""
phases - what the possession engine adds on top of event counts

All durations are live time (tagged stoppages excluded). A possession
whose start or end boundary was inferred has no duration: it is counted
in `n` but left out of every duration statistic (`n_timed`).

DEFINITIONS (new - owned by the staff, change deliberately)
    periods          : 15-minute bins per half on the match clock: 0-15,
                       15-30, 30-45+ and 45-60, 60-75, 75-90+ (stoppage
                       time falls in the last bin of its half). A
                       possession's live time is split across the bins it
                       overlaps.
    game state       : at the start of the possession, from score_us -
                       score_them: "menée" (< 0), "égalité" (0), "en
                       avance" (> 0).
    histogram bins   : 0-5, 5-10, 10-20, 20-40, 40+ seconds of live time.
    start type       : recup, set_piece, kickoff, other.
    start zone       : zone of the RECUP, or the field zone of the set
                       piece that started the possession.
    recovery value   : for recoveries in each zone, share whose possession
                       reached the box, share with a shot, share lost again
                       in less than CHEAP_LOSS_MS.
    counter-press    : after each of our PERTE (exact), the opponent
                       possession it opens; we "regain" when that possession
                       ends exactly on our recovery or our set piece, and the
                       regain time is its live duration. Losses followed by
                       an opponent goal, a half end or an inferred boundary
                       are "not regained" (they count against within_5s /
                       within_10s and are left out of the median).
    high regain      : opponent possession ended by one of our recoveries
                       in zone 3, 4 or the box.
    regain curve     : for t = 0..REGAIN_CURVE_S seconds, the share of our
                       (exact) losses not yet regained after t seconds;
                       not-regained losses stay in the numerator. Zones:
                       "own" (1-2), "3", "4" (4 and box).
    flow             : our possessions from start group (recovery zone 1-2,
                       recovery zone 3+, set piece, kickoff, other) to outcome
                       group (goal/shot, box, cheap loss, loss in their half,
                       loss in our half, ball out, unknown).
    tempo            : our tagged actions (ACTION_CODES, shots included)
                       per live minute of our possession.
"""

from statistics import median

from src.analytics.metrics import (
    CHEAP_LOSS_MS, HIGH_PRESS_ZONES, field_zone, live_between, match_metrics, outcome,
    possession_share, reached_box, share,
)
from src.analytics.possessions import (
    US, THEM, ACTION_CODES, SHOT_CODES, half_start_ms, stoppage_spans,
)

PERIOD_MIN = 15
HIST_BINS = [(0, 5, "0–5 s"), (5, 10, "5–10 s"), (10, 20, "10–20 s"), (20, 40, "20–40 s"), (40, None, "40 s+")]
STATES = ("menée", "égalité", "en avance")
START_TYPES = ("recup", "set_piece", "kickoff", "other")
REGAIN_FAST_MS = 5_000
REGAIN_MS = 10_000
REGAIN_CURVE_S = 60
FLOW_START = {"recup_low": "Récup Z1–2", "recup_high": "Récup Z3–surface", "set_piece": "CPA",
              "kickoff": "Engagement", "other": "Autre"}
FLOW_END = {"goal": "But / tir", "shot": "But / tir", "box_entry": "Surface", "cheap_loss": "Perte rapide",
            "loss_opp_half": "Perte leur ½", "loss_own_half": "Perte notre ½", "ball_out": "Sortie",
            "unknown": "Inconnu"}
ZONES = (1, 2, 3, 4, "BOX")


def state_of(p) -> str:
    d = p.score_us - p.score_them
    return "menée" if d < 0 else "égalité" if d == 0 else "en avance"


def start_group(p) -> str:
    return p.start_type if p.start_type in ("recup", "set_piece", "kickoff") else "other"


def histogram(durations_ms) -> list[dict]:
    rows = []
    for lo, hi, label in HIST_BINS:
        rows.append({"bin": label, "n": sum(1 for d in durations_ms
                                            if d >= lo * 1000 and (hi is None or d < hi * 1000))})
    return rows


# ── splits ─────────────────────────────────────────────────────────

def period_bins(events, half):
    start = half_start_ms([e for e in events if e["half"] == half], half)
    base = int(start // 60_000)
    bins = []
    for k in range(3):
        lo = start + k * PERIOD_MIN * 60_000
        hi = start + (k + 1) * PERIOD_MIN * 60_000 if k < 2 else float("inf")
        label = f"{base + k * PERIOD_MIN}–{base + (k + 1) * PERIOD_MIN}" + ("+" if k == 2 else "")
        bins.append((label, lo, hi))
    return bins


def live_in(p, lo, hi) -> float:
    a, b = max(p.start_ms, lo), min(p.end_ms, hi)
    return live_between(p, a, b) if b > a else 0.0


def shares(ps_times) -> dict:
    """ps_times: [(possession, live_ms)] -> strict / inclusive share for us."""
    def ratio(items):
        us = sum(t for p, t in items if p.team == US)
        tot = sum(t for _, t in items)
        return share(us, tot)
    return {"strict": ratio([(p, t) for p, t in ps_times if not p.is_inferred]),
            "inclusive": ratio(ps_times)}


def splits(events, ps) -> dict:
    by_half = [{"half": h, **{k: v for k, v in possession_share([p for p in ps if p.half == h]).items()
                             if k in ("strict", "inclusive")}}
               for h in sorted({p.half for p in ps})]
    by_period = []
    for h in sorted({p.half for p in ps}):
        hp = [p for p in ps if p.half == h]
        for label, lo, hi in period_bins(events, h):
            by_period.append({"half": h, "label": label, **shares([(p, live_in(p, lo, hi)) for p in hp])})
    by_state = []
    for s in STATES:
        sp = [p for p in ps if state_of(p) == s]
        by_state.append({"state": s, "strict": shares([(p, p.live_ms) for p in sp])["strict"],
                         "n_us": sum(p.team == US for p in sp), "n_them": sum(p.team == THEM for p in sp)})
    return {"by_half": by_half, "by_period": by_period, "by_state": by_state}


# ── profile & progression ──────────────────────────────────────────

def team_profile(ps, team) -> dict:
    mine = [p for p in ps if p.team == team]
    timed = [p.duration_ms for p in mine if p.duration_ms is not None]
    return {"n": len(mine), "n_timed": len(timed),
            "median_ms": median(timed) if timed else None, "max_ms": max(timed) if timed else None,
            "histogram": histogram(timed)}


def start_zone(p):
    if p.start_type == "recup":
        return p.start_zone
    if p.start_type == "set_piece" and p.events:
        return field_zone(p.events[0])
    return None


def progression(ps) -> dict:
    ours = [p for p in ps if p.team == US]
    matrix = {}
    for p in ours:
        z = start_zone(p)
        if z is not None:
            key = (str(z), outcome(p))
            matrix[key] = matrix.get(key, 0) + 1
    value = []
    for z in ZONES:
        rec = [p for p in ours if p.start_type == "recup" and p.start_zone == z]
        value.append({
            "zone": str(z), "n": len(rec),
            "box_rate": share(sum(reached_box(p) for p in rec), len(rec)),
            "shot_rate": share(sum(bool(set(p.codes) & SHOT_CODES) for p in rec), len(rec)),
            "quick_loss_rate": share(sum(p.end_type == "perte" and p.duration_ms is not None
                                         and p.duration_ms < CHEAP_LOSS_MS for p in rec), len(rec)),
        })
    return {"start_zone_x_outcome": [{"zone": z, "outcome": o, "n": n} for (z, o), n in sorted(matrix.items())],
            "recovery_value": value}


# ── counter-press & defence ────────────────────────────────────────

def regain_ms(ps, i):
    """Live time from our loss (possession i) to winning the ball back, or
    None when it was not regained cleanly (see module definitions)."""
    p = ps[i]
    if p.team != US or p.end_type != "perte" or not p.end_exact:
        return None
    if i + 1 >= len(ps) or ps[i + 1].half != p.half:
        return None
    nxt = ps[i + 1]
    if nxt.team != THEM or not nxt.end_exact or nxt.end_type not in ("recup", "set_piece"):
        return None
    return nxt.live_ms


def counter_press(ps) -> dict:
    losses = [(i, p) for i, p in enumerate(ps) if p.team == US and p.end_type == "perte" and p.end_exact]

    def summary(items):
        times = [regain_ms(ps, i) for i, _ in items]
        timed = [t for t in times if t is not None]
        return {"n": len(items), "n_timed": len(timed),
                "median_regain_ms": median(timed) if timed else None,
                "within_5s": share(sum(t <= REGAIN_FAST_MS for t in timed), len(items)),
                "within_10s": share(sum(t <= REGAIN_MS for t in timed), len(items))}

    total = summary(losses)
    return {"n_losses": total["n"], "n_timed": total["n_timed"],
            "median_regain_ms": total["median_regain_ms"],
            "within_5s": total["within_5s"], "within_10s": total["within_10s"],
            "by_zone": [{"zone": str(z), **summary([(i, p) for i, p in losses if p.end_zone == z])} for z in ZONES]}


def loss_zone_group(z):
    return "own" if z in (1, 2) else "3" if z == 3 else "4" if z in (4, "BOX") else None


def regain_curve(ps) -> dict:
    losses = [(i, p) for i, p in enumerate(ps) if p.team == US and p.end_type == "perte" and p.end_exact]
    t = list(range(REGAIN_CURVE_S + 1)) if losses else []

    def curve(items):
        times = [regain_ms(ps, i) for i, _ in items]
        if not items:
            return []
        return [sum(1 for r in times if r is None or r > s * 1000) / len(items) for s in t]

    groups = {g: [(i, p) for i, p in losses if loss_zone_group(p.end_zone) == g] for g in ("own", "3", "4")}
    return {"t": t, "overall": curve(losses), "by_zone": {g: curve(v) for g, v in groups.items()},
            "n": {"overall": len(losses), **{g: len(v) for g, v in groups.items()}}}


def flow(ps) -> dict:
    counts = {}
    for p in ps:
        if p.team != US:
            continue
        if p.start_type == "recup":
            start = "recup_high" if p.start_zone in HIGH_PRESS_ZONES else "recup_low"
        else:
            start = start_group(p)
        key = (FLOW_START[start], FLOW_END[outcome(p)])
        counts[key] = counts.get(key, 0) + 1
    names = list(dict.fromkeys(list(FLOW_START.values()) + list(FLOW_END.values())))
    used = sorted({n for k in counts for n in k}, key=names.index)
    idx = {n: i for i, n in enumerate(used)}
    return {"nodes": [{"name": n} for n in used],
            "links": [{"source": idx[a], "target": idx[b], "value": v} for (a, b), v in counts.items()]}


def defence(ps) -> dict:
    theirs = [(i, p) for i, p in enumerate(ps) if p.team == THEM]
    timed = [p.duration_ms for _, p in theirs if p.duration_ms is not None]
    high = sum(1 for i, p in theirs if p.end_type == "recup" and i + 1 < len(ps)
               and ps[i + 1].start_zone in HIGH_PRESS_ZONES)
    return {"n": len(theirs), "median_opp_ms": median(timed) if timed else None,
            "histogram": histogram(timed),
            "ended_by_high_recup_share": share(high, len(theirs)),
            "ppda_lite": match_metrics(ps)["ppda_lite"] if ps else None}


# ── finishing & game time ──────────────────────────────────────────

def finishing(ps) -> dict:
    ours = [p for p in ps if p.team == US]
    shots = sum(p.n_shots for p in ours)
    by_start = [{"start": s, "n": sum(start_group(p) == s for p in ours),
                 "shot_seq": sum(start_group(p) == s and p.n_shots > 0 for p in ours)} for s in START_TYPES]
    return {"shots_per_possession": share(shots, len(ours)),
            "possessions_per_shot": share(len(ours), shots),
            "shot_sequences_by_start": by_start}


def game_time(events, ps) -> dict:
    dead = sum(e - s for h in {x["half"] for x in events}
               for s, e in stoppage_spans([x for x in events if x["half"] == h]))
    ours = [p for p in ps if p.team == US]
    our_live = sum(p.live_ms for p in ours)
    actions = sum(1 for p in ours for c in p.codes if c in ACTION_CODES)
    return {"live_ms": sum(p.live_ms for p in ps), "dead_ms": dead,
            "actions_per_live_min": share(actions, our_live / 60_000) if our_live else None}


def phases_report(match_data: dict, possessions) -> dict:
    events = match_data.get("events", [])
    ours = [p for p in possessions if p.team == US]
    start_x_outcome = {}
    for p in ours:
        k = (start_group(p), outcome(p))
        start_x_outcome[k] = start_x_outcome.get(k, 0) + 1
    return {
        "splits": splits(events, possessions),
        "profile": {"us": team_profile(possessions, US), "them": team_profile(possessions, THEM),
                    "start_x_outcome": [{"start": s, "outcome": o, "n": n}
                                        for (s, o), n in sorted(start_x_outcome.items())]},
        "progression": progression(possessions),
        "counter_press": counter_press(possessions),
        "defence": defence(possessions),
        "finishing": finishing(possessions),
        "game_time": game_time(events, possessions),
        "regain_curve": regain_curve(possessions),
        "flow": flow(possessions),
        "durations": {"us": [p.duration_ms for p in possessions if p.team == US and p.duration_ms is not None],
                      "them": [p.duration_ms for p in possessions if p.team == THEM and p.duration_ms is not None]},
    }

"""
timeline - minute-by-minute series for the match-story chart

DEFINITIONS
    threat        : per minute, the classic threat score of our events
                    (classic.event_threat), minute = floor(clock / 60 s).
    threat_smooth : each minute's threat spread over the minutes of the same
                    half with a Gaussian kernel (sigma SMOOTH_SIGMA_MIN),
                    weights renormalised per source minute so the total is
                    preserved exactly.
    poss_share    : our share of live possession time in a window of
                    POSS_WINDOW_MIN centred on the minute (inclusive: every
                    possession at its bounds); None when no live time.
    events        : our goals (BUT), opponent goals (possession ending
                    opp_goal, at its end bound), cards, and half-time (first
                    minute of half 2).
"""

from math import exp

from src.analytics.classic import event_threat, CARD_CODES
from src.analytics.metrics import live_between
from src.analytics.possessions import US, THEM, GOAL_CODES, half_start_ms

SMOOTH_SIGMA_MIN = 2.5
POSS_WINDOW_MIN = 5


def smooth(values, sigma=SMOOTH_SIGMA_MIN):
    out = [0.0] * len(values)
    for i, v in enumerate(values):
        if not v:
            continue
        w = [exp(-((j - i) ** 2) / (2 * sigma ** 2)) for j in range(len(values))]
        tot = sum(w)
        for j, wj in enumerate(w):
            out[j] += v * wj / tot
    return out


def poss_share(possessions, lo_ms, hi_ms):
    us = them = 0.0
    for p in possessions:
        a, b = max(p.start_ms, lo_ms), min(p.end_ms, hi_ms)
        if b <= a:
            continue
        t = live_between(p, a, b)
        if p.team == US:
            us += t
        else:
            them += t
    return us / (us + them) if us + them else None


def match_timeline(match_data: dict, possessions) -> dict:
    events = match_data.get("events", [])
    minutes, marks = [], []
    for half in sorted({e["half"] for e in events}):
        ev = [e for e in events if e["half"] == half]
        start = int(half_start_ms(ev, half) // 60_000)
        end = int(max(e["timestamp_ms"] for e in ev) // 60_000)
        span = list(range(start, end + 1))
        threat = [0] * len(span)
        for e in ev:
            threat[int(e["timestamp_ms"] // 60_000) - start] += event_threat(e)
        sm = smooth(threat)
        hp = [p for p in possessions if p.half == half]
        for k, m in enumerate(span):
            c = (m + 0.5) * 60_000
            half_w = POSS_WINDOW_MIN / 2 * 60_000
            minutes.append({"half": half, "minute": m, "threat": threat[k], "threat_smooth": round(sm[k], 3),
                            "poss_share": poss_share(hp, c - half_w, c + half_w)})
        if half > 1:
            marks.append({"half": half, "minute": start, "kind": "half", "team": None, "code": None})
        for e in ev:
            m = int(e["timestamp_ms"] // 60_000)
            if e["code"] in GOAL_CODES and e.get("team") != THEM:
                marks.append({"half": half, "minute": m, "kind": "goal", "team": US, "code": e["code"]})
            elif e["code"] in CARD_CODES:
                marks.append({"half": half, "minute": m, "kind": "card", "team": THEM if e.get("team") == THEM else US,
                              "code": e["code"]})
        for p in hp:
            if p.end_type == "opp_goal":
                marks.append({"half": half, "minute": int(p.end_ms // 60_000), "kind": "goal", "team": THEM, "code": "BUT"})
    marks.sort(key=lambda x: (x["half"], x["minute"]))
    return {"minutes": minutes, "events": marks}

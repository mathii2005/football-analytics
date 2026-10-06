"""
details - the breakdowns behind the dashboard tiles (PIPELINE §7.2) that are
lists or counts rather than catalogue metrics. Tag errors are left out like in
the metrics (metrics.without_tag_errors).

    shots           every shot: team, time, outcome, xG, card answers, phase
    shot_origin     shots per assist answer, per team (UNREVIEWED if no card)
    shot_loc        shots per location answer, per team
    opp_entries     opponent entries into our box: lanes and methods (OPP_ENTRY cards)
    closing         our losses in their half by players closing within 3 s
    losses_to_shots our losses followed by their shot within 20 s, ball kept
    set_pieces      restarts per type and half of the pitch, and how many led to a shot (20 s)
    load            live presses per 15 minutes of each half (tagging load)
"""

from collections import Counter

from src.v1.answers import answer_for
from src.v1.metrics import without_tag_errors, Ctx
from src.v1.models import shot_xg

LIVE = ("US", "THEM")
BLOCK_MS = 15 * 60000
SP_TYPES = ("CORNER", "FK", "THROW", "PEN", "GK", "KICKOFF")


def match_details(tl, lab, answers, roots, meta, ops) -> dict:
    tl, lab = without_tag_errors(tl, lab, answers, roots)
    ctx = Ctx(tl, lab, answers, roots, meta)
    ans = lambda kind, seq: answer_for(answers, roots, kind, seq)   # noqa: E731

    def kept(team, half, t0, t1):
        return all(s.state == team for s in tl.states if s.half == half and s.end > t0 and s.start < t1)

    shots = []
    for s in tl.shots:
        a = ans("GOAL" if s.v == "GOAL" else "SHOT", s.seq) or {}
        xg, est = shot_xg(s, a)
        shots.append({"team": s.team, "half": s.half, "t": s.t, "v": s.v, "xg": round(xg, 3), "estimated": est,
                      "loc": a.get("loc"), "body": a.get("body"), "situation": a.get("situation"), "assist": a.get("assist"),
                      "phase": ctx.phase_at(s.team, s.half, s.t) or ctx.phase_at(s.team, s.half, s.t - 1),   # a goal closes its phase
                      "band": s.band, "reviewed": bool(a)})
    origin = {t: dict(Counter(x["assist"] if x["reviewed"] and x["assist"] else "UNREVIEWED" for x in shots if x["team"] == t)) for t in LIVE}
    locs = {t: dict(Counter(x["loc"] or "UNREVIEWED" for x in shots if x["team"] == t)) for t in LIVE}

    opp = [ans("OPP_ENTRY", e.seq) for e in lab.entries if e.team == "THEM" and e.kind == "box"]
    opp_answered = [a for a in opp if a]
    opp_entries = {"n": len(opp), "answered": len(opp_answered),
                   "lanes": dict(Counter(a["lane"] for a in opp_answered if a.get("lane") not in (None, "CANT_SEE"))),
                   "methods": dict(Counter(a["method"] for a in opp_answered if a.get("method") not in (None, "CANT_SEE")))}

    closing = {"0": 0, "1": 0, "2": 0, "3PLUS": 0}
    for l in lab.losses:
        c = (ans("LOSS", l.seq) or {}).get("closing_3s")
        if l.band is not None and l.band >= 3 and c in closing:
            closing[c] += 1

    moments = []
    for l in lab.losses:
        if l.team != "US":
            continue
        hit = next((s for s in tl.shots if s.team == "THEM" and s.half == l.half and l.t <= s.t <= l.t + 20000
                    and kept("THEM", l.half, l.t, s.t)), None)
        if hit:
            moments.append({"half": l.half, "t": l.t, "band": l.band, "shot_v": hit.v, "delay_s": round((hit.t - l.t) / 1000, 1)})
    n_losses = sum(1 for l in lab.losses if l.team == "US")

    their_half = {"US": (3, 4, 5), "THEM": (0, 1, 2)}
    set_pieces = {}
    for team in LIVE:
        rows = Counter()
        shot_rows = Counter()
        for r in tl.restarts:
            if r.team != team or r.type not in SP_TYPES:
                continue
            zone = "inconnue" if r.band is None else "leur moitié" if r.band in their_half[team] else "notre moitié"
            rows[(r.type, zone)] += 1
            if any(s.team == team and s.half == r.half and r.t <= s.t <= r.t + 20000 and kept(team, r.half, r.t, s.t) for s in tl.shots):
                shot_rows[(r.type, zone)] += 1
        set_pieces[team] = [{"type": t, "zone": z, "n": n, "shots": shot_rows[(t, z)]} for (t, z), n in sorted(rows.items())]

    load = Counter()
    for o in ops:
        if o.get("auto") or o["k"] in ("H", "CLOCK", "U", "PATCH"):
            continue
        start = tl.halves.get(o["half"], (0, 0))[0]
        load[(o["half"], int(max(0, o["t"] - start) // BLOCK_MS))] += 1

    return {"shots": shots, "shot_origin": origin, "shot_loc": locs, "opp_entries": opp_entries, "closing": closing,
            "losses_to_shots": {"n_losses": n_losses, "n_shots": len(moments), "moments": moments},
            "set_pieces": set_pieces,
            "load": [{"half": h, "block": b, "presses": n, "per_min": round(n / _block_min(tl, h, b), 1)} for (h, b), n in sorted(load.items())]}


def _block_min(tl, half, block):
    """Length of a 15-min block in minutes (the last one of a half is shorter)."""
    start, end = tl.halves.get(half, (0, 0))
    return max(1.0, min(BLOCK_MS, end - start - block * BLOCK_MS) / 60000)

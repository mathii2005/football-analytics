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
    possession_share our share of the live-ball time (US / (US + THEM))
    players         per player (squad numbers from the review): shots, goals, assists, red-zone
                    entries, losses, first presses, set pieces taken; unpressed_losses = losses
                    where nobody pressed
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
                      "band": s.band, "reviewed": bool(a), "shooter": a.get("shooter"), "assister": a.get("assister")})
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

    players, unpressed = _players(tl, lab, ans, meta, shots)
    live = {t: sum(x.end - x.start for x in tl.states if x.state == t) for t in LIVE}
    possession = live["US"] / (live["US"] + live["THEM"]) if live["US"] + live["THEM"] else None
    return {"possession_share": possession, "players": players, "unpressed_losses": unpressed, "duos": _duos(shots),
            "blocks": _blocks(tl, lab, shots), "entry_outcomes": _entry_outcomes(lab, ans), "deliveries": _deliveries(tl, ans),
            "shots": shots, "shot_origin": origin, "shot_loc": locs, "opp_entries": opp_entries, "closing": closing,
            "losses_to_shots": {"n_losses": n_losses, "n_shots": len(moments), "moments": moments},
            "set_pieces": set_pieces,
            "load": [{"half": h, "block": b, "presses": n, "per_min": round(n / _block_min(tl, h, b), 1)} for (h, b), n in sorted(load.items())]}


def _block_min(tl, half, block):
    """Length of a 15-min block in minutes (the last one of a half is shorter)."""
    start, end = tl.halves.get(half, (0, 0))
    return max(1.0, min(BLOCK_MS, end - start - block * BLOCK_MS) / 60000)


PLAYER_FIELDS = ("shots", "goals", "assists", "entries", "entries_to_danger", "losses", "first_presses", "reactions", "set_pieces")
NOBODY = (None, "", "NONE", "CANT_SEE")


def _players(tl, lab, ans, meta, shots):
    """Who did what, from the review answers (tag errors already left out of tl / lab).
    xg = xG of their shots, xa = xG of the shots they set up, entries_to_danger =
    entries followed by a shot or a box entry within 15 s, reactions = losses where
    the player who lost the ball was the first to press, minutes from the lineup."""
    names = {p["num"]: p["name"] for p in (meta or {}).get("roster") or []}
    rows = {}

    def row(num):
        return rows.setdefault(str(num), {"num": str(num), "name": names.get(str(num)), "xg": 0.0, "xa": 0.0, "loss_causes": {},
                                          **{f: 0 for f in PLAYER_FIELDS}})

    def add(num, field, by=1):
        if num not in NOBODY:
            row(num)[field] += by

    for x in shots:
        if x["team"] != "US":
            continue
        add(x["shooter"], "shots"); add(x["shooter"], "xg", x["xg"])
        if x["v"] == "GOAL":
            add(x["shooter"], "goals")
        add(x["assister"], "assists"); add(x["assister"], "xa", x["xg"])
    for seq in {e.seq for e in lab.entries if e.team == "US"}:      # one press 3 -> 5 is both kinds: count it once
        a = ans("ENTRY", seq) or {}
        add(a.get("entry_player"), "entries")
        if a.get("outcome_15s") in ("SHOT", "BOX_ENTRY"):
            add(a.get("entry_player"), "entries_to_danger")
    unpressed = 0
    for l in lab.losses:
        a = ans("LOSS", l.seq) or {}
        who, presser = a.get("lost_by"), a.get("first_presser")
        add(who, "losses"); add(presser, "first_presses")
        if who not in NOBODY and who == presser:
            add(who, "reactions")
        if who not in NOBODY and a.get("cause") not in (None, "CANT_SEE"):
            causes = row(who)["loss_causes"]; causes[a["cause"]] = causes.get(a["cause"], 0) + 1
        unpressed += presser == "NONE"
    for r in tl.restarts:
        if r.team == "US" and r.rseq is not None:
            add((ans("SET_PIECE", r.rseq) or {}).get("sp_taker"), "set_pieces")
    minutes = _minutes(tl, (meta or {}).get("lineup"))
    for num, m in minutes.items():
        row(num)["minutes"] = m
    for r in rows.values():
        r["xg"], r["xa"] = round(r["xg"], 3), round(r["xa"], 3)
        r.setdefault("minutes", None)
    return sorted(rows.values(), key=lambda r: int(r["num"]) if r["num"].isdigit() else 999), unpressed


def _minutes(tl, lineup):
    """Minutes on the pitch from the lineup: starters from the start, substitutions at (half, t)."""
    if not lineup or not lineup.get("starters"):
        return {}
    on = {str(n): (min(tl.halves), tl.halves[min(tl.halves)][0]) for n in lineup["starters"]}
    total = {}

    def played(num, until_half, until_t):
        h0, t0 = on.pop(num)
        m = 0.0
        for h, (a, b) in tl.halves.items():
            lo = t0 if h == h0 else a
            hi = until_t if h == until_half else b
            if h0 <= h <= until_half and hi > lo:
                m += (hi - lo) / 60000
        total[num] = round(total.get(num, 0) + m, 1)

    for sub in sorted(lineup.get("subs") or [], key=lambda x: (x["half"], x["t"])):
        if str(sub["out"]) in on:
            played(str(sub["out"]), sub["half"], sub["t"])
        on[str(sub["in"])] = (sub["half"], sub["t"])
    last = max(tl.halves)
    for num in list(on):
        played(num, last, tl.halves[last][1])
    return total


def _duos(shots):
    pairs = {}
    for x in shots:
        if x["team"] == "US" and x["shooter"] not in NOBODY and x["assister"] not in NOBODY:
            p = pairs.setdefault((x["assister"], x["shooter"]), {"from": x["assister"], "to": x["shooter"], "shots": 0, "goals": 0, "xg": 0.0})
            p["shots"] += 1; p["goals"] += x["v"] == "GOAL"; p["xg"] += x["xg"]
    for p in pairs.values():
        p["xg"] = round(p["xg"], 3)
    return sorted(pairs.values(), key=lambda p: (-p["xg"], p["from"]))


def _blocks(tl, lab, shots):
    """Per 15 minutes of each half: shots and xG per team, our red-zone entries, possession share."""
    out = []
    for h, (a, b) in sorted(tl.halves.items()):
        k = 0
        while a + k * BLOCK_MS < b:
            lo, hi = a + k * BLOCK_MS, min(b, a + (k + 1) * BLOCK_MS)
            sel = [x for x in shots if x["half"] == h and lo <= x["t"] < hi]
            live = {t: sum(max(0, min(s.end, hi) - max(s.start, lo)) for s in tl.states if s.half == h and s.state == t) for t in LIVE}
            ent = {e.seq for e in lab.entries if e.team == "US" and e.half == h and lo <= e.t < hi}
            start = (45 if h == 2 else 0) + 15 * k
            out.append({"half": h, "block": k, "start_min": start, "stoppage": start >= (90 if h == 2 else 45),
                        "shots": {t: sum(1 for x in sel if x["team"] == t) for t in LIVE},
                        "xg": {t: round(sum(x["xg"] for x in sel if x["team"] == t), 3) for t in LIVE},
                        "entries": len(ent),
                        "possession": round(live["US"] / (live["US"] + live["THEM"]), 3) if live["US"] + live["THEM"] else None})
            k += 1
    return out


def _entry_outcomes(lab, ans):
    c = Counter()
    for seq in {e.seq for e in lab.entries if e.team == "US"}:
        o = (ans("ENTRY", seq) or {}).get("outcome_15s")
        if o not in (None, "CANT_SEE"):
            c[o] += 1
    return dict(c)


def _deliveries(tl, ans):
    out = {t: {} for t in LIVE}
    for r in tl.restarts:
        a = ans("SET_PIECE", r.rseq) if r.rseq is not None else None
        if not a or a.get("delivery") in (None, "CANT_SEE"):
            continue
        d = out[r.team].setdefault(a["delivery"], {"n": 0, "won": 0})
        d["n"] += 1; d["won"] += a.get("first_contact") == r.team
    return out

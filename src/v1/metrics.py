"""
metrics - the catalogue of CODEBOOK §8, computed from the timeline, the labels
and the review answers. Every metric returns
    {id, label_fr, group, unit, direction, value, n, coverage, label, status,
     clips: {typical, extreme, all}}
with the formula in the codebook (shared/codebook.v1.json "metrics").

Shared rules
    possession minutes  US (THEM) live time, UNKNOWN excluded.
    team of a flag      like a shot: the zone (bands 3-5 us, 0-2 them).
    min n               numeric thresholds apply per match ("20 losses",
                        "15 each"); "N matches" thresholds are for the season
                        view and do not hide a single match.
    coverage            for judged metrics: answered / eligible cards.
                        >= 80 % normal, 50-80 % "partiel", < 50 % value hidden.
    clips               every moment behind the number (Veo, 5 s lead);
                        weighted moments (xG, xT gain): "typical" = the 3 closest
                        to the median, "extreme" = the 3 heaviest; unweighted
                        moments: a sample of 3 spread over the match ("spread").
"""

import re
from statistics import median

from src.analytics.video import video_url
from src.codebook import load_codebook
from src.v1.answers import answer_for
from src.v1.models import shot_xg, xt_gains

LIVE = ("US", "THEM")
HS = ("HS_L", "HS_R")
LANES = ("L", "HS_L", "C", "HS_R", "R")


def _min_n(spec):
    m = re.match(r"(\d+)\s*(.*)", spec or "")
    if not m or "match" in m.group(2):
        return None
    return int(m.group(1))


class Ctx:
    def __init__(self, tl, lab, answers, roots, meta):
        cb = load_codebook()
        self.cb, self.tl, self.lab = cb, tl, lab
        self.answers, self.roots = answers, roots
        veo = (meta or {}).get("veo") or {}
        self.veo = {"url": veo.get("url"), "offset1": veo.get("offset_h1_ms"), "offset2": veo.get("offset_h2_ms")}
        self.lead = cb["clock"]["clip_lead_ms"]
        self.poss = {s: sum(x.end - x.start for x in tl.states if x.state == s) / 60000 for s in LIVE}
        self.defs = {m["id"]: m for m in cb["metrics"]}

    def ans(self, kind, seq):
        return answer_for(self.answers, self.roots, kind, seq)

    def shot_card(self, s):
        return self.ans("GOAL" if s.v == "GOAL" else "SHOT", s.seq)

    def phase_at(self, team, half, t):
        for p in self.lab.phases:
            if p.team == team and p.half == half and p.start <= t < p.end:
                return p.phase
        return None

    def clip(self, half, t, weight=1.0, what=""):
        return {"half": half, "t": t, "weight": weight, "what": what,
                "url": video_url(self.veo, half, t, lead_ms=self.lead) if self.veo["url"] else None}


def _clips(moments):
    if not moments:
        return {"typical": [], "extreme": [], "all": [], "mode": "spread"}
    ordered = sorted(moments, key=lambda m: (m["half"], m["t"]))
    weights = [m["weight"] for m in moments]
    if len(set(weights)) == 1:          # no weight: a sample spread over the match, no "extremes"
        step = max(1, len(ordered) // 3)
        return {"typical": ordered[::step][:3], "extreme": [], "all": ordered, "mode": "spread"}
    else:
        med = median(weights)
        typical = sorted(moments, key=lambda m: abs(m["weight"] - med))[:3]
        extreme = sorted(moments, key=lambda m: -m["weight"])[:3]
    return {"typical": typical, "extreme": extreme, "all": ordered, "mode": "weighted"}


PHASE_FR = {"TRANSITION": "transition", "BUILD_UP": "construction", "SETTLED": "attaque placée", "SET_PIECE": "CPA"}


def _definition(ctx, mid):
    """Catalogue row of a metric. Mirror metrics (…_against, CODEBOOK §8.2) share
    their base metric's definition, labelled « (adversaire) », direction reversed;
    xg_rate_<phase> takes the phase name."""
    against = mid.endswith("_against") and mid not in ctx.defs
    base = mid[: -len("_against")] if against else mid
    phase = re.search(r"_(TRANSITION|BUILD_UP|SETTLED|SET_PIECE)$", base)
    d = dict(ctx.defs.get(base) or ctx.defs.get(re.sub(r"_(TRANSITION|BUILD_UP|SETTLED|SET_PIECE)$", "_<phase>", base)) or {})
    if phase:
        d["label_fr"] = f"xG par 10 min · {PHASE_FR[phase.group(1)]}"
    if against:
        d["label_fr"] = f'{d.get("label_fr", base)} (adversaire)'
        d["direction"] = {"↑": "↓", "↓": "↑"}.get(d.get("direction"), d.get("direction"))
    return d


def _metric(ctx, mid, value, n, moments=(), coverage=None, detail=None, hide_below=True):
    d = _definition(ctx, mid)
    status, label = "ok", d.get("label", "")
    need = _min_n(d.get("min_n"))
    if value is not None and need is not None and n < need:
        status = "trop tôt"
    if coverage is not None:
        if coverage < 0.5 and hide_below:
            value, status = None, "couverture insuffisante"
        elif coverage < 0.8 or (coverage < 0.5 and not hide_below):
            status = "partiel" if status == "ok" else status
    return {"id": mid, "label_fr": d.get("label_fr", mid), "group": d.get("group"), "unit": d.get("unit"),
            "direction": d.get("direction"), "min_n": d.get("min_n"), "value": value, "n": n,
            "coverage": None if coverage is None else round(coverage, 3), "label": label, "status": status,
            "clips": _clips(list(moments)), "detail": detail}


def _ratio(a, b):
    return round(a / b, 4) if b else None


def _per10(count, minutes):
    return round(count / minutes * 10, 3) if minutes else None


def _team_of_flag(ctx, half, t):
    band = ctx.tl.band_at(half, t)
    if band is not None:
        return "US" if band >= 3 else "THEM"
    return ctx.tl.state_at(half, t)


def compute_metrics(tl, lab, answers, roots, meta, classic_tilt=None) -> dict:
    ctx = Ctx(tl, lab, answers, roots, meta)
    out = {}
    put = lambda m: out.__setitem__(m["id"], m)   # noqa: E731

    # ---- shots and xG
    shots = []
    for s in tl.shots:
        xg, est = shot_xg(s, ctx.shot_card(s))
        shots.append((s, xg, est))
    by_team = {t: [x for x in shots if x[0].team == t] for t in LIVE}
    for t, sfx in (("US", "for"), ("THEM", "against")):
        goals = [x for x in by_team[t] if x[0].v == "GOAL"]
        put(_metric(ctx, f"goals_{sfx}", len(goals), len(goals), [ctx.clip(s.half, s.t, xg, "But") for s, xg, _ in goals]))
        put(_metric(ctx, f"shots_{sfx}", len(by_team[t]), len(by_team[t]), [ctx.clip(s.half, s.t, xg, "Tir") for s, xg, _ in by_team[t]]))
        xg_sum = round(sum(x[1] for x in by_team[t]), 3)
        est = sum(x[2] for x in by_team[t])
        put(_metric(ctx, f"xg_{sfx}", xg_sum, len(by_team[t]), [ctx.clip(s.half, s.t, xg, f"xG {xg:.2f}") for s, xg, _ in by_team[t]],
                    detail={"estimated_shots": est}))
    put(_metric(ctx, "xgd", round(out["xg_for"]["value"] - out["xg_against"]["value"], 3), len(shots)))

    # chances = shots + flags answered CHANCE_NO_SHOT
    chance_flags = {t: [] for t in LIVE}
    flags_answered = 0
    for half, t, seq in tl.flags:
        a = ctx.ans("FLAG", seq)
        if a:
            flags_answered += 1
        if a and a.get("type") == "CHANCE_NO_SHOT":
            team = _team_of_flag(ctx, half, t)
            if team in LIVE:
                chance_flags[team].append(ctx.clip(half, t, 0.0, "Occasion sans tir"))
    flag_cov = _ratio(flags_answered, len(tl.flags)) if tl.flags else None
    for t, sfx in (("US", "for"), ("THEM", "against")):
        moments = [ctx.clip(s.half, s.t, xg, "Tir") for s, xg, _ in by_team[t]] + chance_flags[t]
        put(_metric(ctx, f"chances_{sfx}", len(moments), len(moments), moments, coverage=flag_cov, hide_below=False))
    cf, ca = out["chances_for"]["value"], out["chances_against"]["value"]
    put(_metric(ctx, "chance_share", _ratio(cf or 0, (cf or 0) + (ca or 0)), (cf or 0) + (ca or 0)))
    g, n = out["goals_for"]["value"], out["shots_for"]["value"]
    conv = _ratio(g, n)
    put(_metric(ctx, "conversion", conv, n, detail={"wilson90": _wilson(g, n, 1.645)}))

    # ---- phases
    phase_min = {(p.team, p.phase): 0.0 for p in lab.phases}
    for p in lab.phases:
        phase_min[(p.team, p.phase)] = phase_min.get((p.team, p.phase), 0) + (p.end - p.start) / 60000
    for ph in ("TRANSITION", "BUILD_UP", "SETTLED", "SET_PIECE"):
        for t, sfx in (("US", ""), ("THEM", "_against")):
            sel = [(s, xg) for s, xg, _ in by_team[t] if ctx.phase_at(t, s.half, s.t) == ph]
            mins = phase_min.get((t, ph), 0)
            put(_metric(ctx, f"xg_rate_{ph}{sfx}", _per10(sum(x for _, x in sel), mins), len(sel),
                        [ctx.clip(s.half, s.t, xg, "Tir") for s, xg in sel], detail={"phase_minutes": round(mins, 2)}))

    regains = {"US": [], "THEM": []}
    for a, b in zip(tl.states, tl.states[1:]):
        if a.half == b.half and a.end == b.start and a.state in LIVE and b.state in LIVE and a.state != b.state:
            regains[b.state].append((b.half, b.start, a.end))
    box_entries = {t: [e for e in lab.entries if e.team == t and e.kind == "box"] for t in LIVE}
    red_entries = {t: [e for e in lab.entries if e.team == t and e.kind == "redzone"] for t in LIVE}

    def kept_ball(team, half, t0, t1):
        return all(s.state == team for s in tl.states if s.half == half and s.end > t0 and s.start < t1)

    for t, sfx in (("US", ""), ("THEM", "_against")):
        hits = [(h, g) for h, g, _ in regains[t]
                if any(e.half == h and g <= e.t <= g + 10000 and kept_ball(t, h, g, e.t) for e in box_entries[t])]
        put(_metric(ctx, f"transition_to_box{sfx}", _ratio(len(hits), len(regains[t])), len(regains[t]),
                    [ctx.clip(h, g, 1, "Récupération → surface") for h, g in hits]))
    deltas = []
    for h, g, _ in regains["US"]:
        nxt = sorted([e.t for e in box_entries["US"] if e.half == h and e.t >= g] +
                     [s.t for s, _, _ in by_team["US"] if s.half == h and s.t >= g])
        if nxt and nxt[0] - g <= 60000 and kept_ball("US", h, g, nxt[0]):
            deltas.append((h, g, (nxt[0] - g) / 1000))
    put(_metric(ctx, "transition_speed", round(median([d for *_, d in deltas]), 1) if deltas else None, len(deltas),
                [ctx.clip(h, g, -d, f"{d:.0f} s") for h, g, d in deltas]))

    for t, sfx, own, reach in (("US", "", (0, 1, 2), lambda b: b >= 4), ("THEM", "_against", (3, 4, 5), lambda b: b <= 1)):
        team = "us" if t == "US" else "them"
        bu = [p for p in lab.possessions if p.team == team and p.start_type in ("kickoff", "set_piece", "half_start")
              and tl.band_at(p.half, p.start_ms) in own]
        reached = [p for p in bu if any(reach(b.band) for b in tl.bands if b.half == p.half and p.start_ms <= b.start < p.end_ms)]
        put(_metric(ctx, f"buildup_progression{sfx}", _ratio(len(reached), len(bu)), len(bu),
                    [ctx.clip(p.half, p.start_ms, 1, "Construction") for p in reached]))

    attacking = {"US": (4, 5), "THEM": (0, 1)}
    for t, sfx in (("US", ""), ("THEM", "_against")):
        sps = [r for r in tl.restarts if r.team == t and (r.type in ("CORNER", "FK", "PEN") or (r.type == "THROW" and r.band in attacking[t]))]
        shot_after = [r for r in sps if any(s.half == r.half and r.t <= s.t <= r.t + 20000 and kept_ball(t, r.half, r.t, s.t) for s, _, _ in by_team[t])]
        put(_metric(ctx, f"setpiece_shot_rate{sfx}", _ratio(len(shot_after), len(sps)), len(sps),
                    [ctx.clip(r.half, r.t, 1, r.type) for r in shot_after]))
        sp_xg = sum(xg for s, xg, _ in by_team[t] if ctx.phase_at(t, s.half, s.t) == "SET_PIECE")
        put(_metric(ctx, f"setpiece_xg{sfx}", _ratio(sp_xg, len(sps)), len(sps)))
        cards = [r for r in tl.restarts if r.team == t and r.type in ("CORNER", "FK") and r.band in attacking[t]]
        answered = [ctx.ans("SET_PIECE", r.rseq) for r in cards]
        fc = [a.get("first_contact") for a in answered if a and a.get("first_contact") in LIVE]
        put(_metric(ctx, f"first_contact_won{sfx}", _ratio(sum(x == t for x in fc), len(fc)), len(fc),
                    coverage=_ratio(sum(1 for a in answered if a), len(cards)) if cards else None))

    # ---- xT
    def entry_lane(seq):
        a = ctx.ans("ENTRY", seq)
        return a.get("lane") if a else None
    gains = xt_gains(tl, entry_lane)
    total = sum(g.gain for g in gains)
    put(_metric(ctx, "xt_gained", _per10(total, ctx.poss["US"]), len(gains), [ctx.clip(g.half, g.t, g.gain, f"+{g.gain:.3f}") for g in gains],
                detail={"total": round(total, 4)}))
    by_phase, by_lane = {}, {}
    for g in gains:
        ph = ctx.phase_at("US", g.half, g.t) or "?"
        by_phase[ph] = round(by_phase.get(ph, 0) + g.gain, 4)
        by_lane[g.lane or "?"] = round(by_lane.get(g.lane or "?", 0) + g.gain, 4)
    put(_metric(ctx, "xt_by_phase", by_phase, len(gains)))
    put(_metric(ctx, "xt_by_lane", by_lane, len(gains)))

    # ---- half-space (our entries with ENTRY answers)
    us_entries = {}
    for e in lab.entries:
        if e.team == "US":
            us_entries.setdefault((e.half, e.t), e)     # 3 -> 5 is one card
    ent = [(e, ctx.ans("ENTRY", e.seq)) for e in us_entries.values()]
    answered = [(e, a) for e, a in ent if a]
    cov_e = _ratio(len(answered), len(ent)) if ent else None
    lane_known = [(e, a) for e, a in answered if a.get("lane") in LANES]
    hs = [(e, a) for e, a in lane_known if a["lane"] in HS]
    count = lambda xs: {k: xs.count(k) for k in dict.fromkeys(xs)}   # noqa: E731
    put(_metric(ctx, "hs_entry_share", _ratio(len(hs), len(lane_known)), len(lane_known),
                [ctx.clip(e.half, e.t, 1, "Entrée intérieure") for e, _ in hs], coverage=cov_e,
                detail={"lanes": count([a["lane"] for _, a in lane_known]),
                        "methods": count([a["method"] for _, a in answered if a.get("method") not in (None, "CANT_SEE")]),
                        "grid": count([f'{a["lane"]}:{e.band}' for e, a in lane_known]),
                        "entries": len(ent), "answered": len(answered)}))
    bl = [(e, a) for e, a in answered if a.get("between_lines") in ("YES", "NO")]
    put(_metric(ctx, "between_lines_rate", _ratio(sum(a["between_lines"] == "YES" for _, a in bl), len(bl)), len(bl),
                [ctx.clip(e.half, e.t, 1, "Entre les lignes") for e, a in bl if a["between_lines"] == "YES"], coverage=cov_e))
    hs_box = [(e, a) for e, a in hs if a.get("outcome_15s") in ("SHOT", "BOX_ENTRY")]
    put(_metric(ctx, "hs_to_box", _ratio(len(hs_box), len(hs)), len(hs), [ctx.clip(e.half, e.t, 1, "Intérieur → surface") for e, _ in hs_box], coverage=cov_e))
    sh_lane = [(s, ctx.shot_card(s)) for s, _, _ in by_team["US"]]
    sh_known = [(s, a) for s, a in sh_lane if a and a.get("last_pass_lane") in LANES]
    sh_hs = [(s, a) for s, a in sh_known if a["last_pass_lane"] in HS]
    put(_metric(ctx, "hs_assist_share", _ratio(len(sh_hs), len(sh_known)), len(sh_known),
                [ctx.clip(s.half, s.t, 1, "Tir servi de l'intérieur") for s, _ in sh_hs],
                coverage=_ratio(sum(1 for _, a in sh_lane if a), len(sh_lane)) if sh_lane else None))

    losses = [(l, ctx.ans("LOSS", l.seq)) for l in lab.losses if l.band is not None and l.band >= 3]
    loss_answered = [(l, a) for l, a in losses if a]
    cov_l = _ratio(len(loss_answered), len(losses)) if losses else None
    hs_fail = [l for l, a in loss_answered if a.get("intent_lane") in HS]
    put(_metric(ctx, "hs_attempt_success", _ratio(len(hs), len(hs) + len(hs_fail)), len(hs) + len(hs_fail),
                [ctx.clip(l.half, l.t, 0, "Tentative intérieure perdue") for l in hs_fail],
                coverage=min(c for c in (cov_e, cov_l) if c is not None) if (cov_e is not None or cov_l is not None) else None))

    def xg_after(group):
        tot = 0.0
        for e, _ in group:
            tot += sum(xg for s, xg, _ in by_team["US"] if s.half == e.half and e.t <= s.t <= e.t + 15000)
        return _ratio(tot, len(group))
    other = [(e, a) for e, a in lane_known if a["lane"] not in HS]
    put(_metric(ctx, "xg_after_hs", xg_after(hs), len(hs), coverage=cov_e))
    put(_metric(ctx, "xg_after_other", xg_after(other), len(other), coverage=cov_e))

    # ---- red zone and the 18
    put(_metric(ctx, "redzone_entries", _per10(len(red_entries["US"]), ctx.poss["US"]), len(red_entries["US"]),
                [ctx.clip(e.half, e.t, 1, "Entrée zone rouge") for e in red_entries["US"]]))
    put(_metric(ctx, "box_entries", _per10(len(box_entries["US"]), ctx.poss["US"]), len(box_entries["US"]),
                [ctx.clip(e.half, e.t, 1, "Entrée surface") for e in box_entries["US"]]))
    put(_metric(ctx, "red_to_box", _ratio(len(box_entries["US"]), len(red_entries["US"])), len(red_entries["US"])))
    attack18 = [e for e in box_entries["US"] if any(s.half == e.half and e.t <= s.t <= e.t + 15000 for s, _, _ in by_team["US"])]
    put(_metric(ctx, "box_attack_eff", _ratio(len(attack18), len(box_entries["US"])), len(box_entries["US"]),
                [ctx.clip(e.half, e.t, 1, "Surface → tir") for e in attack18]))
    box_fail = [l for l, a in loss_answered if l.band == 4 and a.get("intent") in ("THROUGH", "CROSS", "DRIBBLE", "PASS_INTO_HS")]
    nb = len(box_entries["US"])
    put(_metric(ctx, "box_attempt_success", _ratio(nb, nb + len(box_fail)), nb + len(box_fail),
                [ctx.clip(l.half, l.t, 0, "Tentative de surface perdue") for l in box_fail], coverage=cov_l))
    ours = [p for p in lab.possessions if p.team == "us"]
    reached = [p for p in ours if any(b.band >= 4 and not b.auto for b in tl.bands if b.half == p.half and p.start_ms <= b.start < p.end_ms)]
    put(_metric(ctx, "possessions_reaching_redzone", _ratio(len(reached), len(ours)), len(ours)))
    t45 = sum(min(s.end, b.end) - max(s.start, b.start) for s in tl.states if s.state == "US"
              for b in tl.bands if b.half == s.half and b.band >= 4 and min(s.end, b.end) > max(s.start, b.start))
    t01 = sum(min(s.end, b.end) - max(s.start, b.start) for s in tl.states if s.state == "THEM"
              for b in tl.bands if b.half == s.half and b.band <= 1 and min(s.end, b.end) > max(s.start, b.start))
    put(_metric(ctx, "field_tilt_time", _ratio(t45, t45 + t01), 1 if t45 + t01 else 0))
    put(_metric(ctx, "field_tilt_classic", classic_tilt, 1 if classic_tilt is not None else 0))

    # ---- intensity
    l35 = [l for l in lab.losses if l.band is not None and l.band >= 3]
    won = [l for l in l35 if any(h == l.half and l.t < g <= l.t + 5000 for h, g, _ in regains["US"])]
    lc = [a for _, a in loss_answered]
    put(_metric(ctx, "counterpress_5s", _ratio(len(won), len(l35)), len(l35), [ctx.clip(l.half, l.t, 1, "Contre-pressing réussi") for l in won],
                detail={"causes": count([a["cause"] for a in lc if a.get("cause") not in (None, "CANT_SEE")]),
                        "intents": count([a["intent"] for a in lc if a.get("intent") not in (None, "CANT_SEE")]),
                        "losses_by_band": count([l.band for l in l35]), "answered": len(lc)}))
    high = [r for r in lab.regains if r.band is not None and r.band >= 3]
    put(_metric(ctx, "high_regains", _per10(len(high), ctx.poss["THEM"]), len(high), [ctx.clip(r.half, r.t, 1, "Récupération haute") for r in high]))
    theirs = [p for p in lab.possessions if p.team == "them" and p.duration_ms is not None]
    put(_metric(ctx, "opp_possession_length", round(sum(p.duration_ms for p in theirs) / len(theirs) / 1000, 1) if theirs else None, len(theirs)))
    closing = [a.get("closing_3s") for _, a in loss_answered if a.get("closing_3s") in ("0", "1", "2", "3PLUS")]
    nums = [3 if c == "3PLUS" else int(c) for c in closing]
    put(_metric(ctx, "closing_3s_mean", round(sum(nums) / len(nums), 2) if nums else None, len(nums), coverage=cov_l))
    put(_metric(ctx, "closing_2plus_share", _ratio(sum(x >= 2 for x in nums), len(nums)), len(nums), coverage=cov_l))
    duels = [ctx.ans("DUEL", seq) for _, _, seq in tl.flags if (ctx.ans("FLAG", seq) or {}).get("type") == "KEY_DUEL"]
    res = [d.get("result") for d in duels if d and d.get("result") in ("WON", "LOST")]
    put(_metric(ctx, "duel_win", _ratio(sum(r == "WON" for r in res), len(res)), len(res),
                coverage=_ratio(sum(1 for d in duels if d), len(duels)) if duels else None))
    late = [(s.team) for s, _, _ in shots if s.half == 2 and s.t >= ctx.cb["derived"]["resilience"]["late_from_ms"]]
    put(_metric(ctx, "resilience_late", _ratio(late.count("US"), len(late)), len(late)))
    conceded = [s for s, _, _ in shots if s.team == "THEM" and s.v == "GOAL"]
    after = [s.team for c in conceded for s, _, _ in shots
             if s.half == c.half and c.t < s.t <= c.t + ctx.cb["derived"]["resilience"]["after_conceding_ms"]]
    put(_metric(ctx, "resilience_after_conceding", _ratio(after.count("US"), len(after)), len(conceded)))

    # mirror metrics marked "against" share the definition of their own metric
    return out


def _wilson(k, n, z):
    if not n:
        return None
    p = k / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5) / denom
    return [round(centre - half, 3), round(centre + half, 3)]

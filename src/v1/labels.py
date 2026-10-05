"""
labels - possessions, regains, losses, entries and phases from the timeline
(CODEBOOK §6.2-§6.4).

DEFINITIONS
    possession : a stretch of one team's live state. US -> DEAD -> US (the
                 team keeps its own restart) is the same possession, the dead
                 time is subtracted (stoppage_ms). UNKNOWN ends a possession
                 (inexact end) and the next one starts inexact.
    start_type : kickoff / set_piece (after a dead ball, by its restart) /
                 recup (directly from the opponent) / inferred (after UNKNOWN)
                 / half_start (no restart known).
    end_type   : perte (ours, directly to them) / recup (theirs, directly to
                 us) / opp_set_piece (ours, dead ball restarted by them) /
                 set_piece (theirs, restarted by us) / goal / opp_goal (the
                 dead ball is a goal, by scoring team) / inferred / half_end.
    zones      : legacy zone keys for the existing engine: band 0 -> 1,
                 bands 1-4 -> 1-4, band 5 -> "BOX".
    regain     : THEM -> US with no dead ball or UNKNOWN in between; loss is
                 the mirror. Band = the band at that moment.
    entry      : a manual band change while the team has the ball:
                 US red zone = from <= 3 into 4 or 5, US box = into 5 from <= 4;
                 THEM red zone = from >= 2 into 1 or 0, THEM box = into 0
                 from >= 1. Automatic bands (restarts) are not entries.
    phase      : every second of possession has one phase, first rule wins:
                 SET_PIECE (20 s after a corner, free kick or penalty taken by
                 the team, or a throw-in in its attacking end: bands 4-5 for
                 us, 0-1 for them), TRANSITION (10 s after a regain), BUILD_UP
                 (its own half: bands 0-2 us, 3-5 them), SETTLED (the rest).
"""

from dataclasses import dataclass, field

from src.analytics.possessions import Possession, US as P_US, THEM as P_THEM
from src.codebook import load_codebook

LIVE = ("US", "THEM")
LEGACY_ZONE = {0: 1, 1: 1, 2: 2, 3: 3, 4: 4, 5: "BOX"}
TEAM = {"US": P_US, "THEM": P_THEM}


@dataclass
class Moment:
    half: int
    t: float
    team: str              # team that gains (regain) / loses (loss) / enters (entry)
    band: int | None
    kind: str = ""
    seq: int | None = None # the press it comes from (review cards key on it)


@dataclass
class Phase:
    half: int
    start: float
    end: float
    team: str
    phase: str


@dataclass
class Labels:
    possessions: list = field(default_factory=list)
    regains: list = field(default_factory=list)
    losses: list = field(default_factory=list)
    entries: list = field(default_factory=list)
    phases: list = field(default_factory=list)


def _legacy(band):
    return None if band is None else LEGACY_ZONE[band]


def _switches(tl):
    """Direct live -> live changes of team: (half, t, from, to, seq)."""
    out = []
    for a, b in zip(tl.states, tl.states[1:]):
        if a.half == b.half and a.end == b.start and a.state in LIVE and b.state in LIVE and a.state != b.state:
            out.append((a.half, b.start, a.state, b.state, b.seq))
    return out


def _possessions(tl, match_id):
    goals = {(s.half, s.t): s.team for s in tl.shots if s.v == "GOAL"}

    def score_before(half, t):
        g = [s for s in tl.shots if s.v == "GOAL" and (s.half, s.t) < (half, t)]
        return sum(s.team == "US" for s in g), sum(s.team == "THEM" for s in g)

    out = []

    def open_(seg, start_type, exact=True):
        us, them = score_before(seg.half, seg.start)
        p = Possession(match_id=match_id, possession_id=len(out) + 1, half=seg.half, team=TEAM[seg.state],
                       start_ms=seg.start, end_ms=seg.end, start_exact=exact, end_exact=True,
                       start_type=start_type, end_type="half_end", score_us=us, score_them=them)
        if start_type == "recup":
            p.start_zone = _legacy(tl.band_at(seg.half, seg.start))
        out.append(p)
        return p

    def close(p, t, end_type, exact=True):
        p.end_ms, p.end_type, p.end_exact = t, end_type, exact
        if end_type == "perte":
            p.end_zone = _legacy(tl.band_at(p.half, t))

    def after_dead(dead):
        return "kickoff" if dead.restart == "KICKOFF" else "set_piece"

    for half in tl.halves:
        cur, pending, lead_dead, after_unknown = None, None, None, False
        for s in (x for x in tl.states if x.half == half):
            if s.state == "DEAD":
                if cur:
                    pending = s
                else:
                    lead_dead = s
                continue
            if s.state == "UNKNOWN":
                if cur:
                    close(cur, pending.start if pending else s.start, "inferred", exact=False)
                cur, pending, lead_dead, after_unknown = None, None, None, True
                continue
            if cur and cur.team == TEAM[s.state]:
                if pending:
                    cur.stoppages.append((pending.start, pending.end))
                    cur.stoppage_ms += pending.end - pending.start
                cur.end_ms, pending = s.end, None
                continue
            if cur:
                if pending:
                    g = goals.get((half, pending.start))
                    end_type = ("goal" if g == "US" else "opp_goal") if g else \
                        ("opp_set_piece" if cur.team == P_US else "set_piece")
                    close(cur, pending.start, end_type)
                    cur = open_(s, after_dead(pending))
                else:
                    close(cur, s.start, "perte" if cur.team == P_US else "recup")
                    cur = open_(s, "recup")
            elif after_unknown:
                cur = open_(s, "inferred", exact=False)
            else:
                cur = open_(s, after_dead(lead_dead) if lead_dead else "half_start")
            pending, after_unknown = None, False
        if cur and pending:
            g = goals.get((half, pending.start))
            close(cur, pending.start, ("goal" if g == "US" else "opp_goal") if g else "half_end")
    return out


def _entries(tl):
    out = []
    for b in tl.bands:
        if b.prev is None or b.auto or b.state not in LIVE:
            continue
        p, n = b.prev, b.band
        if b.state == "US":
            if p <= 3 and n >= 4:
                out.append(Moment(b.half, b.start, "US", n, "redzone", b.seq))
            if n == 5 and p <= 4:
                out.append(Moment(b.half, b.start, "US", n, "box", b.seq))
        else:
            if p >= 2 and n <= 1:
                out.append(Moment(b.half, b.start, "THEM", n, "redzone", b.seq))
            if n == 0 and p >= 1:
                out.append(Moment(b.half, b.start, "THEM", n, "box", b.seq))
    return out


def _phases(tl, regains):
    cb = load_codebook()["derived"]
    sp_s = next(p["window_s"] for p in cb["phases"] if p["id"] == "SET_PIECE") * 1000
    tr_s = next(p["window_s"] for p in cb["phases"] if p["id"] == "TRANSITION") * 1000
    attacking = {"US": (4, 5), "THEM": (0, 1)}
    sp = [(r.half, r.team, r.t, r.t + sp_s) for r in tl.restarts
          if r.type in ("CORNER", "FK", "PEN") or (r.type == "THROW" and r.band in attacking[r.team])]
    tr = [(g.half, g.team, g.t, g.t + tr_s) for g in regains]

    out = []
    for s in (x for x in tl.states if x.state in LIVE):
        wins = [w for w in sp + tr if w[0] == s.half and w[1] == s.state]
        pts = {s.start, s.end} | {x for w in wins for x in w[2:] if s.start < x < s.end} \
            | {b.start for b in tl.bands if b.half == s.half and s.start < b.start < s.end}
        pts = sorted(pts)
        for a, b in zip(pts, pts[1:]):
            mid = (a + b) / 2
            if any(w[2] <= mid < w[3] for w in sp if w[0] == s.half and w[1] == s.state):
                ph = "SET_PIECE"
            elif any(w[2] <= mid < w[3] for w in tr if w[0] == s.half and w[1] == s.state):
                ph = "TRANSITION"
            else:
                band = tl.band_at(s.half, mid)
                own = band is None or (band <= 2 if s.state == "US" else band >= 3)
                ph = "BUILD_UP" if own else "SETTLED"
            if out and out[-1].phase == ph and out[-1].team == s.state and out[-1].end == a:
                out[-1].end = b
            else:
                out.append(Phase(s.half, a, b, s.state, ph))
    return out


def label_match(tl, match_id: str) -> Labels:
    lab = Labels()
    switches = _switches(tl)
    for half, t, frm, to, seq in switches:     # ours only: regain = them -> us, loss = us -> them
        band = tl.band_at(half, t)
        if to == "US":
            lab.regains.append(Moment(half, t, "US", band, "regain", seq))
        else:
            lab.losses.append(Moment(half, t, "US", band, "loss", seq))
    lab.possessions = _possessions(tl, match_id)
    lab.entries = _entries(tl)
    lab.phases = _phases(tl, [Moment(h, t, to, None) for h, t, f, to, _ in switches])   # both teams' regains
    return lab

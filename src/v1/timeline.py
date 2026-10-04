"""
timeline - turns the effective log into who-has-the-ball and where-is-the-ball
segments, restarts and shots (CODEBOOK §2, §3, §6.1).

DEFINITIONS
    half bounds : start = the H START line (else 0 / 45:00); end = the H END
                  line, else the last line of that half (clock lines included).
    state       : US / THEM / DEAD / UNKNOWN. Until the first Q/W of a half the
                  ball is DEAD with restart KICKOFF. Pressing the current state
                  again changes nothing.
    restart     : the restart key pressed during a DEAD segment (the last one
                  wins); taken by the team of the S that ends the segment, at
                  that moment; its band is the band at that moment (the press
                  made during the dead ball, or the automatic band).
    UNKNOWN     : from a LOST line until the next LOST (the state goes back to
                  what it was) or the next S (the state becomes that S).
    bands       : from each Z line (manual or automatic) to the next change.
    shot team   : the team stored on the shot; else a penalty pressed while the
                  ball is dead -> the team that last had the ball; else the zone
                  (codebook shot_team_rule: bands 3-5 us, 0-2 them); with no
                  band yet, the team with the ball.
    score       : goals by shot team; SCORE lines are manual corrections kept
                  apart (integrity gate G2 compares the two).
"""

from dataclasses import dataclass, field

from src.codebook import load_codebook

LIVE = ("US", "THEM")


@dataclass
class Segment:
    half: int
    start: float
    end: float
    state: str                       # US | THEM | DEAD | UNKNOWN
    restart: str | None = None       # DEAD only
    taken_by: str | None = None      # DEAD only


@dataclass
class BandSeg:
    half: int
    start: float
    end: float
    band: int
    auto: bool
    prev: int | None                 # band before this one (None at the first)
    state: str | None                # state when the band was entered


@dataclass
class Restart:
    half: int
    t: float                         # when it was taken
    type: str | None                 # THROW | CORNER | FK | GK | PEN | KICKOFF | None
    team: str
    band: int | None
    dead_start: float


@dataclass
class Shot:
    seq: int
    half: int
    t: float
    v: str                           # OFF | ON | GOAL
    team: str | None
    band: int | None


@dataclass
class Timeline:
    halves: dict = field(default_factory=dict)        # half -> (start, end)
    states: list = field(default_factory=list)
    bands: list = field(default_factory=list)
    restarts: list = field(default_factory=list)
    shots: list = field(default_factory=list)
    flags: list = field(default_factory=list)         # (half, t, seq)
    lost: list = field(default_factory=list)          # (half, start, end)
    score: dict = field(default_factory=lambda: {"US": 0, "THEM": 0})
    score_fixes: dict = field(default_factory=lambda: {"US": 0, "THEM": 0})

    def band_at(self, half, t):
        b = None
        for s in self.bands:
            if s.half == half and s.start <= t:
                b = s.band
        return b

    def state_at(self, half, t):
        for s in self.states:
            if s.half == half and s.start <= t < s.end:
                return s.state
        return None


def _shot_team(op, state, last_live, restart, band):
    if op.get("team") in LIVE:
        return op["team"]
    by_ball = state if state in LIVE else last_live
    if state == "DEAD" and restart == "PEN":
        return by_ball
    if band is None:
        return by_ball
    rule = load_codebook()["shot_team_rule"]
    return "US" if band in rule["us_bands"] else "THEM"


def build_timeline(ops: list[dict]) -> Timeline:
    """ops: effective lines (log.effective_ops)."""
    half2 = load_codebook()["clock"]["half2_start_ms"]
    tl = Timeline()
    for half in sorted({o["half"] for o in ops}):
        hops = [o for o in ops if o["half"] == half]
        h_start = next((o["t"] for o in hops if o["k"] == "H" and o["v"] == "START"), 0 if half == 1 else half2)
        h_end = next((o["t"] for o in hops if o["k"] == "H" and o["v"] == "END"), max(o["t"] for o in hops))
        tl.halves[half] = (h_start, h_end)

        cur = {"state": "DEAD", "start": h_start, "restart": "KICKOFF"}
        last_live, band, band_start, band_auto, band_prev, band_state = None, None, None, False, None, None
        lost_open, before_lost = None, None
        segs, bsegs = [], []

        def close(t, taken_by=None):
            segs.append(Segment(half, cur["start"], t, cur["state"],
                                cur.get("restart") if cur["state"] == "DEAD" else None, taken_by))

        for o in hops:
            if o["t"] > h_end:
                break
            k, v, t = o["k"], o["v"], o["t"]
            if k == "S":
                if lost_open is not None:
                    tl.lost.append((half, lost_open, t))
                    lost_open = None
                if v == cur["state"]:
                    continue
                taken_by = v if cur["state"] == "DEAD" and v in LIVE else None
                if taken_by:
                    tl.restarts.append(Restart(half, t, cur.get("restart"), v, None, cur["start"]))
                close(t, taken_by)
                cur = {"state": v, "start": t, "restart": None}
                if v in LIVE:
                    last_live = v
            elif k == "R" and cur["state"] == "DEAD":
                cur["restart"] = v
            elif k == "Z":
                if v != band:
                    if band is not None:
                        bsegs.append(BandSeg(half, band_start, t, band, band_auto, band_prev, band_state))
                    band_prev, band, band_start, band_auto, band_state = band, v, t, bool(o.get("auto")), cur["state"]
            elif k == "LOST":
                if lost_open is None:
                    lost_open, before_lost = t, dict(cur)
                    close(t)
                    cur = {"state": "UNKNOWN", "start": t, "restart": None}
                else:
                    tl.lost.append((half, lost_open, t))
                    lost_open = None
                    close(t)
                    cur = {**before_lost, "start": t}
            elif k == "SH":
                team = _shot_team(o, cur["state"], last_live, cur.get("restart"), band)
                tl.shots.append(Shot(o["seq"], half, t, v, team, band))
                if v == "GOAL" and team in LIVE:
                    tl.score[team] += 1
            elif k == "F":
                tl.flags.append((half, t, o["seq"]))
            elif k == "SCORE":
                team = "US" if v.startswith("US") else "THEM"
                tl.score_fixes[team] += 1 if v.endswith("+1") else -1
        if lost_open is not None:
            tl.lost.append((half, lost_open, h_end))
        close(h_end)
        if band is not None:
            bsegs.append(BandSeg(half, band_start, h_end, band, band_auto, band_prev, band_state))
        tl.states += [s for s in segs if s.end > s.start]
        tl.bands += [b for b in bsegs if b.end > b.start or b.end == h_end]

    for r in tl.restarts:
        r.band = tl.band_at(r.half, r.t)
    return tl

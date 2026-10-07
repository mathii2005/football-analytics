"""
models - xG of a shot and xT gains of band changes (CODEBOOK §7). Tables come
from the codebook (built by tools/build_xg_table.py and tools/build_xt_grid.py).

xG of a shot
    loc / body / situation from its review card (SHOT or GOAL) in the table.
    The position model (logistic on the clicked position: distance, angle,
    header, fast break, set piece) is coded but off (xg.use_position_model):
    the analyst keeps the table until it is re-evaluated after 5 matches.
    PENALTY -> xg.penalty. OTHER body -> HEAD. Unanswered or CANT_SEE body ->
    FOOT, situation -> OPEN (the most common). Unanswered loc -> the
    shot-weighted average of the cells of its band (band 5 or 0: the box
    cells; elsewhere: the outside cells), seen from the shooting team.
    Anything filled in that way marks the shot "estimated".

xT gains
    Every manual band change while we have the ball is a move from cell A
    (previous band, lane if known) to cell B (new band, the lane answered on
    its ENTRY card if any). Unknown lane -> the band's lane average.
    gain = max(0, xT[B] - xT[A]), counted only if >= xt.min_gain.
"""

import math
from dataclasses import dataclass

from src.codebook import load_codebook

BOX = ("SIX", "CENTRAL_BOX", "WIDE_BOX")
OUTSIDE = ("CENTRAL_OUT", "WIDE_OUT")
LANES = ("L", "HS_L", "C", "HS_R", "R")


def _weighted(cells, body, sit):
    cb = load_codebook()["xg"]
    counts = cb.get("counts") or {}
    vals = [(cb["table"][c][body][sit], (counts.get(c, {}).get(body, {}).get(sit) or 1)) for c in cells]
    w = sum(n for _, n in vals)
    return sum(v * n for v, n in vals) / w


def shot_xg(shot, answer, use_position=None):
    """(xg, estimated) for a timeline Shot and its card answer (dict or None)."""
    cb = load_codebook()["xg"]
    a = answer or {}
    sit = a.get("situation")
    if sit == "PENALTY":
        return cb["penalty"], False
    estimated = False
    body = a.get("body")
    body = "HEAD" if body in ("HEAD", "OTHER") else "FOOT" if body == "FOOT" else None
    if body is None:
        body, estimated = "FOOT", True
    if sit not in ("OPEN", "FAST_BREAK", "SET_PIECE"):
        sit, estimated = "OPEN", True
    pos = a.get("pos")
    if use_position is None:
        use_position = cb.get("use_position_model", False)
    if use_position and isinstance(pos, dict) and "x" in pos and "y" in pos:       # exact position clicked in the review
        x, y = (105 - pos["x"], 68 - pos["y"]) if shot.team == "THEM" else (pos["x"], pos["y"])
        return position_xg(x, y, body, sit), estimated
    loc = a.get("loc")
    if loc in cb["table"]:
        return cb["table"][loc][body][sit], estimated
    band = shot.band
    if band is not None and shot.team == "THEM":
        band = 5 - band                       # seen from the shooting team
    cells = BOX if band == 5 else OUTSIDE if band is not None else BOX + OUTSIDE
    return _weighted(cells, body, sit), True


GOAL_Y = (34 - 3.66, 34 + 3.66)      # posts, metres on a 68 m wide pitch


def shot_geometry(x, y):
    """(distance to the goal centre, visible goal angle in radians) for a shot at (x, y)
    in metres, seen from the shooter (attacking the goal at x = 105)."""
    dx = 105 - x
    d = math.hypot(dx, 34 - y)
    a = abs(math.atan2(GOAL_Y[1] - y, dx) - math.atan2(GOAL_Y[0] - y, dx))
    return d, a


def position_xg(x, y, body, situation):
    """xG from the exact position (codebook xg.position_model): logistic on distance,
    angle, header, fast break and set piece. body / situation as on the shot card."""
    m = load_codebook()["xg"]["position_model"]
    d, a = shot_geometry(x, y)
    feats = {"const": 1.0, "distance": d, "angle": a, "head": body in ("HEAD", "OTHER"),
             "fast_break": situation == "FAST_BREAK", "set_piece": situation == "SET_PIECE"}
    z = sum(c * float(feats[f]) for f, c in zip(m["features"], m["coefficients"]))
    return 1 / (1 + math.exp(-z))


def xt_value(band, lane=None):
    grid = load_codebook()["xt"]["grid"][str(band)]
    if lane in LANES:
        return grid[lane]
    lanes = ("HS_L", "C", "HS_R") if band in (0, 5) else LANES
    return sum(grid[l] for l in lanes) / len(lanes)


@dataclass
class Gain:
    half: int
    t: float
    gain: float
    band: int
    lane: str | None
    seq: int | None


def xt_gains(tl, entry_lane) -> list[Gain]:
    """entry_lane(seq) -> answered lane of the ENTRY card of that band press, or None."""
    min_gain = load_codebook()["xt"]["min_gain"]
    out, lane = [], None
    for b in sorted(tl.bands, key=lambda b: (b.half, b.start)):
        if b.prev is None or b.auto or b.state != "US":
            lane = None
            continue
        new_lane = entry_lane(b.seq)
        new_lane = new_lane if new_lane in LANES else None
        gain = max(0.0, xt_value(b.band, new_lane) - xt_value(b.prev, lane))
        if gain >= min_gain:
            out.append(Gain(b.half, b.start, round(gain, 5), b.band, new_lane, b.seq))
        lane = new_lane
    return out

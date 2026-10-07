"""
build_xg_model - the position xG model (CODEBOOK §7.1): a logistic regression of
goal on the shot's distance and visible goal angle (metres, from the exact
position clicked in the review), header, fast break and set piece. Fitted on the
StatsBomb open-data shots fetched by tools/fetch_sb_shots.py (non-penalty).

It prints a 5-fold cross-validated comparison (Brier score, share of the full
StatsBomb model's improvement over a constant) against the 5-zone table, then
writes the coefficients into shared/codebook.v1.json (xg.position_model).

    .venv/bin/python -m tools.build_xg_model
"""

import glob
import json
import math
from datetime import date

import numpy as np

from src.codebook import CODEBOOK_PATH
from src.v1.models import shot_geometry
from tools.build_xg_table import CACHE, loc_of

FEATURES = ["const", "distance", "angle", "head", "fast_break", "set_piece"]


def load():
    rows = []
    for f in glob.glob(str(CACHE / "shots_v2" / "*.json")):
        for s in json.load(open(f)):
            x, y = s["x"] / 120 * 105, s["y"] / 80 * 68           # StatsBomb 120 x 80 -> metres on 105 x 68
            d, a = shot_geometry(x, y)
            rows.append({"X": [1.0, d, a, s["body"] == "HEAD", s["sit"] == "FAST_BREAK", s["sit"] == "SET_PIECE"],
                         "goal": s["goal"], "sb": s["sb_xg"] or 0.0, "cell": (loc_of(s["x"], s["y"]), s["body"], s["sit"])})
    return rows


def fit(X, y, l2=1e-3, iters=50):
    w = np.zeros(X.shape[1])
    for _ in range(iters):
        p = 1 / (1 + np.exp(-X @ w))
        g = X.T @ (p - y) + l2 * w
        H = (X * (p * (1 - p))[:, None]).T @ X + l2 * np.eye(X.shape[1])
        step = np.linalg.solve(H, g)
        w -= step
        if np.abs(step).max() < 1e-8:
            break
    return w


def main():
    rows = load()
    X = np.array([r["X"] for r in rows], dtype=float)
    y = np.array([r["goal"] for r in rows], dtype=float)
    sb = np.array([r["sb"] for r in rows])
    n = len(rows)
    fold = np.arange(n) % 5
    pos, tab = np.zeros(n), np.zeros(n)
    for k in range(5):
        tr, te = fold != k, fold == k
        w = fit(X[tr], y[tr])
        pos[te] = 1 / (1 + np.exp(-X[te] @ w))
        cells = {}
        for r, t in zip(rows, tr):
            if t:
                c = cells.setdefault(r["cell"], [0, 0]); c[0] += 1; c[1] += r["goal"]
        base = y[tr].mean()
        for i in np.where(te)[0]:
            c = cells.get(rows[i]["cell"])
            tab[i] = (c[1] + base * 10) / (c[0] + 10) if c else base
    brier = lambda p: float(np.mean((p - y) ** 2))
    b0, bsb = brier(np.full(n, y.mean())), brier(sb)
    share = lambda p: (b0 - brier(p)) / (b0 - bsb)
    print(f"{n} shots, {int(y.sum())} goals")
    for name, p in (("constant", np.full(n, y.mean())), ("5-zone table", tab), ("position model", pos), ("StatsBomb model", sb)):
        print(f"{name:16} Brier {brier(p):.4f}  share of StatsBomb's gain {share(p):5.0%}")
    w = fit(X, y)
    cb = json.loads(CODEBOOK_PATH.read_text())
    cb["xg"]["position_model"] = {
        "features": FEATURES, "coefficients": [round(float(c), 5) for c in w],
        "units": "metres on a 105 x 68 pitch, seen from the shooter; angle in radians (visible goal mouth)",
        "fitted_on": f"StatsBomb open data, {n} non-penalty shots; tools/build_xg_model.py", "built": str(date.today()),
        "cv_share_of_statsbomb_gain": round(share(pos), 3), "cv_share_table": round(share(tab), 3)}
    CODEBOOK_PATH.write_text(json.dumps(cb, ensure_ascii=False, indent=2) + "\n")
    print("coefficients", dict(zip(FEATURES, [round(float(c), 3) for c in w])))


if __name__ == "__main__":
    main()

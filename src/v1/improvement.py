"""
improvement - AMÉLIORÉ / STABLE / EN BAISSE / TROP TÔT per metric (CODEBOOK §9.4).

    baseline     mean mu and standard deviation sigma of the reference: last
                 season (shared/baseline.json) or, without it, the first
                 `window` v1 matches ("baseline intra-saison"); the status is
                 then judged on the matches after them.
    threshold    d = sd_factor x sigma
    evaluation   at match i (i >= window): the rolling mean of the last
                 `window` matches beats mu by at least d in the good direction
                 AND at least `min_beating` of those matches beat mu.
    AMÉLIORÉ     the evaluation holds at `consecutive` evaluations in a row;
    EN BAISSE    the mirror; STABLE otherwise; TROP TÔT under `window` matches.
"""

from statistics import mean, pstdev

from src.codebook import load_codebook


def _good(direction):
    return -1 if direction == "↓" else 1


def improvement_status(series, mu, sigma, direction="↑"):
    r = load_codebook()["improvement"]
    w, k, need, consec = r["window"], r["sd_factor"], r["min_beating"], r["consecutive"]
    vals = [v for v in series if v is not None]
    if len(vals) < w:
        return {"status": "TROP TÔT", "n": len(vals)}
    sgn, d = _good(direction), k * sigma

    def holds(i, better=True):
        win = vals[i - w + 1:i + 1]
        s = sgn if better else -sgn
        return s * (mean(win) - mu) >= d and sum(s * (v - mu) > 0 for v in win) >= need

    last = len(vals) - 1
    up = all(holds(i) for i in range(last - consec + 1, last + 1) if i >= w - 1) and last - consec + 1 >= w - 1
    down = all(holds(i, False) for i in range(last - consec + 1, last + 1) if i >= w - 1) and last - consec + 1 >= w - 1
    return {"status": "AMÉLIORÉ" if up else "EN BAISSE" if down else "STABLE", "n": len(vals),
            "rolling": round(mean(vals[-w:]), 4), "mu": mu, "threshold": round(d, 4)}


def baseline_from(series):
    """In-season baseline: the first `window` values -> (mu, sigma, rest)."""
    w = load_codebook()["improvement"]["window"]
    vals = [v for v in series if v is not None]
    if len(vals) < w:
        return None
    first = vals[:w]
    return mean(first), pstdev(first), vals[w:]

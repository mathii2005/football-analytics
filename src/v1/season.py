"""
season (v1) - per-metric series across v1 matches and the improvement status
(CODEBOOK §9.4).

    baseline  shared/baseline.json {metric: {"mean", "sd", "source"}} when the
              re-tag of last season exists; otherwise the first 5 v1 matches
              (label "baseline intra-saison") and the status is judged on the
              matches after them.
    series    the metric's value per match in date order (None when hidden).
"""

import json
from pathlib import Path

from src.v1.improvement import improvement_status, baseline_from

BASELINE = Path(__file__).resolve().parents[2] / "shared" / "baseline.json"


def load_baseline():
    return json.loads(BASELINE.read_text()) if BASELINE.exists() else {}


def season_v1(matches, baseline=None):
    """matches: [{"id", "date", "metrics": compute_metrics(...)}]."""
    baseline = load_baseline() if baseline is None else baseline
    ordered = sorted(matches, key=lambda m: m.get("date") or "")
    ids = sorted({k for m in ordered for k, v in m["metrics"].items() if isinstance(v.get("value"), (int, float))})
    out = {}
    for mid in ids:
        series = [m["metrics"].get(mid, {}).get("value") for m in ordered]
        series = [v if isinstance(v, (int, float)) else None for v in series]
        direction = next((m["metrics"][mid].get("direction") for m in ordered if mid in m["metrics"]), "↑")
        if mid in baseline:
            b = baseline[mid]
            status = improvement_status(series, b["mean"], b["sd"], direction)
            source = b.get("source", "saison précédente")
        else:
            bl = baseline_from(series)
            status = improvement_status(bl[2], bl[0], bl[1], direction) if bl else {"status": "TROP TÔT", "n": sum(v is not None for v in series)}
            source = "baseline intra-saison"
        out[mid] = {"series": [{"id": m["id"], "date": m.get("date"), "value": v} for m, v in zip(ordered, series)],
                    "baseline_source": source, **status}
    return out

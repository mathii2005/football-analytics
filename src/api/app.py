"""
stable data API - already-calculated analytics as JSON

No football logic lives here: every number comes from src/analytics.
The website, the LLM and the Java side only ever read these endpoints.

Matches are the tagger JSON exports in FA_MATCH_DIR (default data/raw);
a match id is the file name without .json.

Run:  .venv/bin/python -m uvicorn src.api.app:app --reload
Docs: http://127.0.0.1:8000/docs
"""

import json
import os
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query

from src.analytics.metrics import match_metrics, possession_row, outcome, time_to_shot_ms
from src.analytics.possessions import format_ms, US, THEM
from src.ingestion.normalize import normalize_match
from src.analytics.quality import quality_report
from src.analytics.report import match_report
from src.analytics.phases import phases_report
from src.analytics.timeline import match_timeline
from src.analytics.season import season_from
from src.analytics.clips import review_clips
from src.analytics.video import veo_info, video_url
from src.v1.season import season_v1
from src.v1.quality import calibration

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def match_dir() -> Path:
    return Path(os.environ.get("FA_MATCH_DIR", PROJECT_ROOT / "data" / "raw"))


app = FastAPI(title="Football analytics API", version="0.1.0")


# ── loading (cached per file version) ──────────────────────────────

def match_path(match_id: str) -> Path:
    path = match_dir() / f"{match_id}.json"
    if not path.is_file() or path.parent != match_dir():
        raise HTTPException(404, f"match '{match_id}' not found")
    return path


@lru_cache(maxsize=64)
def _analyse(path: str, mtime: float):
    return normalize_match(json.loads(Path(path).read_text()), Path(path).stem)


def analyse(match_id: str):
    path = match_path(match_id)
    return _analyse(str(path), path.stat().st_mtime)


def match_info(match_id: str, match: dict) -> dict:
    meta = match.get("match") or {}
    return {
        "id": match_id,
        "date": meta.get("date"),
        "opponent": meta.get("opponent"),
        "venue": meta.get("venue"),
        "final_score": match.get("final_score"),
        "schema_version": meta.get("schemaVersion") or match.get("schema_version"),
        "veo_url": meta.get("veoUrl") or None,
        "v1": "v1" in match,
        "events": len(match.get("events", [])),
    }


# ── endpoints ──────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"ok": True, "match_dir": str(match_dir())}


@app.get("/matches")
def list_matches():
    out = []
    for path in sorted(match_dir().glob("*.json")):
        try:
            match, _ = analyse(path.stem)
        except (json.JSONDecodeError, KeyError, TypeError):
            continue  # not a tagger export
        out.append(match_info(path.stem, match))
    return sorted(out, key=lambda m: m["date"] or "", reverse=True)


@app.get("/matches/{match_id}/summary")
def summary(match_id: str):
    match, possessions = analyse(match_id)
    quality = quality_report(match, possessions)
    return {
        "match": match_info(match_id, match),
        "metrics": match_metrics(possessions),
        "quality": {"ok": quality["ok"], "warnings": quality["warnings"]},
    }


@app.get("/matches/{match_id}/possessions")
def possessions(match_id: str, team: str | None = Query(None, pattern="^(us|them)$"),
                half: int | None = None):
    _, ps = analyse(match_id)
    return [possession_row(p) for p in ps
            if (team is None or p.team == team) and (half is None or p.half == half)]


def next_possession(ps, p):
    i = ps.index(p)
    return ps[i + 1] if i + 1 < len(ps) and ps[i + 1].half == p.half else None


@app.get("/matches/{match_id}/transitions")
def transitions(match_id: str):
    """attacking: every RECUP and what we did with it.
    defensive: every PERTE and what the opponent did with it."""
    match, ps = analyse(match_id)
    veo = veo_info(match)
    attacking = [{
        "possession_id": p.possession_id, "half": p.half, "at": format_ms(p.start_ms),
        "start_ms": p.start_ms, "zone": p.start_zone, "outcome": outcome(p),
        "time_to_shot_ms": time_to_shot_ms(p), "duration_ms": p.duration_ms,
        "video_url": video_url(veo, p.half, p.start_ms),
    } for p in ps if p.team == US and p.start_type == "recup"]
    return {"attacking": attacking, "defensive": losses(match_id)["losses"]}


@app.get("/matches/{match_id}/losses")
def losses(match_id: str):
    match, ps = analyse(match_id)
    veo = veo_info(match)
    rows = []
    for p in ps:
        if p.team != US or p.end_type != "perte":
            continue
        after = next_possession(ps, p)
        rows.append({
            "possession_id": p.possession_id, "half": p.half, "at": format_ms(p.end_ms),
            "end_ms": p.end_ms, "zone": p.end_zone, "outcome": outcome(p),
            "possession_duration_ms": p.duration_ms,
            # what the opponent did with it (their actions are mostly untagged)
            "conceded_goal": after is not None and after.team == THEM and after.end_type == "opp_goal",
            "opponent_possession_ms": after.duration_ms if after is not None and after.team == THEM else None,
            "video_url": video_url(veo, p.half, p.end_ms),
        })
    by_zone = {}
    for r in rows:
        by_zone[str(r["zone"])] = by_zone.get(str(r["zone"]), 0) + 1
    return {"losses": rows, "by_zone": by_zone,
            "conceded_after_loss": sum(r["conceded_goal"] for r in rows)}


@app.get("/matches/{match_id}/report")
def report(match_id: str):
    """Everything the dashboard tabs need beyond the summary: headline
    numbers, halves, zones, attack origins, threat timeline, set pieces
    and generated key points (French)."""
    match, ps = analyse(match_id)
    return {"match": match_info(match_id, match), **match_report(match, ps)}


@app.get("/matches/{match_id}/phases")
def phases(match_id: str):
    """What the possession engine adds: possession splits, durations,
    progression, counter-press, defensive phases, finishing, game time."""
    match, ps = analyse(match_id)
    return phases_report(match, ps)


@app.get("/matches/{match_id}/timeline")
def timeline(match_id: str):
    """Minute-by-minute smoothed threat, rolling possession share and events."""
    match, ps = analyse(match_id)
    return match_timeline(match, ps)


@app.get("/season")
def season():
    """One profile per tagged match plus mean/min/max: the radar and bullet baseline."""
    items = []
    for path in sorted(match_dir().glob("*.json")):
        try:
            match, ps = analyse(path.stem)
        except (ValueError, KeyError, TypeError, AttributeError, HTTPException):
            continue   # not a readable tagger export
        if isinstance(match, dict) and isinstance(match.get("events"), list) and isinstance(match.get("match"), dict):
            items.append((path.stem, match, ps))
    return season_from(items)


@app.get("/matches/{match_id}/clips")
def clips(match_id: str):
    """Veo moments worth reviewing, chosen by cost/benefit and game context."""
    match, ps = analyse(match_id)
    return review_clips(match, ps, veo_info(match))


@app.get("/matches/{match_id}/quality")
def quality(match_id: str):
    match, ps = analyse(match_id)
    q = quality_report(match, ps)
    veo = veo_info(match)
    for g in q["long_gaps"]:
        g["video_url"] = video_url(veo, g["half"], g["from_ms"])
    return q


# ── v1 (two-pass tagger) ───────────────────────────────────────────

def _v1_payload(match):
    v1 = match["v1"]
    tl = v1["timeline"]
    return {
        "available": True,
        "codebook_version": v1["meta"].get("codebook_version"),
        "metrics": v1["metrics"],
        "gates": v1["gates"],
        "calibration": calibration(v1.get("ops", [])),
        "minutes": {s: round(sum(x.end - x.start for x in tl.states if x.state == s) / 60000, 2)
                    for s in ("US", "THEM", "DEAD", "UNKNOWN")},
        "halves": {h: [a, b] for h, (a, b) in tl.halves.items()},
    }


@app.get("/matches/{match_id}/metrics")
def metrics(match_id: str):
    """The v1 metric catalogue (CODEBOOK §8) with clips, gates and quality; {available: false} for old exports."""
    match, _ = analyse(match_id)
    return _v1_payload(match) if "v1" in match else {"available": False}


@app.get("/season/v1")
def season_v1_endpoint():
    """Per-metric series over the v1 matches with the improvement status (CODEBOOK §9.4)."""
    items = []
    for path in sorted(match_dir().glob("*.json")):
        try:
            match, _ = analyse(path.stem)
        except (ValueError, KeyError, TypeError, AttributeError, HTTPException):
            continue
        if "v1" in match:
            meta = match["match"]
            items.append({"id": path.stem, "match_id": meta.get("id"), "date": meta.get("date"), "opponent": meta.get("opponent"),
                          "final_score": match.get("final_score"), "metrics": match["v1"]["metrics"]})
    seen, uniq = set(), []
    for m in sorted(items, key=lambda x: x["date"] or "", reverse=True):     # one entry per match id (latest file)
        if m["match_id"] not in seen:
            seen.add(m["match_id"]); uniq.append(m)
    return {"matches": [{k: m[k] for k in ("id", "date", "opponent", "final_score")} for m in sorted(uniq, key=lambda x: x["date"] or "")],
            "metrics": season_v1(uniq)}

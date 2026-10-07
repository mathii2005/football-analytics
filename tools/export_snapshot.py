"""
export_snapshot - the staff export: the whole dashboard of one match frozen in a
single HTML page (no server needed), to publish as a private link.

    cd dashboard && npm run build:snapshot          # once per dashboard change
    .venv/bin/python -m tools.export_snapshot laureats_2026-10-02_Ahuntsic_v1

Every API answer the staff pages need (metrics for the match and each half,
recap, details, possessions, sentences, the season under every filter) is
embedded as JSON in the page; the dashboard reads it instead of /api, with
editing and the analyst page switched off. The page is written to
data/exports/<match>_staff.html (git-ignored: named player stats).
"""

import json
import re
import sys
from pathlib import Path

from fastapi.testclient import TestClient

from src.api.app import app

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "dashboard" / "dist-snapshot" / "index.html"
OUT = ROOT / "data" / "exports"


def collect(client, match_id):
    m = f"/matches/{match_id}"
    paths = [f"{m}/metrics", f"{m}/metrics?half=1", f"{m}/metrics?half=2", f"{m}/recap", f"{m}/details",
             f"{m}/possessions", f"{m}/texts", "/season/v1"]
    paths += [f"/season/v1?{q}" for q in
              [f"tier={t}" for t in ("top", "mid", "bottom")] + [f"venue={v}" for v in ("home", "away")] +
              [f"tier={t}&venue={v}" for t in ("top", "mid", "bottom") for v in ("home", "away")]]
    out = {}
    for p in paths:
        r = client.get(p)
        if r.status_code != 200:
            raise SystemExit(f"{p}: {r.status_code} {r.text[:200]}")
        out[p] = r.json()
    out["/matches"] = [x for x in client.get("/matches").json() if x["id"] == match_id]   # this match only
    if not out["/matches"]:
        raise SystemExit(f"{match_id}: not a v1 match in the match folder")
    return out


def page(html, snapshot, title):
    """The built page made fit for an Artifact: no document wrapper, a short title,
    the match data embedded before the app script, an explicit background."""
    data = json.dumps(snapshot, ensure_ascii=False).replace("</", "<\\/")
    scripts = re.findall(r"<script\b[^>]*>.*?</script>", html, flags=re.S)
    styles = re.findall(r"<style\b[^>]*>.*?</style>", html, flags=re.S)
    return "\n".join([
        '<meta charset="utf-8">',
        f"<title>{title}</title>",
        '<meta name="robots" content="noindex">',
        "<style>html,body{background:#f3f3f3;margin:0}</style>",
        *styles,
        '<div id="root"></div>',
        f'<script id="snapshot-data" type="application/json">{data}</script>',
        *scripts,
    ])


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    match_id = sys.argv[1]
    if not BUILD.exists():
        raise SystemExit("build first: cd dashboard && npm run build:snapshot")
    snap = {"match": match_id, "paths": collect(TestClient(app), match_id)}
    info = snap["paths"]["/matches"][0]
    title = f"Lauréats vs {info['opponent']}"
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{match_id}_staff.html"
    path.write_text(page(BUILD.read_text(), snap, title))
    print(f"{path} ({path.stat().st_size // 1024} kB) · {title} · {len(snap['paths'])} API answers")


if __name__ == "__main__":
    main()

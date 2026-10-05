"""
build_xg_table - the codebook's published xG table (CODEBOOK §7.1), from
StatsBomb open data (github.com/statsbomb/open-data). Run once:

    .venv/bin/python -m tools.build_xg_table              # downloads what is missing
    .venv/bin/python -m tools.build_xg_table --cached     # only the matches already downloaded

Shots of the competitions below (men, non-penalty) are bucketed into our
categories, then cell value = goals / shots. A cell with fewer than
min_cell_shots shots backs off to (loc, body, OPEN), then to (loc). The table,
the shot count per cell, the source and the date are written into
shared/codebook.v1.json (xg.table, xg.counts) and the provisional flag is
removed. Downloads are cached in data/statsbomb/ (git-ignored).

Bucketing (StatsBomb pitch 120 x 80 yards, attacking left to right):
    loc        SIX         x >= 114 and 30 <= y <= 50 (6-yard box)
               CENTRAL_BOX in the box (x >= 102, 18 <= y <= 62), 30 <= y <= 50
               WIDE_BOX    in the box, in a half-space (18-30 or 50-62)
               CENTRAL_OUT outside the box, 18 <= y <= 62
               WIDE_OUT    outside the box, y < 18 or y > 62
    body       Head or Other -> HEAD, else FOOT
    situation  play pattern From Corner / From Free Kick, or a direct free
               kick -> SET_PIECE; play pattern From Counter, or a shot within
               10 s of the start of a regular-play possession -> FAST_BREAK;
               else OPEN
"""

import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

from src.codebook import CODEBOOK_PATH

BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"
COMPETITIONS = [(43, 3, "FIFA World Cup 2018"), (43, 106, "FIFA World Cup 2022"), (55, 43, "UEFA Euro 2020"),
                (55, 282, "UEFA Euro 2024"), (223, 282, "Copa America 2024"), (1267, 107, "African Cup of Nations 2023")]
CACHE = Path(__file__).resolve().parents[1] / "data" / "statsbomb"
LOCS = ["SIX", "CENTRAL_BOX", "WIDE_BOX", "CENTRAL_OUT", "WIDE_OUT"]
BODIES = ["FOOT", "HEAD"]
SITS = ["OPEN", "FAST_BREAK", "SET_PIECE"]


def download(url: str) -> bytes:
    """curl rather than urllib: works without Python's certificate bundle."""
    for attempt in range(3):
        r = subprocess.run(["curl", "-sfL", "--max-time", "400", url], capture_output=True)
        if r.returncode == 0:
            return r.stdout
    raise RuntimeError(f"download failed: {url}")


def fetch(url, path):
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(download(url))
    return json.loads(path.read_text())


def loc_of(x, y):
    in_box = x >= 102 and 18 <= y <= 62
    if x >= 114 and 30 <= y <= 50:
        return "SIX"
    if in_box:
        return "CENTRAL_BOX" if 30 <= y <= 50 else "WIDE_BOX"
    return "CENTRAL_OUT" if 18 <= y <= 62 else "WIDE_OUT"


def shots_of_match(match_id):
    """Minimal shot records of one match (cached as shots only)."""
    out_path = CACHE / "shots" / f"{match_id}.json"
    if out_path.exists():
        return json.loads(out_path.read_text())
    events = fetch(f"{BASE}/events/{match_id}.json", CACHE / "tmp" / f"{match_id}.json")
    start = {}
    for e in events:
        start.setdefault(e["possession"], e["minute"] * 60 + e["second"])
    shots = []
    for e in events:
        if e["type"]["name"] != "Shot" or e["shot"]["type"]["name"] == "Penalty":
            continue
        x, y = e["location"][:2]
        body = "HEAD" if e["shot"]["body_part"]["name"] in ("Head", "Other") else "FOOT"
        pattern = e["play_pattern"]["name"]
        since = e["minute"] * 60 + e["second"] - start[e["possession"]]
        if pattern in ("From Corner", "From Free Kick") or e["shot"]["type"]["name"] == "Free Kick":
            sit = "SET_PIECE"
        elif pattern == "From Counter" or (pattern == "Regular Play" and since <= 10):
            sit = "FAST_BREAK"
        else:
            sit = "OPEN"
        shots.append({"loc": loc_of(x, y), "body": body, "sit": sit, "goal": e["shot"]["outcome"]["name"] == "Goal"})
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(shots))
    (CACHE / "tmp" / f"{match_id}.json").unlink(missing_ok=True)
    return shots


def build(shots, min_cell):
    def rate(sel):
        n = len(sel)
        return (sum(s["goal"] for s in sel) / n, n) if n else (None, 0)

    table, counts = {}, {}
    for loc in LOCS:
        table[loc], counts[loc] = {}, {}
        for body in BODIES:
            table[loc][body], counts[loc][body] = {}, {}
            for sit in SITS:
                cell = [s for s in shots if (s["loc"], s["body"], s["sit"]) == (loc, body, sit)]
                v, n = rate(cell)
                if n < min_cell:
                    v, n2 = rate([s for s in shots if (s["loc"], s["body"]) == (loc, body) and s["sit"] in (sit, "OPEN")])
                    if n2 < min_cell:
                        v, _ = rate([s for s in shots if s["loc"] == loc])
                table[loc][body][sit] = round(v, 4)
                counts[loc][body][sit] = n
    return table, counts


def main():
    import sys
    cached_only = "--cached" in sys.argv
    matches = []
    for comp, season, name in COMPETITIONS:
        matches += [m["match_id"] for m in fetch(f"{BASE}/matches/{comp}/{season}.json", CACHE / "matches" / f"{comp}_{season}.json")]
    def safe(mid):                      # resumable: cached per match, failures skipped
        if cached_only and not (CACHE / "shots" / f"{mid}.json").exists():
            return None
        try:
            return shots_of_match(mid)
        except Exception as e:          # noqa: BLE001 - one bad download must not stop the build
            print("skipped", mid, e)
            return None
    with ThreadPoolExecutor(3) as pool:
        per_match = list(pool.map(safe, matches))
    used = [m for m, s in zip(matches, per_match) if s is not None]
    shots = [s for ms in per_match if ms for s in ms]
    matches = used
    cb = json.loads(CODEBOOK_PATH.read_text())
    table, counts = build(shots, cb["xg"]["min_cell_shots"])
    cb["xg"].update({"table": table, "counts": counts, "provisional": False, "built": str(date.today()),
                     "source": f"StatsBomb open data, {len(matches)} matches ({', '.join(n for *_, n in COMPETITIONS)}), "
                               f"{len(shots)} non-penalty shots; tools/build_xg_table.py"})
    CODEBOOK_PATH.write_text(json.dumps(cb, ensure_ascii=False, indent=2) + "\n")
    print(f"{len(matches)} matches, {len(shots)} shots, overall conversion {sum(s['goal'] for s in shots) / len(shots):.3f}")
    for loc in LOCS:
        print(loc.ljust(12), "  ".join(f"{b}/{s}: {table[loc][b][s]:.3f} (n={counts[loc][b][s]})" for b in BODIES for s in SITS))


if __name__ == "__main__":
    main()

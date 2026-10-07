"""
fetch_sb_shots - StatsBomb open data shots with their exact positions, for the
position xG model (tools/build_xg_model.py). Same competitions as the xG table.
Each match's events are downloaded, reduced to its non-penalty shots, and the
raw file is deleted: data/statsbomb/shots_v2/<match_id>.json (git-ignored).

    .venv/bin/python -m tools.fetch_sb_shots
"""

import json
from concurrent.futures import ThreadPoolExecutor

from tools.build_xg_table import BASE, CACHE, COMPETITIONS, download, fetch

OUT = CACHE / "shots_v2"


def shots_v2(match_id):
    path = OUT / f"{match_id}.json"
    if path.exists():
        return "cached"
    events = json.loads(download(f"{BASE}/events/{match_id}.json"))
    start = {}
    for e in events:
        start.setdefault(e["possession"], e["minute"] * 60 + e["second"])
    shots = []
    for e in events:
        if e["type"]["name"] != "Shot" or e["shot"]["type"]["name"] == "Penalty":
            continue
        s = e["shot"]
        pattern = e["play_pattern"]["name"]
        since = e["minute"] * 60 + e["second"] - start[e["possession"]]
        sit = "SET_PIECE" if pattern in ("From Corner", "From Free Kick") or s["type"]["name"] == "Free Kick" else \
              "FAST_BREAK" if pattern == "From Counter" or (pattern == "Regular Play" and since <= 10) else "OPEN"
        end = s.get("end_location") or [None, None, None]
        shots.append({"x": e["location"][0], "y": e["location"][1], "body": "HEAD" if s["body_part"]["name"] in ("Head", "Other") else "FOOT",
                      "sit": sit, "goal": s["outcome"]["name"] == "Goal", "outcome": s["outcome"]["name"],
                      "end_x": end[0], "end_y": end[1], "end_z": end[2] if len(end) > 2 else None,
                      "sb_xg": s.get("statsbomb_xg"), "first_time": bool(s.get("first_time")), "under_pressure": bool(e.get("under_pressure"))})
    OUT.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(shots))
    return len(shots)


def main():
    ids = []
    for comp, season, _ in COMPETITIONS:
        ids += [m["match_id"] for m in fetch(f"{BASE}/matches/{comp}/{season}.json", CACHE / "matches" / f"{comp}_{season}.json")]

    def safe(mid):
        try:
            return shots_v2(mid)
        except Exception as e:      # noqa: BLE001 - one bad download must not stop the rest
            return f"skipped {e}"
    with ThreadPoolExecutor(4) as pool:
        res = list(pool.map(safe, ids))
    ok = [r for r in res if not str(r).startswith("skipped")]
    print(f"{len(ok)}/{len(ids)} matches, {sum(r for r in ok if isinstance(r, int))} new shots")


if __name__ == "__main__":
    main()

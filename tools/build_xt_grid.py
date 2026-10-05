"""
build_xt_grid - the codebook's coarse xT grid (CODEBOOK §1.3, §7.2), from
Karun Singh's published expected-threat grid (12 columns along the length x 8
rows across the width, own goal on the left). Run once:

    .venv/bin/python -m tools.build_xt_grid

Our value for a cell (band x lane) = the mean of the source cells whose
centres fall inside it, on a 105 x 68 m pitch. Bands 0 and 5 are the boxes
(only 40.32 m wide): their L / R lanes take the neighbouring half-space value.
Written into shared/codebook.v1.json (xt.grid, keyed band -> lane).
"""

import json
import subprocess
from datetime import date

from src.codebook import CODEBOOK_PATH

SOURCE = "https://karun.in/blog/data/open_xt_12x8_v1.json"


def download(url: str) -> bytes:
    """curl rather than urllib: works without Python's certificate bundle."""
    return subprocess.run(["curl", "-sfL", "--max-time", "120", url], check=True, capture_output=True).stdout


def coarsen(src, geom):
    L, W = geom["pitch_reference_m"]["length"], geom["pitch_reference_m"]["width"]
    rows, cols = len(src), len(src[0])
    centres = [((c + 0.5) * L / cols, (r + 0.5) * W / rows, src[r][c]) for r in range(rows) for c in range(cols)]
    box_y = ((W - geom["pitch_reference_m"]["box_width"]) / 2, (W + geom["pitch_reference_m"]["box_width"]) / 2)
    depth = geom["pitch_reference_m"]["box_depth"]
    lanes = {l["code"]: l["y_m"] for l in geom["lanes"]}

    def in_band(band, x, y):
        in_own_box = x <= depth and box_y[0] <= y <= box_y[1]
        in_their_box = x >= L - depth and box_y[0] <= y <= box_y[1]
        if band == 0:
            return in_own_box
        if band == 5:
            return in_their_box
        lo, hi = {1: (0, 26.25), 2: (26.25, 52.5), 3: (52.5, 78.75), 4: (78.75, L)}[band]
        return lo <= x < hi and not in_own_box and not in_their_box

    grid = {}
    for band in range(6):
        grid[str(band)] = {}
        for code, (y0, y1) in lanes.items():
            vals = [v for x, y, v in centres if in_band(band, x, y) and y0 <= y < y1]
            grid[str(band)][code] = round(sum(vals) / len(vals), 5) if vals else None
        if band in (0, 5):
            grid[str(band)]["L"] = grid[str(band)]["HS_L"]
            grid[str(band)]["R"] = grid[str(band)]["HS_R"]
    return grid


def main():
    src = json.loads(download(SOURCE))
    cb = json.loads(CODEBOOK_PATH.read_text())
    grid = coarsen(src, cb["geometry"])
    cb["xt"].update({"grid": grid, "provisional": False, "built": str(date.today()), "source_url": SOURCE})
    CODEBOOK_PATH.write_text(json.dumps(cb, ensure_ascii=False, indent=2) + "\n")
    for band in map(str, range(6)):
        print(band, grid[band])


if __name__ == "__main__":
    main()

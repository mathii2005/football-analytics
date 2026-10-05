"""
Codebook v1: the JSON (shared/codebook.v1.json) must say exactly what the
markdown (docs/pipeline/CODEBOOK.md) says. The markdown is the human source,
the JSON is what the tagger, the review quiz, the engine and the dashboard
read. These tests parse the markdown tables and compare.
"""

import re
from pathlib import Path

import pytest

from src.codebook import load_codebook, codebook_sha256, CODEBOOK_PATH

ROOT = Path(__file__).resolve().parents[1]
MD = (ROOT / "docs" / "pipeline" / "CODEBOOK.md").read_text()


# ---------- markdown helpers ----------

def section(title_prefix: str) -> str:
    """Text of the section whose heading starts with `title_prefix`, up to the next heading of the same or higher level."""
    lines = MD.splitlines()
    for i, line in enumerate(lines):
        m = re.match(r"^(#+)\s+(.*)$", line)
        if m and m.group(2).startswith(title_prefix):
            level = len(m.group(1))
            out = []
            for nxt in lines[i + 1:]:
                n = re.match(r"^(#+)\s", nxt)
                if n and len(n.group(1)) <= level:
                    break
                out.append(nxt)
            return "\n".join(out)
    raise AssertionError(f"section {title_prefix!r} not found")


def table_rows(text: str) -> list[list[str]]:
    """Rows (header excluded) of every markdown table in `text`, cells stripped."""
    rows, header_seen = [], False
    for line in text.splitlines():
        if not line.startswith("|"):
            header_seen = False
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-+:?", c) for c in cells):
            continue
        if not header_seen:
            header_seen = True
            continue
        rows.append(cells)
    return rows


def ticks(cell: str) -> list[str]:
    return re.findall(r"`([^`]+)`", cell)


# ---------- tests ----------

def test_json_loads_and_versions_match():
    cb = load_codebook()
    title_version = re.search(r"^# .*— v(\d+\.\d+\.\d+)", MD, re.M).group(1)
    assert cb["version"] == title_version == "1.1.0"
    assert re.fullmatch(r"[0-9a-f]{64}", codebook_sha256())
    assert CODEBOOK_PATH.name == "codebook.v1.json"


def test_match_keys_agree_with_markdown():
    cb = load_codebook()
    md = {}
    for row in table_rows(section("3.1")):
        key_cell, code_cell = row[0], row[1]
        if not ticks(key_cell):                   # the auto-band table shares the section
            continue
        if key_cell.startswith("`0`"):          # the 0–5 band row
            for n in range(6):
                md[str(n)] = f"Z:{n}"
            continue
        md[ticks(key_cell)[0]] = ticks(code_cell)[0]
    js = {k["key"]: k["code"] for k in cb["keys"]["match"]}
    assert js == md


def test_comfort_keys_agree_with_markdown():
    cb = load_codebook()
    md_keys = set()
    for row in table_rows(section("3.2")):
        md_keys.update(ticks(row[0]) or [row[0].replace("Button ", "").strip("* ")])
    js_keys = set()
    for k in cb["keys"]["comfort"]:
        js_keys.update(k["keys"])
    assert js_keys == md_keys


def test_auto_bands_agree_with_markdown():
    cb = load_codebook()
    md = {}
    names = {"Kick-off": "KICKOFF", "Corner": "CORNER", "Goal kick": "GK", "Penalty": "PEN"}
    for row in table_rows(section("3.1")):
        if row[0] in names:
            md[names[row[0]]] = {"US": int(row[1]), "THEM": int(row[2])}
    assert cb["auto_bands"] == md


def test_cards_agree_with_markdown():
    cb = load_codebook()
    cards = {c["id"]: c for c in cb["cards"]}
    md_cards = {}
    for sub in ("5.1", "5.2", "5.3"):
        for row in table_rows(section(sub)):
            card_id = re.search(r"\*\*([A-Z_]+)\*\*", row[0]).group(1)
            md_cards[card_id] = row[2]
    assert set(cards) == set(md_cards)
    for cid, cell in md_cards.items():
        c = cards[cid]
        md_values = set(ticks(cell))
        for q in c["questions"]:
            assert f"**{q['id']}**" in cell, f"{cid}: question {q['id']} not in markdown"
            for v in q["values"]:
                assert v in md_values, f"{cid}.{q['id']}: value {v} not in markdown"
        js_values = {v for q in c["questions"] for v in q["values"]}
        assert md_values <= js_values, f"{cid}: markdown values {md_values - js_values} missing from JSON"


def test_card_tiers_fill_the_60_minute_budget():
    cb = load_codebook()
    tiers = cb["review"]["tiers"]
    assert [t["minutes"] for t in tiers] == [30, 20, 10]
    assert sum(t["minutes"] for t in tiers) == cb["review"]["budget_minutes"] == 60
    ids = [cid for t in tiers for cid in t["cards"]]
    assert sorted(ids) == sorted(c["id"] for c in cb["cards"])


def test_metrics_agree_with_markdown():
    cb = load_codebook()
    md = {}
    for sub in ("8.1", "8.2", "8.3", "8.4", "8.5", "8.6"):
        for row in table_rows(section(sub)):
            ids = [i for i in ticks(row[0]) if "*" not in i]
            for i in ids:
                md[i] = {"min_n": row[4], "direction": row[5]}
    js = {m["id"]: m for m in cb["metrics"]}
    assert set(js) == set(md)
    for mid, want in md.items():
        assert js[mid]["min_n"] == want["min_n"], mid
        # a row can hold "↑ / ↓" for for/against pairs: each id takes its own arrow
        arrows = [a.strip() for a in want["direction"].split("/")]
        assert js[mid]["direction"] in arrows or want["direction"] == js[mid]["direction"], mid


def test_key_constants_match_the_text():
    cb = load_codebook()
    assert cb["clock"]["half2_start_ms"] == 2_700_000 and "2 700 000" in MD
    assert cb["clock"]["clip_lead_ms"] == 5000
    assert cb["xg"]["penalty"] == 0.76 and "**0.76**" in MD
    assert cb["improvement"]["window"] == 5 and cb["improvement"]["sd_factor"] == 0.5
    assert cb["improvement"]["min_beating"] == 3 and cb["improvement"]["consecutive"] == 2
    assert cb["load"] == {"target_per_min": 10, "cap_per_min": 12, "block_alarm_per_min": 14, "block_minutes": 15}


@pytest.mark.parametrize("band", range(6))
def test_bands_are_complete(band):
    cb = load_codebook()
    assert cb["geometry"]["bands"][band]["id"] == band

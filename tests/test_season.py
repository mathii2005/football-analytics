import json
import shutil
from pathlib import Path

import pytest

from src.analytics.possessions import possessions_from_match
from src.analytics.season import match_profile, season_profile, METRICS

FIX = Path(__file__).parent / "fixtures"


def test_match_profile_vanier():
    m = json.loads((FIX / "vanier_2026-09-26.json").read_text())
    p = match_profile(m, possessions_from_match(m))
    assert set(p) == set(METRICS)
    assert p["possession"] == pytest.approx(0.556, abs=0.01)
    assert p["high_recup_share"] == pytest.approx(0.328, abs=0.01)
    assert p["verticality"] == 1.0
    assert p["shots"] == 8


def test_season_summary_min_max_mean(tmp_path):
    shutil.copy(FIX / "vanier_2026-09-26.json", tmp_path / "a.json")
    shutil.copy(FIX / "champlain_15min.json", tmp_path / "b.json")
    s = season_profile(sorted(tmp_path.glob("*.json")))
    assert len(s["matches"]) == 2
    shots = [x["metrics"]["shots"] for x in s["matches"]]
    assert s["summary"]["shots"] == {"mean": sum(shots) / 2, "min": min(shots), "max": max(shots)}


def test_season_single_match(tmp_path):
    shutil.copy(FIX / "champlain_15min.json", tmp_path / "b.json")
    s = season_profile(sorted(tmp_path.glob("*.json")))
    v = s["summary"]["shots"]
    assert v["min"] == v["max"] == v["mean"]


def test_season_skips_non_exports(tmp_path):
    shutil.copy(FIX / "champlain_15min.json", tmp_path / "b.json")
    (tmp_path / "notes.json").write_text("not json")
    (tmp_path / "other.json").write_text('{"hello": 1}')
    assert len(season_profile(sorted(tmp_path.glob("*.json")))["matches"]) == 1


def test_season_ignores_duplicate_exports(tmp_path):
    shutil.copy(FIX / "champlain_15min.json", tmp_path / "b.json")
    shutil.copy(FIX / "champlain_15min.json", tmp_path / "b copy.json")
    assert len(season_profile(sorted(tmp_path.glob("*.json")))["matches"]) == 1


def test_season_entry_lists_every_file_of_a_match(tmp_path):
    shutil.copy(FIX / "champlain_15min.json", tmp_path / "b.json")
    shutil.copy(FIX / "champlain_15min.json", tmp_path / "b copy.json")
    s = season_profile(sorted(tmp_path.glob("*.json")))
    assert sorted(s["matches"][0]["ids"]) == ["b", "b copy"]


def test_season_skips_a_match_whose_profile_fails():
    from src.analytics.season import season_from
    good = json.loads((FIX / "champlain_15min.json").read_text())
    bad = {"match": {"id": "x"}, "events": [{"code": "RECUP"}]}   # malformed event: no half / timestamp
    s = season_from([("good", good, possessions_from_match(good)), ("bad", bad, [])])
    assert [m["ids"] for m in s["matches"]] == [["good"]]

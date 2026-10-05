import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.api.app import app

FIXTURES = Path(__file__).parent / "fixtures"
RAW = Path(__file__).parents[1] / "data" / "raw"


@pytest.fixture
def client(tmp_path, monkeypatch):
    shutil.copy(FIXTURES / "champlain_15min.json", tmp_path / "champlain_15min.json")
    shutil.copy(next(RAW.glob("*match_001*.json")), tmp_path / "match_001.json")
    (tmp_path / "notes.json").write_text("not a match")
    monkeypatch.setenv("FA_MATCH_DIR", str(tmp_path))
    return TestClient(app)


def test_list_matches_skips_non_exports(client):
    ids = [m["id"] for m in client.get("/matches").json()]
    assert sorted(ids) == ["champlain_15min", "match_001"]


def test_unknown_match_404(client):
    assert client.get("/matches/nope/summary").status_code == 404
    assert client.get("/matches/..%2Fsecret/summary").status_code == 404


def test_summary(client):
    body = client.get("/matches/match_001/summary").json()
    assert body["match"]["final_score"] == {"us": 2, "them": 1}
    assert body["metrics"]["possessions_us"] == 10
    assert body["metrics"]["outcomes"]["goal"] == 2
    assert "kickoff team not recorded: half starts are assumed" in body["quality"]["warnings"]


def test_possessions_filter(client):
    rows = client.get("/matches/champlain_15min/possessions", params={"team": "us"}).json()
    assert len(rows) == 13 and {r["team"] for r in rows} == {"us"}
    assert client.get("/matches/champlain_15min/possessions", params={"team": "x"}).status_code == 422


def test_losses_and_transitions(client):
    losses = client.get("/matches/match_001/losses").json()
    assert len(losses["losses"]) == 8
    assert losses["conceded_after_loss"] == 1      # PERTE 07:54 -> their goal
    t = client.get("/matches/match_001/transitions").json()
    assert len(t["attacking"]) == 7
    assert t["defensive"] == losses["losses"]


def test_quality(client):
    q = client.get("/matches/champlain_15min/quality").json()
    assert q["score_check"]["our_goals"] == 0
    assert q["long_gaps"] == [] and q["inferred_transitions"] == []


def test_report_and_clips(client):
    r = client.get("/matches/champlain_15min/report").json()
    assert {"headline", "halves", "zones", "attack_origins", "threat", "set_pieces", "key_points"} <= set(r)
    c = client.get("/matches/champlain_15min/clips").json()
    assert c["has_video"] is True
    assert all(clip["video_url"].startswith("https://app.veo.co/") for clip in c["selection"])
    losses = client.get("/matches/champlain_15min/losses").json()["losses"]
    assert all("#t=" in row["video_url"] for row in losses)


def test_clips_without_video(client):
    c = client.get("/matches/match_001/clips").json()
    assert c["has_video"] is False
    assert all(clip["video_url"] is None for clip in c["selection"])


def test_phases_endpoint(client):
    r = client.get("/matches/champlain_15min/phases")
    assert r.status_code == 200
    assert {"splits", "profile", "progression", "counter_press", "defence", "finishing", "game_time"} <= set(r.json())
    assert client.get("/matches/nope/phases").status_code == 404


def test_report_has_classic_blocks(client):
    r = client.get("/matches/match_001/report").json()
    assert {"transition_speed", "funnel", "couloir_origins", "recovery_distribution", "tempo", "cards",
            "actions_by_type", "box_entries_by_type", "attack_style", "actions_by_arrival_zone"} <= set(r)


def test_clips_library_facets(client):
    c = client.get("/matches/champlain_15min/clips").json()
    assert c["library"] and all("state" in x and "period" in x for x in c["library"])


def test_season_and_timeline_endpoints(client):
    s = client.get("/season").json()
    assert {m["id"] for m in s["matches"]} == {"champlain_15min", "match_001"}
    assert "possession" in s["summary"]
    t = client.get("/matches/champlain_15min/timeline").json()
    assert t["minutes"] and "events" in t


# ---- v1 matches (two-pass tagger) go through every endpoint ----

@pytest.fixture
def v1_client(tmp_path, monkeypatch):
    shutil.copy(FIXTURES / "ahuntsic_2026-10-02_h1_v1.json", tmp_path / "ahuntsic_h1.json")
    shutil.copy(FIXTURES / "champlain_15min.json", tmp_path / "champlain_15min.json")
    monkeypatch.setenv("FA_MATCH_DIR", str(tmp_path))
    return TestClient(app)


def test_v1_match_is_listed_and_summarised(v1_client):
    listed = {m["id"]: m for m in v1_client.get("/matches").json()}
    assert listed["ahuntsic_h1"]["opponent"] == "Ahuntsic"
    assert listed["ahuntsic_h1"]["final_score"] == {"us": 0, "them": 2}
    s = v1_client.get("/matches/ahuntsic_h1/summary").json()
    assert round(s["metrics"]["possession_pct"]["strict"] * 100) == 58


@pytest.mark.parametrize("endpoint", ["report", "phases", "timeline", "clips", "possessions", "transitions", "losses", "quality"])
def test_v1_match_serves_every_endpoint(v1_client, endpoint):
    r = v1_client.get(f"/matches/ahuntsic_h1/{endpoint}")
    assert r.status_code == 200, r.text[:300]


def test_v1_match_in_season(v1_client):
    ids = [m["id"] for m in v1_client.get("/season").json()["matches"]]
    assert "ahuntsic_h1" in ids


def test_v1_metrics_endpoint(v1_client):
    d = v1_client.get("/matches/ahuntsic_h1/metrics").json()
    assert d["available"] and d["metrics"]["shots_for"]["value"] == 4
    assert {g["id"] for g in d["gates"]} == {"G1", "G2", "G3", "G4", "G5"}
    assert d["metrics"]["box_entries"]["clips"]["all"][0]["url"].startswith("https://app.veo.co/")
    assert v1_client.get("/matches/champlain_15min/metrics").json() == {"available": False}


def test_season_v1_endpoint(v1_client):
    d = v1_client.get("/season/v1").json()
    assert [m["id"] for m in d["matches"]] == ["ahuntsic_h1"]
    assert d["metrics"]["box_entries"]["status"] == "TROP TÔT"


def test_recap_endpoint_first_match_vs_opponent(v1_client):
    r = v1_client.get("/matches/ahuntsic_h1/recap").json()
    assert r["available"] and r["mode"] == "vs_opponent" and r["n_other_matches"] == 0
    assert r["brief"]["goals_against"]["value"] == 2
    assert all(x["score"] > 0 for x in r["best"]) and all(x["score"] < 0 for x in r["worst"])
    assert v1_client.get("/matches/champlain_15min/recap").json() == {"available": False}


def test_half_filter_recomputes_the_metrics(tmp_path, monkeypatch):
    shutil.copy(FIXTURES / "ahuntsic_2026-10-02_full_v1.json", tmp_path / "ahuntsic.json")
    monkeypatch.setenv("FA_MATCH_DIR", str(tmp_path))
    c = TestClient(app)
    full = c.get("/matches/ahuntsic/metrics").json()["metrics"]
    h1 = c.get("/matches/ahuntsic/metrics?half=1").json()["metrics"]
    h2 = c.get("/matches/ahuntsic/metrics?half=2").json()["metrics"]
    assert h1["shots_for"]["value"] + h2["shots_for"]["value"] == full["shots_for"]["value"]
    assert h1["goals_against"]["value"] == 2 and h1["field_tilt_classic"]["value"] is None
    assert c.get("/matches/ahuntsic/metrics?half=3").status_code == 422
    assert c.get("/season/v1?tier=top").json()["matches"] == []
    assert len(c.get("/season/v1?tier=mid&venue=home").json()["matches"]) == 1

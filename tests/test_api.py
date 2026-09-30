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

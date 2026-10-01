import pytest

from src.analytics.possessions import reconstruct_possessions
from src.analytics.timeline import match_timeline


def ev(t_s, code, team=None, zone=None, is_box=False, half=1, score_us=0, score_them=0):
    return {"id": f"{code}{t_s}", "timestamp_ms": t_s * 1000, "half": half, "code": code, "team": team,
            "zone": zone, "is_box": is_box, "couloir": None, "score_us": score_us, "score_them": score_them}


def run(events, kickoff="us"):
    return match_timeline({"events": events, "match": {}}, reconstruct_possessions(events, kickoff_team=kickoff))


def minute(tl, half, m):
    return next(x for x in tl["minutes"] if x["half"] == half and x["minute"] == m)


def test_threat_per_minute():
    tl = run([ev(10 * 60 + 30, "TIR_C"), ev(20 * 60, "PERTE", zone=3)])
    assert minute(tl, 1, 10)["threat"] == 4
    assert minute(tl, 1, 11)["threat"] == 0


def test_smoothing_preserves_total():
    events = [ev(60 * m + 5, "CONDUITE", zone=3) for m in (2, 3, 9, 15)] + [ev(16 * 60, "TIR_C"), ev(18 * 60, "PERTE", zone=3)]
    tl = run(events)
    raw = sum(x["threat"] for x in tl["minutes"])
    smooth = sum(x["threat_smooth"] for x in tl["minutes"])
    assert smooth == pytest.approx(raw, rel=0.01)
    assert minute(tl, 1, 16)["threat_smooth"] < 4          # spread over neighbours


def test_poss_share_window():
    tl = run([ev(600, "PERTE", zone=3), ev(1200, "RECUP", zone=2), ev(1300, "PERTE", zone=2)])
    assert minute(tl, 1, 5)["poss_share"] == pytest.approx(1.0)
    assert minute(tl, 1, 15)["poss_share"] == pytest.approx(0.0)


def test_events_goals_cards_half():
    events = [ev(300, "RECUP", zone=2), ev(320, "BUT"), ev(400, "CARTON_JAUNE", "them"),
              ev(500, "RECUP", zone=2), ev(520, "PERTE", zone=3), ev(700, "PERTE", zone=3, score_us=1, score_them=1),
              ev(2760, "RECUP", zone=2, half=2, score_us=1, score_them=1)]
    tl = run(events)
    kinds = [(e["kind"], e.get("team")) for e in tl["events"]]
    assert ("goal", "us") in kinds and ("goal", "them") in kinds
    assert ("card", "them") in kinds
    assert ("half", None) in kinds
    half = next(e for e in tl["events"] if e["kind"] == "half")
    assert (half["half"], half["minute"]) == (2, 45)


def test_timeline_empty():
    tl = match_timeline({"events": [], "match": {}}, [])
    assert tl == {"minutes": [], "events": []}

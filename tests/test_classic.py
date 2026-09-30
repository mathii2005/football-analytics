"""Old staff-dashboard definitions (classic.py). Vanier 2026-09-26 is the
reference: every number below is what the old dashboard shows."""
import json
from pathlib import Path

import pytest

from src.analytics.classic import classic_report
from src.analytics.possessions import possessions_from_match, reconstruct_possessions

FIX = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def vanier():
    m = json.loads((FIX / "vanier_2026-09-26.json").read_text())
    return m, possessions_from_match(m)


def test_vanier_matches_old_dashboard(vanier):
    r = classic_report(*vanier)
    h = r["headline"]
    assert h["balance"] == -6
    assert h["dangerous_actions"] == 23
    assert h["actions_per_shot"] == pytest.approx(2.875)
    assert (h["shots"], h["shots_on_target"], h["goals"]) == (8, 5, 2)
    # old dashboard shows 56 % (114/205): it was built before the export was
    # re-saved with 5 yellow cards; same formula on today's export = 114/210
    assert round(h["field_tilt"] * 100) == 54
    assert round(h["high_recup_share"] * 100) == 33
    assert round(h["recovery_height"], 1) == 2.1
    assert {z["zone"]: z["balance"] for z in r["zones"]} == {"1": 12, "2": 15, "3": -13, "4": -20, "BOX": 0}
    t = r["transition_speed"]
    assert (t["median_s"], t["n"], t["fast"], t["mid"], t["slow"]) == (7.9, 16, 4, 7, 5)
    assert round(t["pct_leading"] * 100) == 28
    assert (r["set_pieces"]["shots_from_set_piece"], r["set_pieces"]["goals_from_set_piece"]) == (1, 1)
    assert r["attack_style"]["vertical_pct"] == 1.0
    assert [x["actions"] for x in r["tempo"]] == [13, 10]


# ── unit tests on synthetic events ─────────────────────────────────

def ev(t_s, code, team=None, zone=None, is_box=False, half=1, couloir=None, score_us=0, score_them=0):
    return {"id": f"{code}{t_s}", "timestamp_ms": t_s * 1000, "half": half, "code": code, "team": team,
            "zone": zone, "is_box": is_box, "couloir": couloir, "score_us": score_us, "score_them": score_them}


def report(events):
    m = {"events": events, "match": {}}
    return classic_report(m, reconstruct_possessions(events))


def test_transition_excludes_loss_between():
    t = report([ev(10, "RECUP", zone=2), ev(12, "PERTE", zone=3), ev(15, "CONDUITE", zone=3)])["transition_speed"]
    assert t["n"] == 0


def test_transition_excludes_over_60s():
    t = report([ev(10, "RECUP", zone=2), ev(75, "CONDUITE", zone=3)])["transition_speed"]
    assert t["n"] == 0


def test_transition_excludes_crossing_stoppage():
    events = [ev(10, "RECUP", zone=2), ev(12, "STOPPAGE_START"), ev(20, "STOPPAGE_END"), ev(25, "CONDUITE", zone=3)]
    assert report(events)["transition_speed"]["n"] == 0


def test_transition_buckets():
    events = [ev(10, "RECUP", zone=2), ev(13, "CONDUITE", zone=3),      # 3 s  -> fast
              ev(20, "RECUP", zone=2), ev(30, "PASSE_PROF", zone=3),    # 10 s -> mid
              ev(40, "RECUP", zone=2), ev(60, "CENTRE", zone=4)]        # 20 s -> slow
    t = report(events)["transition_speed"]
    assert (t["n"], t["fast"], t["mid"], t["slow"], t["median_s"]) == (3, 1, 1, 1, 10.0)


@pytest.mark.parametrize("gap, counts", [(19, 1), (21, 0)])
def test_set_piece_shot_window_20s(gap, counts):
    sp = report([ev(10, "RECUP", zone=2), ev(20, "CORNER", "us"), ev(20 + gap, "TIR_HC")])["set_pieces"]
    assert sp["shots_from_set_piece"] == counts


def test_set_piece_window_cancelled_by_loss():
    sp = report([ev(20, "CORNER", "us"), ev(25, "PERTE", zone=4), ev(28, "RECUP", zone=4), ev(30, "TIR_C")])["set_pieces"]
    assert sp["shots_from_set_piece"] == 0


def test_field_tilt_counts_all_events():
    h = report([ev(10, "RECUP", zone=2), ev(20, "PERTE", zone=3), ev(30, "RECUP", zone=4), ev(40, "PERTE", zone=1)])["headline"]
    assert h["field_tilt"] == 0.5


def test_classic_ignores_unknown_codes():
    base = [ev(10, "RECUP", zone=2), ev(20, "CONDUITE", zone=3), ev(25, "TIR_HC")]
    a, b = report(base), report(base + [ev(15, "BALLON2", zone=3)])
    assert a["transition_speed"] == b["transition_speed"]
    assert a["actions_by_type"] == b["actions_by_type"]


def test_classic_single_half_no_shots():
    r = report([ev(10, "RECUP", zone=2), ev(20, "PERTE", zone=3)])
    assert r["headline"]["actions_per_shot"] is None
    assert [s["n"] for s in r["funnel"]] == [0, 0, 0, 0, 0]
    assert len(r["tempo"]) == 1

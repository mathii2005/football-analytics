import json
from pathlib import Path

import pytest

from src.analytics.phases import phases_report, regain_ms
from src.analytics.possessions import possessions_from_match, reconstruct_possessions

FIX = Path(__file__).parent / "fixtures"


def ev(t_s, code, team=None, zone=None, is_box=False, half=1, score_us=0, score_them=0):
    return {"id": f"{code}{t_s}{half}", "timestamp_ms": t_s * 1000, "half": half, "code": code, "team": team,
            "zone": zone, "is_box": is_box, "couloir": None, "score_us": score_us, "score_them": score_them}


def run(events, kickoff="them"):
    ps = reconstruct_possessions(events, kickoff_team=kickoff)
    return phases_report({"events": events, "match": {}}, ps), ps


def test_splits_by_state():
    events = [ev(10, "RECUP", zone=2), ev(30, "PERTE", zone=2),                         # level
              ev(40, "RECUP", zone=2, score_us=1), ev(70, "PERTE", zone=2, score_us=1)]  # leading
    r, _ = run(events)
    states = {s["state"]: s for s in r["splits"]["by_state"]}
    assert states["égalité"]["n_us"] == 1 and states["en avance"]["n_us"] == 1
    assert states["menée"]["n_us"] == 0


def test_period_bins_stoppage_time_in_last_bin():
    events = [ev(10, "RECUP", zone=2), ev(47 * 60, "PERTE", zone=2)]
    r, _ = run(events)
    labels = [p["label"] for p in r["splits"]["by_period"] if p["half"] == 1]
    assert labels == ["0–15", "15–30", "30–45+"]


def test_histogram_excludes_inferred():
    # RECUP then RECUP: first possession ends inferred -> not timed
    events = [ev(10, "RECUP", zone=2), ev(13, "CONDUITE", zone=3), ev(40, "RECUP", zone=2), ev(44, "PERTE", zone=3)]
    r, _ = run(events)
    us = r["profile"]["us"]
    assert us["n"] == 2 and us["n_timed"] == 1
    assert sum(b["n"] for b in us["histogram"]) == 1
    assert us["histogram"][0] == {"bin": "0–5 s", "n": 1}


def test_counter_press_regain_times():
    events = [ev(10, "RECUP", zone=2), ev(20, "PERTE", zone=3), ev(23, "RECUP", zone=3),   # regained 3 s
              ev(30, "PERTE", zone=4), ev(42, "RECUP", zone=2)]                           # regained 12 s
    r, ps = run(events)
    cp = r["counter_press"]
    assert (cp["n_losses"], cp["n_timed"]) == (2, 2)
    assert cp["within_5s"] == 0.5 and cp["within_10s"] == 0.5
    assert cp["median_regain_ms"] == 7_500
    loss_idx = [i for i, p in enumerate(ps) if p.team == "us" and p.end_type == "perte"]
    assert [regain_ms(ps, i) for i in loss_idx] == [3_000, 12_000]


def test_counter_press_loss_at_half_end_not_regained():
    r, _ = run([ev(10, "RECUP", zone=2), ev(20, "PERTE", zone=3)])
    cp = r["counter_press"]
    assert (cp["n_losses"], cp["n_timed"], cp["within_10s"]) == (1, 0, 0.0)
    assert cp["median_regain_ms"] is None


def test_recovery_value_by_zone():
    events = [ev(10, "RECUP", zone=4), ev(14, "TIR_HC", is_box=True), ev(16, "DEGAGEMENT", "them"),
              ev(30, "RECUP", zone=4), ev(32, "PERTE", zone=4)]
    r, _ = run(events)
    z4 = next(z for z in r["progression"]["recovery_value"] if z["zone"] == "4")
    assert z4["n"] == 2 and z4["shot_rate"] == 0.5 and z4["box_rate"] == 0.5 and z4["quick_loss_rate"] == 0.5


def test_game_time_dead_ms_from_stoppages():
    m = json.loads((FIX / "champlain_15min.json").read_text())
    r = phases_report(m, possessions_from_match(m))
    assert round(r["game_time"]["dead_ms"] / 1000) == 48


def test_phases_empty_match():
    r = phases_report({"events": [], "match": {}}, [])
    assert r["counter_press"]["n_losses"] == 0
    assert r["profile"]["us"]["median_ms"] is None
    assert r["finishing"]["shots_per_possession"] is None


# ── series for charts ──────────────────────────────────────────────

def test_regain_curve_steps():
    events = [ev(10, "RECUP", zone=2), ev(20, "PERTE", zone=3), ev(23, "RECUP", zone=3),
              ev(30, "PERTE", zone=4), ev(42, "RECUP", zone=2)]
    rc, _ = run(events)
    c = rc["regain_curve"]
    assert c["t"][:1] == [0] and len(c["t"]) == 61
    assert c["overall"][0] == 1.0 and c["overall"][3] == 0.5 and c["overall"][12] == 0.0
    assert c["n"] == {"overall": 2, "own": 0, "3": 1, "4": 1}


def test_regain_curve_not_regained_stays():
    rc, _ = run([ev(10, "RECUP", zone=2), ev(20, "PERTE", zone=1)])
    assert rc["regain_curve"]["overall"][-1] == 1.0
    assert rc["regain_curve"]["by_zone"]["own"][60] == 1.0


def test_regain_curve_empty():
    r = phases_report({"events": [], "match": {}}, [])
    assert r["regain_curve"]["n"]["overall"] == 0
    assert r["regain_curve"]["overall"] == []


def test_flow_links_sum_to_possessions():
    m = json.loads((FIX / "vanier_2026-09-26.json").read_text())
    ps = possessions_from_match(m)
    r = phases_report(m, ps)
    assert sum(l["value"] for l in r["flow"]["links"]) == sum(p.team == "us" for p in ps)
    names = [n["name"] for n in r["flow"]["nodes"]]
    assert "Récup Z1–2" in names and "But / tir" in names


def test_durations_lists_timed_only():
    events = [ev(10, "RECUP", zone=2), ev(13, "CONDUITE", zone=3), ev(40, "RECUP", zone=2), ev(44, "PERTE", zone=3)]
    r, _ = run(events)
    assert r["durations"]["us"] == [4_000]

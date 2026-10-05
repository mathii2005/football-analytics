"""
v1 models and metrics (P4): each formula pinned on a small synthetic log, and
the stitched Ahuntsic match (live tagging only, no answers yet) as a snapshot.
"""

import json
from pathlib import Path

import pytest

from src.codebook import load_codebook
from src.ingestion.normalize import normalize_match
from src.v1.log import effective_ops
from src.v1.models import shot_xg, xt_value, xt_gains
from src.v1.timeline import build_timeline, Shot
from src.v1.labels import label_match
from src.v1.metrics import compute_metrics
from tests.test_v1_engine import Log, kickoff_then

FIX = Path(__file__).parent / "fixtures"
CB = load_codebook()


def run(L, reviewed=(), end=2_700_000, meta=None):
    L.add(end, "H", "END")
    tl = build_timeline(effective_ops(L.ops))
    lab = label_match(tl, "m")
    answers = {r["card"]: r["q"] for r in reviewed}
    roots = {o["seq"]: o["seq"] for o in L.ops}
    return compute_metrics(tl, lab, answers, roots, meta or {"veo": {"url": "https://veo/x", "offset_h1_ms": 60000}})


# ---------- models ----------

def test_shot_xg_from_the_card():
    s = Shot(1, 1, 0, "ON", "US", 5)
    assert shot_xg(s, {"loc": "CENTRAL_BOX", "body": "FOOT", "situation": "OPEN"}) == (CB["xg"]["table"]["CENTRAL_BOX"]["FOOT"]["OPEN"], False)
    assert shot_xg(s, {"loc": "SIX", "body": "OTHER", "situation": "SET_PIECE"})[0] == CB["xg"]["table"]["SIX"]["HEAD"]["SET_PIECE"]
    assert shot_xg(s, {"situation": "PENALTY"}) == (CB["xg"]["penalty"], False)


def test_unanswered_shot_uses_its_band_and_is_estimated():
    box = shot_xg(Shot(1, 1, 0, "ON", "US", 5), None)
    far = shot_xg(Shot(1, 1, 0, "ON", "US", 3), None)
    theirs = shot_xg(Shot(1, 1, 0, "ON", "THEM", 0), None)     # their shot from our box = a box shot
    assert box[1] and far[1] and box[0] > far[0] and theirs[0] == box[0]


def test_xt_gain_counts_forward_moves_only():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    z3 = L.add(3000, "Z", 3)
    z4 = L.add(6000, "Z", 4)
    L.add(9000, "Z", 3)                 # backwards: no gain
    L.add(2_700_000, "H", "END")
    tl = build_timeline(effective_ops(L.ops))
    gains = xt_gains(tl, lambda seq: "C" if seq == z4 else None)
    expected = [g for g in [(z3, xt_value(3) - xt_value(2)), (z4, xt_value(4, "C") - xt_value(3))] if g[1] >= CB["xt"]["min_gain"]]
    assert [(g.seq, round(g.gain, 5)) for g in gains] == [(s, round(v, 5)) for s, v in expected]


# ---------- metrics ----------

def test_counterpress_transition_and_tilt():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    L.add(2000, "Z", 3); L.add(3000, "Z", 4)
    L.S(10000, "THEM")                  # loss in zone 4
    L.S(13000, "US")                    # won back in 3 s
    L.add(16000, "Z", 5)                # box within 10 s of the regain
    L.S(30000, "THEM")
    L.add(31000, "Z", 2); L.add(32000, "Z", 1)
    m = run(L, end=60000)
    assert m["counterpress_5s"]["value"] == 0.5 and m["counterpress_5s"]["n"] == 2
    assert m["transition_to_box"]["value"] == 1.0
    assert m["box_entries"]["n"] == 1 and m["redzone_entries"]["n"] == 1
    # tilt: us in 4-5 3-10 s, 13-16 s (back on the ball, still zone 4) and 16-30 s = 24 s; them in 0-1 32-60 s = 28 s
    assert m["field_tilt_time"]["value"] == round(24 / 52, 4)


def test_half_space_metrics_use_the_entry_answers_and_report_coverage():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    L.add(2000, "Z", 3)
    a = L.add(3000, "Z", 4)
    L.add(4000, "Z", 3)
    b = L.add(5000, "Z", 4)
    L.add(6000, "Z", 3)
    c = L.add(7000, "Z", 4)
    reviewed = [{"card": f"ENTRY:{a}", "q": {"lane": "HS_R", "between_lines": "YES", "outcome_15s": "SHOT"}},
                {"card": f"ENTRY:{b}", "q": {"lane": "C", "between_lines": "NO", "outcome_15s": "LOST"}}]
    m = run(L, reviewed, end=60000)
    assert m["hs_entry_share"]["value"] == 0.5 and m["hs_entry_share"]["coverage"] == round(2 / 3, 3)
    assert m["hs_entry_share"]["status"] == "trop tôt"          # 2 known lanes < 20
    assert m["hs_to_box"]["value"] == 1.0


def test_low_coverage_hides_the_value():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    seqs = []
    for i in range(4):
        L.add(2000 + i * 2000, "Z", 3)
        seqs.append(L.add(3000 + i * 2000, "Z", 4))
    m = run(L, [{"card": f"ENTRY:{seqs[0]}", "q": {"lane": "C"}}], end=60000)
    assert m["hs_entry_share"]["value"] is None and m["hs_entry_share"]["status"] == "couverture insuffisante"


def test_goals_xg_conversion_and_clips():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    L.add(2000, "Z", 5)
    g = L.goal(3000, "US")
    L.S(20000, "THEM", auto_band=3)
    m = run(L, [{"card": f"GOAL:{g}", "q": {"loc": "SIX", "body": "FOOT", "situation": "OPEN"}}], end=60000)
    assert m["goals_for"]["value"] == 1 and m["xg_for"]["value"] == round(CB["xg"]["table"]["SIX"]["FOOT"]["OPEN"], 3)
    assert m["conversion"]["value"] == 1.0 and m["conversion"]["detail"]["wilson90"][1] == 1.0
    clip = m["goals_for"]["clips"]["all"][0]
    assert clip["url"] == "https://veo/x#t=0:58"                 # 60 s offset + 3 s - 5 s lead


# ---------- real match ----------

@pytest.fixture(scope="module")
def ahuntsic():
    raw = json.loads((FIX / "ahuntsic_2026-10-02_full_v1.json").read_text())
    match, _ = normalize_match(raw, "ahuntsic")
    return match["v1"]["metrics"]


def test_ahuntsic_exact_metrics(ahuntsic):
    m = ahuntsic
    assert (m["goals_for"]["value"], m["goals_against"]["value"]) == (2, 3)
    assert (m["shots_for"]["value"], m["shots_against"]["value"]) == (11, 15)
    assert m["xg_for"]["detail"]["estimated_shots"] == 11       # no review yet: every shot estimated from its band
    assert m["hs_entry_share"]["value"] is None                  # no answers: hidden, not zero
    # live-tagging metrics (no review needed)
    assert (m["redzone_entries"]["n"], m["box_entries"]["n"], m["counterpress_5s"]["n"]) == (39, 13, 55)
    assert (m["counterpress_5s"]["value"], m["red_to_box"]["value"], m["possessions_reaching_redzone"]["n"]) == (0.1818, 0.3333, 121)
    assert m["field_tilt_time"]["value"] == 0.4491 and m["field_tilt_classic"]["value"] == 0.6239


# ---------- improvement, calibration, reliability ----------

def test_improvement_needs_two_consecutive_evaluations():
    from src.v1.improvement import improvement_status
    flat = [0.30, 0.31, 0.29, 0.30, 0.30]
    assert improvement_status(flat[:4], 0.30, 0.05)["status"] == "TROP TÔT"
    assert improvement_status(flat, 0.30, 0.05)["status"] == "STABLE"
    rising = [0.30, 0.36, 0.38, 0.40, 0.37, 0.41]          # rolling 0.384 at 5, 0.384 at 6, beats 0.30 + 0.025
    assert improvement_status(rising[:5], 0.30, 0.05)["status"] == "STABLE"     # one evaluation only
    assert improvement_status(rising, 0.30, 0.05)["status"] == "AMÉLIORÉ"
    assert improvement_status([12, 14, 15, 13, 16, 15], 10, 2, direction="↓")["status"] == "EN BAISSE"


def test_in_season_baseline():
    from src.v1.improvement import baseline_from
    mu, sigma, rest = baseline_from([1, 2, 3, 4, 5, 6, 7])
    assert (mu, round(sigma, 4), rest) == (3, round(2 ** 0.5, 4), [6, 7])


def test_calibration_from_time_only_edits():
    from src.v1.quality import calibration
    ops = [{"seq": 1, "t": 10000, "k": "S", "v": "US"}, {"seq": 2, "t": 7000, "k": "S", "v": "US", "edit_of": 1},
           {"seq": 3, "t": 20000, "k": "Z", "v": 3}, {"seq": 4, "t": 20000, "k": "Z", "v": 4, "edit_of": 3}]
    c = calibration(ops)
    assert (c["n"], c["median_lag_ms"], c["propose_longer_lead"]) == (1, 3000, False)


def test_agreement_and_coarsening():
    from src.v1.quality import agreement, coarsen
    a = {"E:1": {"lane": "HS_L"}, "E:2": {"lane": "C"}, "E:3": {"lane": "CANT_SEE"}}
    b = {"E:1": {"lane": "HS_L"}, "E:2": {"lane": "HS_R"}, "E:3": {"lane": "C"}}
    assert agreement(a, b, "lane") == {"n": 2, "agreement": 0.5, "bar": 0.85}
    assert coarsen("lane", "HS_R") == "R" and coarsen("closing_3s", "3PLUS") == "2+" and coarsen("between_lines", "YES") is None


def test_season_v1_uses_the_baseline_file_or_the_first_five_matches():
    from src.v1.season import season_v1
    mk = lambda i, v: {"id": f"m{i}", "date": f"2026-10-{i:02d}", "metrics": {"box_entries": {"value": v, "direction": "↑"}}}
    matches = [mk(i, v) for i, v in enumerate([3, 3, 3, 3, 3, 5, 5, 5, 5, 5, 5], start=1)]
    s = season_v1(matches, baseline={})
    assert s["box_entries"]["baseline_source"] == "baseline intra-saison" and s["box_entries"]["status"] == "AMÉLIORÉ"
    s2 = season_v1(matches[:4], baseline={"box_entries": {"mean": 3, "sd": 1, "source": "2025 re-tag"}})
    assert s2["box_entries"]["status"] == "TROP TÔT" and s2["box_entries"]["baseline_source"] == "2025 re-tag"


def test_mirror_metrics_borrow_their_definition():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    m = run(L, end=60000)
    assert m["first_contact_won_against"]["label_fr"] == "Premier contact gagné (adversaire)"
    assert m["first_contact_won_against"]["direction"] == "↓"
    assert m["xg_rate_TRANSITION"]["label_fr"] == "xG par 10 min · transition"

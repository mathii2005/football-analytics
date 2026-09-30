import json
from pathlib import Path

import pytest

from src.analytics.clips import review_clips, is_late, SELECTION_SIZE
from src.analytics.possessions import possessions_from_match, reconstruct_possessions
from src.analytics.report import match_report, event_threat, zones_report
from src.analytics.video import video_url, CLIP_LEAD_MS

FIXTURE = Path(__file__).parent / "fixtures" / "champlain_15min.json"
VEO = {"url": "https://app.veo.co/matches/x/", "offset1": 2_119_000, "offset2": 5_824_000}


# ── video links ────────────────────────────────────────────────────

def test_video_url_first_half_has_lead_in():
    # kickoff at 35:19 in the video, event at 1:02 -> 36:21, minus 8 s lead
    assert CLIP_LEAD_MS == 8_000
    assert video_url(VEO, 1, 62_000) == "https://app.veo.co/matches/x/#t=36:13"


def test_video_url_second_half_uses_second_offset():
    # 50:00 on the match clock = 5:00 into half 2; offset2 = 97:04
    assert video_url(VEO, 2, 50 * 60_000) == "https://app.veo.co/matches/x/#t=101:56"


def test_video_url_missing_data():
    assert video_url({"url": None, "offset1": 0}, 1, 1000) is None
    assert video_url({"url": "u", "offset1": None, "offset2": None}, 1, 1000) is None
    assert video_url({"url": "u", "offset1": 0}, 1, 1000) == "u#t=0:00"   # never negative


# ── report ─────────────────────────────────────────────────────────

def ev(t_s, code, team=None, zone=None, is_box=False, score_us=0, score_them=0, couloir=None):
    return {"id": f"{code}{t_s}", "timestamp_ms": t_s * 1000, "half": 1, "code": code, "team": team,
            "zone": zone, "is_box": is_box, "couloir": couloir, "score_us": score_us, "score_them": score_them}


@pytest.mark.parametrize("event, threat", [
    (ev(1, "CONDUITE", zone=3), 1),
    (ev(1, "CENTRE", zone="BOX", is_box=True), 3),
    (ev(1, "TIR_HC"), 3), (ev(1, "TIR_C"), 4), (ev(1, "BUT"), 6),
    (ev(1, "RECUP", zone=2), 0),
    (ev(1, "TIR_C", team="them"), 0),
])
def test_threat_weights_match_staff_dashboard(event, threat):
    assert event_threat(event) == threat


def test_zone_balance_and_control():
    rows = {r["zone"]: r for r in zones_report([ev(1, "RECUP", zone=3), ev(2, "PERTE", zone=3), ev(3, "PERTE", zone=3)])}
    assert rows["3"]["balance"] == -1 and rows["3"]["control"] == pytest.approx(1 / 3)
    assert rows["1"]["control"] is None


def test_champlain_report():
    d = json.loads(FIXTURE.read_text())
    r = match_report(d, possessions_from_match(d))
    assert r["headline"]["recups"] == 12 and r["headline"]["losses"] == 9
    assert r["headline"]["shots"] == 1
    assert sum(b["threat"] for b in r["threat"]) == sum(h["threat"] for h in r["halves"])
    assert all(isinstance(k, str) for k in r["key_points"])


# ── clips ──────────────────────────────────────────────────────────

def test_late_uses_match_clock():
    assert not is_late(1, 15 * 60_000)
    assert is_late(1, 36 * 60_000) and is_late(1, 47 * 60_000)
    assert not is_late(2, 70 * 60_000) and is_late(2, 81 * 60_000)


def test_goal_against_clip_is_the_loss_that_started_it():
    events = [ev(10, "RECUP", zone=2), ev(30, "PERTE", zone=2), ev(90, "RECUP", zone=2, score_them=1)]
    ps = reconstruct_possessions(events, kickoff_team="them")
    clips = review_clips({}, ps, VEO)
    ga = [c for c in clips["categories"][0]["clips"]]
    assert [(c["at"], c["title"]) for c in ga] == [("00:30", "Perte en zone 2, but adverse ensuite")]
    assert ga[0]["video_url"].endswith("#t=35:41")


def test_goal_for_from_set_piece_starts_at_set_piece():
    events = [ev(10, "RECUP", zone=2), ev(40, "CORNER", "us"), ev(47, "BUT")]
    clips = review_clips({}, reconstruct_possessions(events, kickoff_team="them"), VEO)
    gf = clips["categories"][1]["clips"]
    assert gf[0]["at"] == "00:40" and gf[0]["title"] == "But sur corner"


def test_protecting_a_lead_late_ranks_higher():
    early = [ev(10, "RECUP", zone=2, score_us=1), ev(20, "PERTE", zone=1, score_us=1)]
    ps = reconstruct_possessions(early, kickoff_team="them")
    c_early = review_clips({}, ps, VEO)["categories"][3]["clips"][0]
    late = [dict(e, half=2, timestamp_ms=e["timestamp_ms"] + 85 * 60_000) for e in early]
    c_late = review_clips({}, reconstruct_possessions(late, kickoff_team="them"), VEO)["categories"][3]["clips"][0]
    assert "On protège une avance" in c_late["context"]
    assert c_late["priority"] > c_early["priority"]


def test_selection_is_capped_deduped_and_chronological():
    d = json.loads(FIXTURE.read_text())
    sel = review_clips(d, possessions_from_match(d), {"url": "u", "offset1": 0})["selection"]
    assert len(sel) <= SELECTION_SIZE
    assert sel == sorted(sel, key=lambda c: (c["half"], c["t_ms"]))
    for a, b in zip(sel, sel[1:]):
        assert a["half"] != b["half"] or b["t_ms"] - a["t_ms"] >= 10_000


# ── clip library ───────────────────────────────────────────────────

from src.analytics.clips import CATEGORIES


def lib(events, veo=VEO):
    return review_clips({}, reconstruct_possessions(events, kickoff_team="them"), veo)["library"]


def test_library_has_facets():
    d = json.loads(FIXTURE.read_text())
    clips = review_clips(d, possessions_from_match(d), VEO)["library"]
    assert clips
    for c in clips:
        assert {"zone", "state", "period", "positive", "category", "video_url"} <= set(c)
        assert c["state"] in ("menée", "égalité", "en avance")


def test_library_without_video():
    d = json.loads((Path(__file__).parents[1] / "data" / "raw" / "laureats_2026-08-26_match_001_v1.json").read_text())
    clips = review_clips(d, possessions_from_match(d), {"url": None, "offset1": None, "offset2": None})["library"]
    assert clips and all(c["video_url"] is None for c in clips)


def test_failed_press_and_quick_regain():
    events = [ev(10, "RECUP", zone=2), ev(20, "PERTE", zone=3), ev(23, "RECUP", zone=3),     # regained in 3 s
              ev(30, "PERTE", zone=2), ev(45, "COUP_FRANC", "them", zone=2), ev(70, "RECUP", zone=1)]  # not regained, their set piece
    cats = [c["category"] for c in lib(events)]
    assert cats.count("quick_regain") == 1
    assert cats.count("failed_press") == 1
    qr = next(c for c in lib(events) if c["category"] == "quick_regain")
    assert qr["positive"] and qr["at"] == "00:20"


def test_long_buildup_threshold():
    short = [ev(10, "RECUP", zone=2), ev(39, "PERTE", zone=3)]
    long_ = [ev(10, "RECUP", zone=2), ev(41, "PERTE", zone=3)]
    assert "long_buildup" not in [c["category"] for c in lib(short)]
    assert "long_buildup" in [c["category"] for c in lib(long_)]


def test_selection_size_20():
    from src.analytics.clips import SELECTION_SIZE
    assert SELECTION_SIZE == 20
    events = [ev(10 + 20 * k, "RECUP", zone=4) for k in range(0, 1)]
    for k in range(40):
        t = 20 + k * 30
        events += [ev(t, "RECUP", zone=4), ev(t + 3, "TIR_C")]
    sel = review_clips({}, reconstruct_possessions(events, kickoff_team="them"), VEO)["selection"]
    assert len(sel) == 20


def test_new_categories_registered():
    for key in ("shot", "box_entry", "high_recup", "quick_regain", "failed_press", "long_buildup",
                "set_piece_us", "set_piece_them"):
        assert key in CATEGORIES


def test_goal_title_uses_20s_set_piece_rule():
    # corner 25 s before the goal: same possession, but not a set-piece goal
    far = [ev(10, "RECUP", zone=2), ev(20, "CORNER", "us"), ev(45, "BUT")]
    near = [ev(10, "RECUP", zone=2), ev(40, "CORNER", "us"), ev(47, "BUT")]
    t = lambda evs: review_clips({}, reconstruct_possessions(evs, kickoff_team="them"), VEO)["categories"][1]["clips"][0]["title"]
    assert t(far) == "But"
    assert t(near) == "But sur corner"


def test_every_loss_and_recovery_is_a_clip():
    events = [ev(10, "RECUP", zone=2), ev(20, "PERTE", zone=4), ev(30, "RECUP", zone=3), ev(40, "PERTE", zone=4)]
    clips = lib(events)
    losses = [c for c in clips if c["category"] == "loss"]
    recups = [c for c in clips if c["category"] == "recup"]
    assert [c["zone"] for c in losses] == ["4", "4"]
    assert [c["zone"] for c in recups] == ["2", "3"]


def test_on_target_shots_have_their_own_category():
    d = json.loads((Path(__file__).parent / "fixtures" / "vanier_2026-09-26.json").read_text())
    lib_ = review_clips(d, possessions_from_match(d), VEO)["library"]
    assert sum(c["category"] == "shot_on_target" for c in lib_) == 5   # 3 TIR_C + 2 BUT, as the funnel shows

import pytest

from src.analytics.metrics import (
    match_metrics, outcome, style, zone_time_ms, possession_share, time_to_shot_ms, possession_row,
)
from src.analytics.possessions import reconstruct_possessions, possessions_from_match, US
from src.ingestion.load_match import load_match


def ev(t_s, code, team=None, half=1, zone=None, couloir=None, is_box=False, score_them=0):
    return {"id": f"{code}_{t_s}", "timestamp_ms": t_s * 1000, "half": half, "code": code, "team": team,
            "zone": zone, "couloir": couloir, "is_box": is_box, "score_us": 0, "score_them": score_them}


def ours(events, **kw):
    return [p for p in reconstruct_possessions(events, kickoff_team=kw.get("kickoff", US)) if p.team == US]


# ── outcomes ───────────────────────────────────────────────────────

@pytest.mark.parametrize("events, expected", [
    ([ev(10, "RECUP", zone=2), ev(20, "BUT")], "goal"),
    ([ev(10, "RECUP", zone=2), ev(20, "TIR_HC"), ev(25, "PERTE", zone=4)], "shot"),
    ([ev(10, "RECUP", zone=2), ev(20, "CONDUITE", zone="BOX", is_box=True), ev(25, "PERTE", zone=4)], "box_entry"),
    ([ev(10, "RECUP", zone=3), ev(13, "PERTE", zone=3)], "cheap_loss"),
    ([ev(10, "RECUP", zone=2), ev(30, "PERTE", zone=3)], "loss_opp_half"),
    ([ev(10, "RECUP", zone=2), ev(30, "PERTE", zone=2)], "loss_own_half"),
    ([ev(10, "RECUP", zone=2), ev(30, "DEGAGEMENT", "them")], "ball_out"),
])
def test_outcome(events, expected):
    p = [p for p in ours([ev(1, "PERTE", zone=2)] + events) if p.start_type == "recup"][0]
    assert outcome(p) == expected


def test_cheap_loss_needs_exact_start():
    # inferred start (PERTE with no RECUP before it): can't tell it was quick
    p = ours([ev(10, "PERTE", zone=2), ev(40, "PERTE", zone=2)])[-1]
    assert p.start_type == "inferred"
    assert outcome(p) == "loss_own_half"


# ── timing uses live time ──────────────────────────────────────────

def test_turnover_to_shot_excludes_stoppage():
    events = [ev(1, "PERTE", zone=2), ev(10, "RECUP", zone=2), ev(15, "STOPPAGE_START"),
              ev(45, "STOPPAGE_END"), ev(50, "TIR_C")]
    p = ours(events)[-1]
    assert time_to_shot_ms(p) == 40_000 - 30_000


def test_turnover_to_shot_excludes_set_piece_shots():
    # Montmorency 55:49: RECUP, free kick 2s later, shot 80s after that
    p = ours([ev(1, "PERTE", zone=2), ev(10, "RECUP", zone=2), ev(12, "COUP_FRANC", "us"), ev(90, "TIR_HC")])[-1]
    assert time_to_shot_ms(p) is None


def test_direct_counts_from_last_set_piece():
    # RECUP, free kick won and taken 30s later, shot 5s after the restart
    p = ours([ev(1, "PERTE", zone=2), ev(10, "RECUP", zone=2), ev(40, "COUP_FRANC", "us", zone=3), ev(45, "TIR_C")])[-1]
    assert style(p) == "direct"


def test_direct_vs_sustained():
    direct = ours([ev(1, "PERTE", zone=2), ev(10, "RECUP", zone=2), ev(20, "TIR_C")])[-1]
    sustained = ours([ev(1, "PERTE", zone=2), ev(10, "RECUP", zone=2), ev(60, "TIR_C")])[-1]
    no_box = ours([ev(1, "PERTE", zone=2), ev(10, "RECUP", zone=2), ev(60, "PERTE", zone=3)])[-1]
    assert (style(direct), style(sustained), style(no_box)) == ("direct", "sustained", None)


# ── field tilt ─────────────────────────────────────────────────────

def test_zone_time_step_function():
    p = ours([ev(1, "PERTE", zone=2), ev(10, "RECUP", zone=2), ev(20, "CONDUITE", zone=4),
              ev(30, "PERTE", zone=4)])[-1]
    assert zone_time_ms(p) == {2: 10_000, 4: 10_000}


def test_our_goal_kick_is_zone_1_not_4():
    p = ours([ev(1, "PERTE", zone=2), ev(10, "DEGAGEMENT", "us"), ev(30, "PERTE", zone=3)])[-1]
    assert zone_time_ms(p) == {None: 0, 1: 20_000, 3: 0}


# ── possession % ───────────────────────────────────────────────────

def test_possession_share_strict_and_inclusive():
    # exact: them 0-10, us 10-30, them 30-50, us 75-85, them 85-95.
    # untagged loss between 55 and 75: that 20s gap is split 10/10.
    events = [ev(10, "RECUP", zone=2), ev(30, "PERTE", zone=2), ev(50, "RECUP", zone=2),
              ev(55, "CONDUITE", zone=3), ev(75, "RECUP", zone=2), ev(85, "PERTE", zone=2),
              ev(95, "RECUP", zone=2)]
    ps = reconstruct_possessions(events, kickoff_team="them")
    share = possession_share(ps)
    assert share["strict"] == pytest.approx(30 / 70)
    # us: 20 + 5 + 10 (half gap) + 10 = 45 ; them: 10 (kickoff) + 20 + 10 (half gap) + 10 = 50
    assert share["inclusive"] == pytest.approx(45 / 95)


# ── match_001 end to end ───────────────────────────────────────────

@pytest.fixture(scope="module")
def m001():
    return possessions_from_match(load_match("match_001"), "match_001")


def test_match_001_metrics(m001):
    m = match_metrics(m001)
    assert m["possessions_us"] == 10
    assert m["outcomes"]["goal"] == 2
    assert m["shot_sequences"] == 6
    assert sum(m["outcomes"].values()) == 10
    assert m["high_recups"] == 0          # every match_001 RECUP is in zone 1-2
    assert m["ppda_lite"] is None
    assert 0 <= m["field_tilt"] <= 1


def test_possession_rows_are_flat(m001):
    row = possession_row(m001[2])
    assert row["codes"] == "RECUP PASSE_PROF CONDUITE CENTRE TIR_C CORNER TIR_HC PERTE"
    assert row["couloirs"] == "center left"
    assert row["outcome"] == "shot"

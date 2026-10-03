import pytest

from src.analytics.possessions import reconstruct_possessions, possessions_from_match, US, THEM
from src.ingestion.load_match import load_match, get_events


def ev(t_s, code, team=None, half=1, zone=None, score_us=0, score_them=0):
    return {"id": f"{code}_{t_s}", "timestamp_ms": t_s * 1000, "half": half, "code": code,
            "team": team, "zone": zone, "score_us": score_us, "score_them": score_them}


def summary(possessions):
    return [(p.team, p.start_type, p.end_type) for p in possessions]


# ── match_001 fixture: known outcomes ──────────────────────────────

@pytest.fixture(scope="module")
def match_001():
    return reconstruct_possessions(get_events(load_match("match_001")), "match_001")


def test_match_001_sequence(match_001):
    assert summary(match_001) == [
        (US, "half_start", "perte"),
        (THEM, "perte", "recup"),
        (US, "recup", "perte"),
        (THEM, "perte", "recup"),
        (US, "recup", "perte"),
        (THEM, "perte", "recup"),
        (US, "recup", "goal"),
        (THEM, "kickoff", "inferred"),   # we score, they kick off...
        (US, "inferred", "perte"),       # ...PERTE with no RECUP before it
        (THEM, "perte", "opp_goal"),     # score_them goes 0 -> 1
        (US, "kickoff", "perte"),
        (THEM, "perte", "recup"),
        (US, "recup", "perte"),
        (THEM, "perte", "recup"),
        (US, "recup", "perte"),
        (THEM, "perte", "recup"),
        (US, "recup", "perte"),
        (THEM, "perte", "recup"),
        (US, "recup", "goal"),
        (THEM, "kickoff", "half_end"),
    ]


def test_match_001_goals_match_final_score(match_001):
    assert sum(p.end_type == "goal" for p in match_001) == 2
    assert sum(p.end_type == "opp_goal" for p in match_001) == 1


def test_match_001_possessions_alternate_and_are_contiguous(match_001):
    for a, b in zip(match_001, match_001[1:]):
        assert a.team != b.team
        assert a.end_ms == b.start_ms
    assert [p.possession_id for p in match_001] == list(range(1, len(match_001) + 1))


def test_match_001_every_our_event_is_in_exactly_one_possession(match_001):
    events = get_events(load_match("match_001"))
    ids = [i for p in match_001 for i in p.event_ids]
    assert sorted(ids) == sorted(e["id"] for e in events)


def test_match_001_first_attacking_possession(match_001):
    events = {e["id"]: e for e in get_events(load_match("match_001"))}
    p = match_001[2]
    assert p.codes == ["RECUP", "PASSE_PROF", "CONDUITE", "CENTRE", "TIR_C", "CORNER", "TIR_HC", "PERTE"]
    assert p.n_shots == 2
    assert p.start_zone == 2
    assert p.end_zone == 4
    first, last = events[p.event_ids[0]], events[p.event_ids[-1]]
    assert p.duration_ms == last["timestamp_ms"] - first["timestamp_ms"]


# ── definition edge cases ──────────────────────────────────────────

def test_unknown_kickoff_first_event_decides_but_start_is_inexact():
    ps = reconstruct_possessions([ev(20, "RECUP"), ev(30, "PERTE")])
    assert summary(ps) == [(THEM, "half_start", "recup"), (US, "recup", "perte"), (THEM, "perte", "half_end")]
    assert ps[0].start_ms == 0 and not ps[0].start_exact
    assert ps[0].duration_ms is None
    assert ps[0].start_zone is None


# ── kickoff ────────────────────────────────────────────────────────

def test_known_kickoff_consistent_with_first_event():
    ps = reconstruct_possessions([ev(30, "PERTE"), ev(50, "RECUP")], kickoff_team=US)
    assert summary(ps)[0] == (US, "kickoff", "perte")
    assert ps[0].start_exact and ps[0].duration_ms == 30_000


def test_known_kickoff_contradicted_by_first_event_inserts_regain():
    # they kicked off, yet our first tag is a PERTE at 0:30: we won it untagged
    ps = reconstruct_possessions([ev(30, "PERTE")], kickoff_team=THEM)
    assert summary(ps) == [(THEM, "kickoff", "inferred"), (US, "inferred", "perte"), (THEM, "perte", "half_end")]


def test_second_half_kicked_off_by_other_team():
    events = [ev(30, "PERTE"), ev(40, "RECUP", half=2)]
    ps = reconstruct_possessions(events, kickoff_team=US)
    second = [p for p in ps if p.half == 2]
    assert summary(second)[0] == (THEM, "kickoff", "recup")
    assert second[0].start_exact


def test_kickoff_team_read_from_match_metadata():
    match = {"match": {"id": "m", "kickoffTeam": "them"}, "events": [ev(30, "RECUP")]}
    ps = possessions_from_match(match)
    assert summary(ps)[0] == (THEM, "kickoff", "recup")
    assert ps[0].start_exact


# ── stoppages ──────────────────────────────────────────────────────

def test_stoppage_is_subtracted_from_duration():
    ps = reconstruct_possessions([ev(10, "RECUP"), ev(20, "STOPPAGE_START"), ev(110, "STOPPAGE_END"),
                                  ev(115, "TOUCHE", "us"), ev(130, "PERTE")])
    p = ps[1]
    assert p.codes == ["RECUP", "TOUCHE", "PERTE"]
    assert p.stoppage_ms == 90_000
    assert p.duration_ms == 120_000 - 90_000


def test_stoppage_only_counts_overlap():
    ps = reconstruct_possessions([ev(10, "RECUP"), ev(20, "PERTE"), ev(25, "STOPPAGE_START"),
                                  ev(35, "STOPPAGE_END"), ev(40, "RECUP"), ev(50, "PERTE")])
    assert [p.stoppage_ms for p in ps] == [0, 0, 10_000, 0, 0]


def test_untagged_change_during_stoppage_is_placed_at_dead_ball():
    # our shot goes out, ball dead at 25s, next tag is a RECUP: the loss
    # happened when the ball went out, not at some unknown time
    ps = reconstruct_possessions([ev(10, "RECUP"), ev(20, "TIR_HC"), ev(25, "STOPPAGE_START"),
                                  ev(40, "STOPPAGE_END"), ev(60, "RECUP")])
    assert summary(ps)[1:3] == [(US, "recup", "stoppage"), (THEM, "restart", "recup")]
    assert ps[1].end_ms == 25_000 and ps[1].end_exact
    assert ps[2].duration_ms == 35_000 - 15_000


def test_opponent_goal_placed_at_dead_ball():
    ps = reconstruct_possessions([ev(10, "RECUP"), ev(20, "PERTE"), ev(50, "STOPPAGE_START"),
                                  ev(80, "STOPPAGE_END"), ev(95, "PERTE", score_them=1)])
    assert summary(ps)[2:4] == [(THEM, "perte", "opp_goal"), (US, "kickoff", "perte")]
    assert ps[2].end_ms == 50_000 and ps[2].end_exact
    assert ps[3].duration_ms == 45_000 - 30_000


def test_unclosed_stoppage_closed_at_last_event():
    ps = reconstruct_possessions([ev(10, "RECUP"), ev(20, "PERTE"), ev(30, "STOPPAGE_START"), ev(50, "RECUP")])
    assert ps[2].stoppage_ms == 20_000


def test_own_set_piece_does_not_split_possession():
    ps = reconstruct_possessions([ev(10, "RECUP"), ev(20, "TIR_HC"), ev(25, "CORNER", "us"), ev(40, "PERTE")])
    assert ps[1].codes == ["RECUP", "TIR_HC", "CORNER", "PERTE"]


def test_opponent_set_piece_ends_our_possession_exactly():
    ps = reconstruct_possessions([ev(10, "RECUP"), ev(20, "TIR_HC"), ev(30, "DEGAGEMENT", "them"), ev(60, "RECUP")])
    assert summary(ps)[1:3] == [(US, "recup", "opp_set_piece"), (THEM, "set_piece", "recup")]
    assert ps[1].end_ms == 30_000 and ps[1].end_exact


def test_our_set_piece_after_loss_starts_possession():
    ps = reconstruct_possessions([ev(10, "RECUP"), ev(20, "PERTE"), ev(30, "COUP_FRANC", "us"), ev(40, "PERTE")])
    assert summary(ps)[2:4] == [(THEM, "perte", "set_piece"), (US, "set_piece", "perte")]
    assert ps[3].codes == ["COUP_FRANC", "PERTE"]


def test_double_recup_inserts_inferred_loss():
    ps = reconstruct_possessions([ev(10, "RECUP"), ev(15, "CONDUITE"), ev(40, "RECUP"), ev(50, "PERTE")])
    assert summary(ps)[1:4] == [(US, "recup", "inferred"), (THEM, "inferred", "recup"), (US, "recup", "perte")]
    assert ps[1].end_ms == 15_000 and not ps[1].end_exact
    assert ps[1].duration_ms is None


def test_shot_while_they_have_ball_inserts_inferred_regain():
    ps = reconstruct_possessions([ev(10, "RECUP"), ev(20, "PERTE"), ev(30, "TIR_HC"), ev(35, "DEGAGEMENT", "them")])
    assert summary(ps)[2:] == [(THEM, "perte", "inferred"), (US, "inferred", "opp_set_piece"),
                               (THEM, "set_piece", "half_end")]


def test_opponent_goal_during_our_possession_inserts_their_possession():
    ps = reconstruct_possessions([ev(10, "RECUP"), ev(20, "CONDUITE"), ev(90, "PERTE", score_them=1)])
    assert summary(ps)[1:] == [(US, "recup", "inferred"), (THEM, "inferred", "opp_goal"),
                               (US, "kickoff", "perte"), (THEM, "perte", "half_end")]


def test_cards_and_unknown_codes_are_ignored():
    base = [ev(10, "RECUP"), ev(40, "PERTE")]
    noise = [ev(20, "CARTON_JAUNE", "them"), ev(30, "BALLON2")]
    assert summary(reconstruct_possessions(base + noise)) == summary(reconstruct_possessions(base))


def test_halves_are_independent_and_ids_continue():
    events = [ev(10, "RECUP"), ev(20, "PERTE"), ev(5, "PERTE", half=2), ev(15, "RECUP", half=2)]
    ps = reconstruct_possessions(events)
    assert [(p.half, p.team, p.start_type) for p in ps] == [
        (1, THEM, "half_start"), (1, US, "recup"), (1, THEM, "perte"),
        (2, US, "half_start"), (2, THEM, "perte"), (2, US, "recup"),
    ]
    assert [p.possession_id for p in ps] == [1, 2, 3, 4, 5, 6]


def test_events_out_of_order_are_sorted():
    ps = reconstruct_possessions([ev(40, "PERTE"), ev(10, "RECUP")])
    assert summary(ps) == summary(reconstruct_possessions([ev(10, "RECUP"), ev(40, "PERTE")]))


def test_second_half_starts_at_45_minutes_on_tagger_clock():
    events = [ev(30, "PERTE"), ev(2_760, "RECUP", half=2)]   # 46:00
    ps = reconstruct_possessions(events, kickoff_team=US)
    second = [p for p in ps if p.half == 2]
    assert second[0].start_ms == 2_700_000
    assert second[0].duration_ms == 60_000

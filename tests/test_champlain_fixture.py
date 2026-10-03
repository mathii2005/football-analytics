"""
Real 15-minute tagging (Champlain, 2026-09-04, half 1) made with the
improved tagger to exercise stoppage markers. Stoppages mark long
set-up delays only (our three free kicks); the opponent's quick
restarts were deliberately not toggled and count as live time.
"""
import json
from pathlib import Path

import pytest

from src.analytics.metrics import match_metrics
from src.analytics.possessions import possessions_from_match, US, THEM

FIXTURE = Path(__file__).parent / "fixtures" / "champlain_15min.json"


@pytest.fixture(scope="module")
def possessions():
    return possessions_from_match(json.loads(FIXTURE.read_text()), "champlain")


def test_no_inconsistencies_only_open_ends(possessions):
    inferred = [p.possession_id for p in possessions if p.is_inferred]
    assert inferred == [1, len(possessions)]         # unknown kickoff, half end
    assert all(p.start_type != "inferred" and p.end_type != "inferred" for p in possessions)


def test_counts(possessions):
    assert sum(p.team == US for p in possessions) == 13
    assert sum(p.team == THEM for p in possessions) == 12


def test_stoppages_subtracted_from_our_free_kick_possessions(possessions):
    dead = {p.possession_id: round(p.stoppage_ms / 1000) for p in possessions if p.stoppage_ms}
    assert dead == {15: 17, 19: 17, 25: 14}
    p15 = possessions[14]
    assert p15.codes == ["RECUP", "CONDUITE", "COUP_FRANC", "PERTE"]
    assert p15.duration_ms == p15.end_ms - p15.start_ms - p15.stoppage_ms


def test_opponent_restarts_end_our_possession(possessions):
    ends = [(p.possession_id, p.codes[-1] if p.codes else None) for p in possessions
            if p.end_type == "opp_set_piece"]
    assert [i for i, _ in ends] == [5, 7, 19]


def test_shot_out_for_corner_stays_ours(possessions):
    last = possessions[-1]
    assert last.team == US
    assert last.codes[-2:] == ["TIR_HC", "CORNER"]


def test_metrics(possessions):
    m = match_metrics(possessions)
    assert m["shot_sequences"] == 1
    assert m["outcomes"]["ball_out"] == 3
    assert m["high_recups"] == 3

"""xG table back-off (CODEBOOK §7.1): a thin cell borrows from its closest
neighbour that has enough shots, the same body part before the whole location."""

from tools.build_xg_table import build, LOCS


def shots(loc, body, sit, n, goals):
    return [{"loc": loc, "body": body, "sit": sit, "goal": i < goals} for i in range(n)]


# every location needs some shots for its last-resort value
FILLER = [s for loc in LOCS for s in shots(loc, "FOOT", "OPEN", 1, 0)]


def test_thin_foot_cell_backs_off_to_all_foot_shots_before_mixing_in_headers():
    data = (shots("SIX", "FOOT", "OPEN", 120, 33) + shots("SIX", "FOOT", "SET_PIECE", 88, 27)
            + shots("SIX", "FOOT", "FAST_BREAK", 19, 10) + shots("SIX", "HEAD", "SET_PIECE", 267, 57)) + FILLER
    table, _ = build(data, 200)
    assert table["SIX"]["FOOT"]["OPEN"] == round(70 / 228, 4)
    assert table["SIX"]["HEAD"]["OPEN"] == round(57 / 267, 4)


def test_full_cell_keeps_its_own_rate():
    table, counts = build(shots("CENTRAL_BOX", "FOOT", "OPEN", 300, 60) + [f for f in FILLER if f["loc"] != "CENTRAL_BOX"], 200)
    assert table["CENTRAL_BOX"]["FOOT"]["OPEN"] == 0.2 and counts["CENTRAL_BOX"]["FOOT"]["OPEN"] == 300

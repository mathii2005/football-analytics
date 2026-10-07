"""Match details for the dashboard tiles (shots table, origins, opponent entries,
closing, losses -> shots against, set pieces by zone, tagging load)."""

from src.v1.log import effective_ops
from src.v1.timeline import build_timeline
from src.v1.labels import label_match
from src.v1.details import match_details
from tests.test_v1_engine import Log, kickoff_then


def details(L, reviewed=(), end=60000):
    L.add(end, "H", "END")
    tl = build_timeline(effective_ops(L.ops))
    lab = label_match(tl, "m")
    answers = {r["card"]: r["q"] for r in reviewed}
    roots = {o["seq"]: o["seq"] for o in L.ops}
    return match_details(tl, lab, answers, roots, {"veo": {}}, L.ops)


def build():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    L.add(2000, "Z", 4)
    s = {"shot": L.add(3000, "SH", "ON")}
    s["loss"] = L.S(4000, "THEM")
    L.add(4500, "Z", 1)
    L.add(9000, "SH", "OFF")                 # their shot 5 s after our loss
    L.S(12000, "DEAD")
    s["fk"] = L.add(12500, "R", "FK")
    L.add(12600, "Z", 3)
    L.S(13000, "US")
    return L, s


def test_shots_table_carries_the_card_answers_and_xg():
    L, s = build()
    d = details(L, [{"card": f"SHOT:{s['shot']}", "q": {"loc": "SIX", "body": "FOOT", "situation": "OPEN", "assist": "CROSS"}}])
    us = [x for x in d["shots"] if x["team"] == "US"]
    assert len(d["shots"]) == 2 and len(us) == 1
    assert us[0]["loc"] == "SIX" and us[0]["assist"] == "CROSS" and us[0]["xg"] > 0.25 and not us[0]["estimated"]
    assert d["shot_origin"]["US"] == {"CROSS": 1} and d["shot_origin"]["THEM"] == {"UNREVIEWED": 1}
    assert d["shot_loc"]["US"] == {"SIX": 1}


def test_losses_that_lead_to_a_shot_against():
    L, _ = build()
    d = details(L)
    assert d["losses_to_shots"]["n_losses"] == 1 and d["losses_to_shots"]["n_shots"] == 1
    assert d["losses_to_shots"]["moments"][0]["band"] == 4


def test_set_pieces_by_type_and_half():
    L, _ = build()
    d = details(L)
    fk = [r for r in d["set_pieces"]["US"] if r["type"] == "FK"]
    assert fk == [{"type": "FK", "zone": "leur moitié", "n": 1, "shots": 0}]


def test_closing_distribution_and_opponent_entries():
    L, s = build()
    d = details(L, [{"card": f"LOSS:{s['loss']}", "q": {"closing_3s": "2"}}])
    assert d["closing"] == {"0": 0, "1": 0, "2": 1, "3PLUS": 0}
    assert d["opp_entries"]["n"] == 0


def test_tagging_load_per_15_minutes():
    L, _ = build()
    d = details(L)
    assert d["load"][0]["half"] == 1 and d["load"][0]["block"] == 0 and d["load"][0]["presses"] > 0


def test_player_table_counts_who_did_what_from_the_review():
    L, s = build()
    roster = [{"num": "9", "name": "Saad Annoub"}, {"num": "10", "name": "Éloi Kingsley"}]
    L.add(60000, "H", "END")
    tl = build_timeline(effective_ops(L.ops)); lab = label_match(tl, "m")
    answers = {f"SHOT:{s['shot']}": {"loc": "SIX", "shooter": "9", "assister": "10"},
               f"LOSS:{s['loss']}": {"lost_by": "10", "first_presser": "NONE"}}
    roots = {o["seq"]: o["seq"] for o in L.ops}
    d = match_details(tl, lab, answers, roots, {"veo": {}, "roster": roster}, L.ops)
    p = {r["num"]: r for r in d["players"]}
    assert p["9"]["name"] == "Saad Annoub" and p["9"]["shots"] == 1 and p["9"]["goals"] == 0
    assert p["10"]["assists"] == 1 and p["10"]["losses"] == 1 and p["10"]["first_presses"] == 0
    assert d["unpressed_losses"] == 1


def _full(answers, meta=None):
    L, s = build()
    L.S(20000, "DEAD")
    L.add(21000, "R", "CORNER")
    corner = L.ops[-1]["seq"]
    L.S(22000, "US", auto_band=4)
    goal = L.goal(25000, "US")
    L.add(60000, "H", "END")
    tl = build_timeline(effective_ops(L.ops)); lab = label_match(tl, "m")
    roots = {o["seq"]: o["seq"] for o in L.ops}
    ans = {k.format(**s, corner=corner, goal=goal): v for k, v in answers.items()}
    return match_details(tl, lab, ans, roots, meta or {"veo": {}}, L.ops), s, corner, goal


def test_players_get_xg_xa_reaction_and_duos():
    d, s, corner, goal = _full({
        "SHOT:{shot}": {"loc": "SIX", "body": "FOOT", "situation": "OPEN", "shooter": "9", "assister": "10"},
        "GOAL:{goal}": {"loc": "CENTRAL_BOX", "body": "FOOT", "situation": "SET_PIECE", "shooter": "9", "assister": "10"},
        "LOSS:{loss}": {"lost_by": "10", "first_presser": "10", "cause": "INTERCEPTED"}})
    p = {r["num"]: r for r in d["players"]}
    assert p["9"]["xg"] > 0.3 and p["10"]["xa"] == p["9"]["xg"]
    assert p["10"]["reactions"] == 1 and p["10"]["loss_causes"] == {"INTERCEPTED": 1}
    assert d["duos"] == [{"from": "10", "to": "9", "shots": 2, "goals": 1, "xg": p["9"]["xg"]}]


def test_minutes_played_come_from_the_lineup():
    meta = {"veo": {}, "lineup": {"starters": ["9", "10"], "subs": [{"in": "15", "out": "9", "half": 1, "t": 30000}]}}
    d, *_ = _full({"SHOT:{shot}": {"shooter": "15"}}, meta)
    p = {r["num"]: r for r in d["players"]}
    assert p["9"]["minutes"] == 0.5 and p["15"]["minutes"] == 0.5 and p["10"]["minutes"] == 1.0


def test_fifteen_minute_blocks_entry_outcomes_and_deliveries():
    d, s, corner, goal = _full({"SET_PIECE:{corner}": {"delivery": "NEAR", "first_contact": "US"}})
    b = d["blocks"][0]
    assert (b["half"], b["start_min"]) == (1, 0) and b["shots"]["US"] == 2 and b["xg"]["US"] > 0
    assert 0 < b["possession"] < 1
    assert d["deliveries"]["US"] == {"NEAR": {"n": 1, "won": 1}}
    assert isinstance(d["entry_outcomes"], dict)

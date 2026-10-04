"""
v1 engine (P2): log -> timeline -> labels -> gates -> normalize_match.
Synthetic logs pin each rule; the Ahuntsic first half (real live tagging,
codebook 1.0.0) is the real-match check.
"""

import json
from pathlib import Path

import pytest

from src.v1.log import effective_ops
from src.v1.timeline import build_timeline
from src.v1.labels import label_match
from src.v1.gates import integrity_gates
from src.ingestion.normalize import normalize_match, is_v1
from src.analytics.possessions import possessions_from_match
from src.analytics.classic import classic_report

FIX = Path(__file__).parent / "fixtures"


class Log:
    """Builds a v1 log like the tagger does (seq, auto children with src)."""
    def __init__(self, half=1):
        self.ops, self.half = [], half
        self.add(0 if half == 1 else 2_700_000, "H", "START")

    def add(self, t, k, v=None, **extra):
        op = {"seq": len(self.ops) + 1, "t": t, "half": self.half, "k": k, "v": v, **extra}
        self.ops.append(op)
        return op["seq"]

    def S(self, t, v, auto_band=None):
        s = self.add(t, "S", v)
        if auto_band is not None:
            self.add(t, "Z", auto_band, auto=True, src=s)
        return s

    def goal(self, t, team):
        g = self.add(t, "SH", "GOAL", team=team)
        self.add(t, "S", "DEAD", auto=True, src=g)
        self.add(t, "R", "KICKOFF", auto=True, src=g)
        return g


def bundle(ops, **meta):
    return {"schema_version": "1.0", "codebook_version": "1.0.0", "exported_at": "2026-10-04T00:00:00Z",
            "meta": {"id": "m_test", "date": "2026-10-04", "opponent": "Test", "venue": "home",
                     "veo": {"url": "", "offset_h1_ms": None, "offset_h2_ms": None, "checked": False}, **meta},
            "events": ops, "reviewed": []}


# ---------- log ----------

def test_retractions_take_their_automatic_children_and_ignore_h():
    L = Log()
    s = L.S(1000, "US", auto_band=2)
    L.add(2000, "U", s)
    L.add(2500, "U", 1)                     # undo of H START is ignored
    ops = effective_ops(L.ops)
    assert [o["k"] for o in ops] == ["H"]


def test_edits_reorder_by_match_time():
    L = Log()
    L.S(1000, "US", auto_band=2)
    z = L.add(3000, "Z", 3)
    L.add(4000, "Z", 4)
    L.add(5000, "U", z)
    L.add(5000, "Z", 3, edit_of=z)          # moved later than the zone 4 press... at 5000
    ops = effective_ops(L.ops)
    assert [o["v"] for o in ops if o["k"] == "Z"] == [2, 4, 3]


def test_patch_replaces_the_window():
    L = Log()
    L.S(1000, "US", auto_band=2)
    L.add(3000, "Z", 3)
    L.add(9000, "PATCH", {"replace": [2000, 4000], "half": 1, "ops": [{"seq": 100000, "t": 2500, "half": 1, "k": "Z", "v": 4}]})
    assert [o["v"] for o in effective_ops(L.ops) if o["k"] == "Z"] == [2, 4]


# ---------- timeline ----------

def kickoff_then(L):
    L.add(500, "CLOCK", "START")
    return L


def test_state_segments_and_restarts():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    L.add(5000, "Z", 3)
    L.S(10000, "DEAD")
    L.add(11000, "R", "THROW")
    L.add(11500, "Z", 3)
    L.S(15000, "THEM")
    L.add(60000, "H", "END")
    tl = build_timeline(effective_ops(L.ops))
    assert [(s.state, s.start, s.end) for s in tl.states] == [
        ("DEAD", 0, 1000), ("US", 1000, 10000), ("DEAD", 10000, 15000), ("THEM", 15000, 60000)]
    kick, throw = tl.restarts
    assert (kick.type, kick.team, kick.band) == ("KICKOFF", "US", 2)
    assert (throw.type, throw.team, throw.band, throw.t) == ("THROW", "THEM", 3, 15000)
    assert tl.halves[1] == (0, 60000)


def test_lost_thread_makes_unknown_until_next_state():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    L.add(5000, "LOST")
    L.S(20000, "THEM")
    L.add(30000, "H", "END")
    tl = build_timeline(effective_ops(L.ops))
    assert [(s.state, s.start, s.end) for s in tl.states][1:] == [("US", 1000, 5000), ("UNKNOWN", 5000, 20000), ("THEM", 20000, 30000)]


def test_shot_team_comes_from_the_zone_unless_stored():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    L.add(3000, "Z", 4)
    L.S(5000, "THEM")                       # keeper pressed before the shot
    L.add(5500, "SH", "ON")                 # no stored team: zone 4 -> us
    L.add(9000, "Z", 1)
    L.add(9500, "SH", "OFF", team="US")     # stored team wins
    L.add(20000, "H", "END")
    tl = build_timeline(effective_ops(L.ops))
    assert [(s.v, s.team) for s in tl.shots] == [("ON", "US"), ("OFF", "US")]


def test_goal_scores_and_restarts_with_kickoff():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    L.add(3000, "Z", 5)
    L.goal(4000, "US")
    L.S(30000, "THEM", auto_band=3)
    L.add(40000, "H", "END")
    tl = build_timeline(effective_ops(L.ops))
    assert tl.score == {"US": 1, "THEM": 0}
    assert (tl.restarts[-1].type, tl.restarts[-1].team) == ("KICKOFF", "THEM")


# ---------- labels ----------

def labelled(L, end=120000):
    L.add(end, "H", "END")
    tl = build_timeline(effective_ops(L.ops))
    return tl, label_match(tl, "m_test")


def test_possessions_merge_across_own_restart_and_split_on_opponent():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    L.S(10000, "DEAD")
    L.add(11000, "R", "THROW"); L.add(11200, "Z", 2)
    L.S(15000, "US")                        # our throw: same possession
    L.S(30000, "THEM")                      # loss
    L.S(50000, "DEAD"); L.add(51000, "R", "GK")
    L.S(60000, "US", auto_band=0)           # our goal kick: new possession
    tl, lab = labelled(L)
    ps = lab.possessions
    assert [(p.team, p.start_ms, p.end_ms, p.start_type, p.end_type) for p in ps] == [
        ("us", 1000, 30000, "kickoff", "perte"),
        ("them", 30000, 50000, "recup", "set_piece"),
        ("us", 60000, 120000, "set_piece", "half_end")]
    assert ps[0].stoppage_ms == 5000 and ps[0].duration_ms == 24000


def test_regains_losses_and_entries():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    L.add(3000, "Z", 3); L.add(5000, "Z", 4); L.add(7000, "Z", 5)
    L.S(9000, "THEM")
    L.add(10000, "Z", 3)
    L.S(12000, "US")
    L.add(14000, "Z", 4)
    L.S(20000, "THEM"); L.add(21000, "Z", 2); L.add(23000, "Z", 1); L.add(25000, "Z", 0)
    tl, lab = labelled(L)
    assert [(r.t, r.band) for r in lab.regains] == [(12000, 3)]
    assert [(l.t, l.band) for l in lab.losses] == [(9000, 5), (20000, 4)]
    assert [(e.t, e.kind) for e in lab.entries if e.team == "US"] == [(5000, "redzone"), (7000, "box"), (14000, "redzone")]
    assert [(e.t, e.kind) for e in lab.entries if e.team == "THEM"] == [(23000, "redzone"), (25000, "box")]


def test_phases_follow_the_codebook_precedence():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)            # build-up in band 2
    L.add(30000, "Z", 3)                    # settled
    L.S(40000, "THEM")
    L.S(45000, "US")                        # regain -> transition 10 s
    L.S(70000, "DEAD"); L.add(71000, "R", "CORNER")
    L.S(75000, "US", auto_band=4)           # corner -> set piece 20 s
    tl, lab = labelled(L)
    us = [(p.start, p.end, p.phase) for p in lab.phases if p.team == "US"]
    assert us == [(1000, 30000, "BUILD_UP"), (30000, 40000, "SETTLED"), (45000, 55000, "TRANSITION"),
                  (55000, 70000, "SETTLED"), (75000, 95000, "SET_PIECE"), (95000, 120000, "SETTLED")]


# ---------- gates ----------

def test_gates_on_a_clean_log():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    L.add(3000, "Z", 5)
    L.goal(4000, "US")
    L.add(2_700_000, "H", "END")
    g = {x["id"]: x for x in integrity_gates(bundle(L.ops), build_timeline(effective_ops(L.ops)))}
    assert g["G1"]["ok"] and g["G2"]["ok"] and g["G4"]["ok"] and g["G5"]["ok"]
    assert not g["G3"]["ok"] and g["G3"]["scope"] == "clips"      # no Veo offsets yet


def test_score_corrections_that_disagree_with_goals_block():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    L.add(2000, "SCORE", "THEM+1")
    L.add(2_700_000, "H", "END")
    g = {x["id"]: x for x in integrity_gates(bundle(L.ops), build_timeline(effective_ops(L.ops)))}
    assert not g["G2"]["ok"] and g["G2"]["blocking"]


# ---------- normalize_match ----------

def test_v0_exports_go_through_the_old_path_untouched():
    raw = json.loads((FIX / "vanier_2026-09-26.json").read_text())
    match, ps = normalize_match(raw, "vanier")
    assert not is_v1(raw) and match is raw
    assert [p.to_dict() for p in ps] == [p.to_dict() for p in possessions_from_match(raw, "vanier")]


def test_v1_feeds_the_existing_engine():
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    L.add(3000, "Z", 4); L.add(5000, "Z", 5)
    L.add(6000, "SH", "ON")
    L.S(7000, "THEM")
    L.add(2_700_000, "H", "END")
    match, ps = normalize_match(bundle(L.ops), "m_test")
    codes = [e["code"] for e in match["events"]]
    assert "TIR_C" in codes and "PERTE" in codes and codes.count("SEQUENCE") == 2
    assert classic_report(match, ps)["headline"]["shots"] == 1
    assert match["v1"]["gates"] and match["match"]["opponent"] == "Test"


# ---------- real match: Ahuntsic, first half, live ----------

@pytest.fixture(scope="module")
def ahuntsic():
    raw = json.loads((FIX / "ahuntsic_2026-10-02_h1_v1.json").read_text())
    return raw, normalize_match(raw, "ahuntsic")


def test_ahuntsic_numbers(ahuntsic):
    raw, (match, ps) = ahuntsic
    tl = match["v1"]["timeline"]
    t = {s: sum(x.end - x.start for x in tl.states if x.state == s) for s in ("US", "THEM", "DEAD")}
    assert round(100 * t["US"] / (t["US"] + t["THEM"])) == 58
    assert tl.score == {"US": 0, "THEM": 2}
    assert [(s.team) for s in tl.shots].count("US") == 4 and len(tl.shots) == 11
    kinds = {}
    for r in tl.restarts:
        kinds[r.type] = kinds.get(r.type, 0) + 1
    assert (kinds["THROW"], kinds["FK"], kinds["GK"]) == (31, 14, 8)


def test_ahuntsic_gates_and_engine(ahuntsic):
    raw, (match, ps) = ahuntsic
    g = {x["id"]: x for x in match["v1"]["gates"]}
    assert g["G1"]["ok"] and g["G2"]["ok"] and g["G4"]["ok"] and g["G5"]["ok"]
    assert sum(p.end_type == "opp_goal" for p in ps) == 2
    report = classic_report(match, ps)
    assert report["headline"]["shots"] == 4


# ---------- answers (stage 5) ----------

def test_answers_join_by_original_press_latest_wins():
    from src.v1.answers import latest_answers, root_seq, answer_for
    L = kickoff_then(Log())
    L.S(1000, "US", auto_band=2)
    z = L.add(3000, "Z", 4)
    L.add(5000, "U", z)
    z2 = L.add(3500, "Z", 4, edit_of=z)
    reviewed = [{"card": f"ENTRY:{z}", "q": {"lane": "C"}}, {"card": f"ENTRY:{z}", "q": {"lane": "HS_R", "method": "PASS"}}]
    a = answer_for(latest_answers(reviewed), root_seq(L.ops), "ENTRY", z2)
    assert a == {"lane": "HS_R", "method": "PASS"}

"""Automatic sentences (titles, headline, recap): templates always, an LLM when
a key is set, numbers checked against the facts, analyst edits win."""

import json
from pathlib import Path
from types import SimpleNamespace

from src.ingestion.normalize import normalize_match
from src.v1.details import match_details
from src.v1.recap import build_recap
from src.v1.texts import build_facts, generate, numbers_ok, TextStore

FIX = Path(__file__).parent / "fixtures"


def facts():
    raw = json.loads((FIX / "ahuntsic_2026-10-02_full_v1.json").read_text())
    m, _ = normalize_match(raw, "a")
    v = m["v1"]
    d = match_details(v["timeline"], v["labels"], v["answers"], v["roots"], v["meta"], v["ops"])
    return build_facts(v["metrics"], d, build_recap(v["metrics"], []), {"opponent": "Ahuntsic", "final_score": m["final_score"]})


class FakeClient:
    def __init__(self, texts=None, stop="end_turn"):
        self.texts, self.stop, self.calls = texts or {}, stop, []
        self.messages = self

    def parse(self, **kw):
        self.calls.append(kw)
        out = SimpleNamespace(items=[SimpleNamespace(key=k, text=t) for k, t in self.texts.items()])
        return SimpleNamespace(stop_reason=self.stop, parsed_output=out)


def test_every_title_has_a_template_with_its_numbers():
    f = facts()
    assert {"recap.headline", "attaque.zones", "cpa.ours"} <= set(f)
    assert "attaque.creation" not in f          # the fixture has no review answers: no sentence without its data
    out = generate(f, client=None)
    assert out["source"] == "template"
    assert "Ahuntsic" in out["texts"]["recap.headline"] and any(ch.isdigit() for ch in out["texts"]["recap.headline"])
    assert all(numbers_ok(t, f[k]["facts"]) for k, t in out["texts"].items())


def test_an_llm_sentence_with_a_number_not_in_the_facts_falls_back_to_the_template():
    f = facts()
    good = f["attaque.zones"]["template"].replace("de nos", "parmi nos")
    out = generate(f, client=FakeClient({"attaque.zones": good, "recap.headline": "Une victoire 99-0 sur Ahuntsic."}))
    assert out["texts"]["attaque.zones"] == good
    assert out["texts"]["recap.headline"] == f["recap.headline"]["template"]
    assert out["source"] == "llm" and "attaque.zones" in out["llm_keys"] and "recap.headline" not in out["llm_keys"]


def test_a_refusal_keeps_the_templates():
    f = facts()
    out = generate(f, client=FakeClient({"recap.headline": "x"}, stop="refusal"))
    assert out["source"] == "template" and out["texts"]["recap.headline"] == f["recap.headline"]["template"]


def test_edits_win_and_the_cache_follows_the_facts(tmp_path):
    f = facts()
    store = TextStore(tmp_path)
    client = FakeClient({})
    first = store.get_or_make("m1", f, client=client)
    again = store.get_or_make("m1", f, client=client)
    assert len(client.calls) == 1 and first["texts"] == again["texts"]
    store.edit("m1", "recap.headline", "Ma phrase à moi.")
    assert store.get_or_make("m1", f, client=client)["texts"]["recap.headline"] == "Ma phrase à moi."
    store.edit("m1", "recap.headline", "")
    assert store.get_or_make("m1", f, client=client)["texts"]["recap.headline"] == f["recap.headline"]["template"]

"""
log - the live log (events.jsonl) as the engine sees it (CODEBOOK §4).

DEFINITIONS
    retraction : a `U` line cancels the line whose seq it names; a `U` aimed
                 at an H, U or CLOCK line is ignored. Lines produced by the
                 tagger (`src` = the press that caused them) are cancelled
                 with their press.
    edit       : a retraction + a corrected line (`edit_of`); nothing special
                 to do here, the corrected line is an ordinary line.
    patch      : {"k": "PATCH", "v": {"replace": [a, b], "half": h, "ops": [...]}}
                 removes the match lines (S, Z, R, SH) of half h with
                 a <= t <= b and inserts the patch's lines.
    order      : resolve retractions, apply patches, sort by (half, t, seq).
"""

from src.codebook import load_codebook

MATCH_KINDS = {"S", "Z", "R", "SH", "F", "LOST"}
PATCHABLE = {"S", "Z", "R", "SH"}


def retracted_set(ops: list[dict]) -> set[int]:
    ignored = set(load_codebook()["log"]["retraction_ignored_for"])
    by_seq = {o["seq"]: o for o in ops}
    out = set()
    for o in ops:
        if o["k"] == "U":
            target = by_seq.get(o["v"])
            if target is not None and target["k"] not in ignored:
                out.add(target["seq"])
    out |= {o["seq"] for o in ops if o.get("src") in out}
    return out


def apply_patches(ops: list[dict]) -> list[dict]:
    out = [o for o in ops if o["k"] != "PATCH"]
    for p in (o for o in ops if o["k"] == "PATCH"):
        a, b = p["v"]["replace"]
        half = p["v"]["half"]
        out = [o for o in out if not (o["k"] in PATCHABLE and o["half"] == half and a <= o["t"] <= b)]
        out += p["v"]["ops"]
    return out


def effective_ops(ops: list[dict]) -> list[dict]:
    """Lines that count, in match-time order. U lines themselves are dropped."""
    gone = retracted_set(ops)
    kept = [o for o in ops if o["k"] != "U" and o["seq"] not in gone]
    return sorted(apply_patches(kept), key=lambda o: (o["half"], o["t"], o["seq"]))

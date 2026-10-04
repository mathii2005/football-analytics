"""
answers - review answers joined to the log (CODEBOOK §5, §6.7).

    file      : reviewed.jsonl, append-only; the latest line of a card wins.
    card id   : "<KIND>:<seq>" where seq is the ORIGINAL press (an edited line
                keeps its card: edit_of is followed back to the first press).
                Low-fidelity gap cards: "GAP:block:<half>:<i>".
    join      : answers are looked up by (kind, original seq).
"""


def latest_answers(reviewed: list[dict]) -> dict:
    out = {}
    for line in reviewed or []:
        out[line["card"]] = line.get("q") or {}
    return out


def root_seq(ops: list[dict]) -> dict:
    """seq -> original seq (following edit_of)."""
    by = {o["seq"]: o for o in ops}

    def root(o):
        seen = set()
        while o.get("edit_of") in by and o["seq"] not in seen:
            seen.add(o["seq"])
            o = by[o["edit_of"]]
        return o["seq"]
    return {o["seq"]: root(o) for o in ops}


def answer_for(answers: dict, roots: dict, kind: str, seq) -> dict | None:
    if seq is None:
        return None
    return answers.get(f"{kind}:{roots.get(seq, seq)}")

"""
quality - lag calibration and review reliability (CODEBOOK §10; PIPELINE §6 stage 8).

    calibration  edits that only moved a press in time (same value) measure the
                 tagging lag: lag = original t - corrected t (positive = pressed
                 late). The clip lead stays at clock.clip_lead_ms unless the
                 median lag goes above 4 s (then a codebook change is proposed).
    agreement    share of cards answered identically in two passes over the
                 same clips (CANT_SEE excluded), per question.
    coarsen      the merge applied to a question that fails the reliability bar.
"""

from statistics import median

from src.codebook import load_codebook

LEAD_ALERT_MS = 4000


def calibration(ops):
    by = {o["seq"]: o for o in ops}
    lags = [by[o["edit_of"]]["t"] - o["t"] for o in ops
            if o.get("edit_of") in by and by[o["edit_of"]]["k"] == o["k"] and by[o["edit_of"]]["v"] == o["v"]
            and by[o["edit_of"]]["t"] != o["t"]]
    med = median(lags) if lags else None
    return {"n": len(lags), "median_lag_ms": med, "lead_ms": load_codebook()["clock"]["clip_lead_ms"],
            "propose_longer_lead": med is not None and med > LEAD_ALERT_MS}


def agreement(first: dict, second: dict, question: str):
    pairs = [(first[c].get(question), second[c].get(question)) for c in first.keys() & second.keys()]
    pairs = [(a, b) for a, b in pairs if a not in (None, "CANT_SEE") and b not in (None, "CANT_SEE")]
    return {"n": len(pairs), "agreement": round(sum(a == b for a, b in pairs) / len(pairs), 3) if pairs else None,
            "bar": load_codebook()["reliability"]["agreement"]}


COARSE = {
    "lane": lambda v: {"HS_L": "L", "HS_R": "R"}.get(v, v),
    "intent_lane": lambda v: {"HS_L": "L", "HS_R": "R"}.get(v, v),
    "last_pass_lane": lambda v: {"HS_L": "L", "HS_R": "R"}.get(v, v),
    "phase_check": lambda v: "TRANSITION" if v == "TRANSITION" else "NOT_TRANSITION",
    "closing_3s": lambda v: "0-1" if v in ("0", "1") else "2+" if v in ("2", "3PLUS") else v,
    "assist": lambda v: "CROSS" if v == "CROSS" else "NOT_CROSS",
    "intent": lambda v: {"PASS_INTO_HS": "INSIDE", "SHORT_COMBINATION": "INSIDE", "THROUGH": "BEHIND", "DRIBBLE": "BEHIND",
                         "CROSS": "WIDE", "SWITCH": "WIDE", "PASS_WIDE": "WIDE", "CUTBACK": "WIDE"}.get(v, "OTHER"),
}


def coarsen(question, value):
    if question == "between_lines":
        return None                     # dropped when unreliable
    f = COARSE.get(question)
    return f(value) if f and value not in (None, "CANT_SEE") else value

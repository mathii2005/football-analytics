"""
adapter - presents a v1 match to the existing engine (classic, report, clips,
timeline, season), which reads v0-style events and Possession objects.

    RECUP / PERTE  at our regains / losses (zone = band at that moment)
    set pieces     at the moment the restart is taken: THROW -> TOUCHE,
                   CORNER -> CORNER, FK -> COUP_FRANC, GK -> DEGAGEMENT,
                   PEN -> PENALTY (kick-offs are not events in v0)
    shots          ON -> TIR_C, OFF -> TIR_HC, GOAL -> BUT, team from the shot
    SEQUENCE       at each of our red-zone or box entries (is_box when into band 5):
                   the v0 "dangerous action" until the review says how
    team           None = us, "them" = opponent (v0 convention)
    zone / is_box  band 0 -> zone 1, bands 1-4 -> 1-4, band 5 -> zone 4 + is_box
"""

from src.v1.labels import LEGACY_ZONE

RESTART_CODE = {"THROW": "TOUCHE", "CORNER": "CORNER", "FK": "COUP_FRANC", "GK": "DEGAGEMENT", "PEN": "PENALTY"}
SHOT_CODE = {"ON": "TIR_C", "OFF": "TIR_HC", "GOAL": "BUT"}
LABEL = {"RECUP": "Récupération", "PERTE": "Perte", "TOUCHE": "Touche", "CORNER": "Corner", "COUP_FRANC": "Coup franc",
         "DEGAGEMENT": "Dégagement", "PENALTY": "Penalty", "TIR_C": "Tir cadré", "TIR_HC": "Tir non cadré", "BUT": "But",
         "SEQUENCE": "Entrée zone rouge"}


def legacy_events(tl, lab) -> list[dict]:
    raw = []
    for r in lab.regains:
        raw.append((r.half, r.t, "RECUP", r.band, None))
    for l in lab.losses:
        raw.append((l.half, l.t, "PERTE", l.band, None))
    for r in tl.restarts:
        if r.type in RESTART_CODE:
            raw.append((r.half, r.t, RESTART_CODE[r.type], r.band, r.team))
    for s in tl.shots:
        raw.append((s.half, s.t, SHOT_CODE[s.v], s.band, s.team))
    seen = set()                       # one SEQUENCE per band change (3 -> 5 is both: keep one, in the box)
    for e in sorted(lab.entries, key=lambda e: e.kind == "redzone"):
        if e.team == "US" and (e.half, e.t) not in seen:
            seen.add((e.half, e.t))
            raw.append((e.half, e.t, "SEQUENCE", e.band, "US"))
    raw.sort(key=lambda x: (x[0], x[1]))

    out, us, them = [], 0, 0
    for i, (half, t, code, band, team) in enumerate(raw):
        state = "LEAD" if us > them else "TRAIL" if us < them else "TIED"
        out.append({"id": f"v1_{i}", "timestamp_ms": t, "half": half, "code": code, "label": LABEL[code],
                    "zone": None if band is None else (4 if band == 5 else LEGACY_ZONE[band]),
                    "is_box": band == 5, "couloir": None, "team": "them" if team == "THEM" else None,
                    "score_us": us, "score_them": them, "score_state": state})
        if code == "BUT":
            us, them = (us + 1, them) if team == "US" else (us, them + 1)
    return out


def attach_events(possessions, events):
    """Give each possession the v0 events inside it (the closing loss/shot included)."""
    for p in possessions:
        inside = [e for e in events if e["half"] == p.half and
                  (p.start_ms <= e["timestamp_ms"] < p.end_ms or
                   (e["timestamp_ms"] == p.end_ms and e["code"] in ("PERTE", "BUT", "TIR_C", "TIR_HC")))]
        p.events, p.event_ids, p.codes = inside, [e["id"] for e in inside], [e["code"] for e in inside]
    return possessions

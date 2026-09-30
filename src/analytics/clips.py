"""
review clips - the Veo moments worth a coach's time, chosen by what they
cost or produced and by the game context, not every tagged event

DEFINITIONS (proposed; the staff owns them - change deliberately)
    categories, base priority:
      goal_against   100  how each goal against started: our loss that
                          opened their scoring possession, or their set
                          piece inside it (or its start when untagged)
      goal_for        90  build-up of our goals: from the start of the
                          scoring possession, at most BUILDUP_MAX_MS before
      chance          70  shots on target that didn't score, and shots
                          from the box (+10 if in the box)
      costly_loss     60  losses in our half (zone 1-2), and cheap losses
                          (< CHEAP_LOSS_MS after winning it) anywhere
      press_win       55  high recoveries (zone 3/4/box) whose possession
                          reached the box or a shot - examples to repeat
      recurring       50  the zone where we lose the ball most in their
                          half: RECURRING_EXAMPLES losses spread across
                          the match, as examples of the same situation
    context bonus:
      +10 level score (tied at that moment), +5 one-goal game
      +10 late        (last LATE_MS of either half on the match clock:
                       from 35:00 and from 80:00, stoppage time included)
      +15 protecting a lead late: a loss in our half while leading by
          one in the last LATE_MS of the match
    selection     : the top SELECTION_SIZE clips by priority, dropping any
                    clip within DEDUPE_MS of a higher-priority one.
Tagging lag is handled by video.CLIP_LEAD_MS (links open early).
"""

from src.analytics.metrics import CHEAP_LOSS_MS, HIGH_PRESS_ZONES, reached_box, is_box_event
from src.analytics.possessions import US, THEM, SHOT_CODES, GOAL_CODES, SET_PIECE_CODES, \
    HALF_LENGTH_MS, format_ms
from src.analytics.video import video_url

BUILDUP_MAX_MS = 25_000
LATE_MS = 10 * 60_000
DEDUPE_MS = 10_000
SELECTION_SIZE = 12
RECURRING_EXAMPLES = 4

CATEGORIES = {
    "goal_against": ("Buts encaissés", 100),
    "goal_for": ("Nos buts", 90),
    "chance": ("Occasions", 70),
    "costly_loss": ("Pertes à revoir", 60),
    "press_win": ("Pressing réussi", 55),
    "recurring": ("Situation récurrente", 50),
}
ZONE_FR = {1: "zone 1", 2: "zone 2", 3: "zone 3", 4: "zone 4", "BOX": "la surface"}
SET_PIECE_FR = {"CORNER": "Corner", "COUP_FRANC": "Coup franc", "TOUCHE": "Touche",
                "PENALTY": "Penalty", "DEGAGEMENT": "Dégagement"}


def is_late(half, t_ms):
    return t_ms >= half * HALF_LENGTH_MS - LATE_MS


def context(possessions, half, t_ms, score_us, score_them, is_loss_own_half=False):
    bonus, tags = 0, []
    diff = score_us - score_them
    if diff == 0:
        bonus += 10
        tags.append("À égalité")
    elif abs(diff) == 1:
        bonus += 5
        tags.append("Écart d'un but")
    late = is_late(half, t_ms)
    if late:
        bonus += 10
        tags.append("Fin de mi-temps" if half == 1 else "Fin de match")
    if is_loss_own_half and diff == 1 and late and half == max(p.half for p in possessions):
        bonus += 15
        tags.append("On protège une avance")
    return bonus, tags


def make_clip(veo, possessions, category, half, t_ms, title, reason, score, possession_id,
              extra=0, is_loss_own_half=False):
    label, base = CATEGORIES[category]
    bonus, tags = context(possessions, half, t_ms, score[0], score[1], is_loss_own_half)
    return {
        "category": category, "category_label": label, "priority": base + extra + bonus,
        "half": half, "t_ms": t_ms, "at": format_ms(t_ms), "title": title, "reason": reason,
        "context": tags, "score": f"{score[0]}–{score[1]}", "possession_id": possession_id,
        "video_url": video_url(veo, half, t_ms),
    }


def ev_score(e):
    return e.get("score_us", 0), e.get("score_them", 0)


def goal_against_clips(veo, ps):
    out = []
    for i, p in enumerate(ps):
        if p.team != THEM or p.end_type != "opp_goal":
            continue
        prev = ps[i - 1] if i > 0 and ps[i - 1].half == p.half else None
        found = len(out)
        sp = next((e for e in p.events if e["code"] in SET_PIECE_CODES and e.get("team") == THEM), None)
        if prev is not None and prev.team == US and prev.end_type == "perte" and prev.events:
            loss = prev.events[-1]
            out.append(make_clip(veo, ps, "goal_against", p.half, loss["timestamp_ms"],
                                 f"Perte en {ZONE_FR.get(prev.end_zone, 'zone ?')}, but adverse ensuite",
                                 "La possession adverse qui mène au but commence sur cette perte.",
                                 ev_score(loss), prev.possession_id))
        if sp is not None:
            out.append(make_clip(veo, ps, "goal_against", p.half, sp["timestamp_ms"],
                                 f"{SET_PIECE_FR[sp['code']]} adverse, but ensuite",
                                 "Coup de pied arrêté concédé dans la possession du but adverse.",
                                 ev_score(sp), p.possession_id))
        if len(out) == found:
            out.append(make_clip(veo, ps, "goal_against", p.half, p.start_ms,
                                 "But adverse", "Début (estimé) de la possession adverse qui mène au but.",
                                 (p.score_us, p.score_them), p.possession_id))
    return out


def goal_for_clips(veo, ps):
    out = []
    for p in ps:
        if p.team != US:
            continue
        for e in p.events:
            if e["code"] not in GOAL_CODES:
                continue
            sp = next((x for x in reversed(p.events) if x["code"] in SET_PIECE_CODES
                       and x["timestamp_ms"] <= e["timestamp_ms"]), None)
            if sp is not None:
                start = sp["timestamp_ms"]
                title = f"But sur {SET_PIECE_FR[sp['code']].lower()}"
                reason = f"{SET_PIECE_FR[sp['code']]} à {format_ms(start)}, but à {format_ms(e['timestamp_ms'])}."
            else:
                start = max(p.start_ms, e["timestamp_ms"] - BUILDUP_MAX_MS)
                origin = "une récupération" if p.start_type == "recup" else "la possession"
                title = "But"
                reason = f"Construction depuis {origin}, but à {format_ms(e['timestamp_ms'])}."
            out.append(make_clip(veo, ps, "goal_for", p.half, start, title, reason, ev_score(e), p.possession_id))
    return out


def chance_clips(veo, ps):
    out = []
    for p in ps:
        if p.team != US:
            continue
        for e in p.events:
            box = is_box_event(e)
            if e["code"] == "TIR_C" or (e["code"] == "TIR_HC" and box):
                title = "Tir cadré" if e["code"] == "TIR_C" else "Tir non cadré dans la surface"
                out.append(make_clip(veo, ps, "chance", p.half, e["timestamp_ms"], title,
                                     "Occasion franche : à revoir pour la finition." if box else "Tir cadré de loin.",
                                     ev_score(e), p.possession_id, extra=10 if box else 0))
    return out


def costly_loss_clips(veo, ps):
    out = []
    for p in ps:
        if p.team != US or p.end_type != "perte" or not p.events:
            continue
        loss = p.events[-1]
        own_half = p.end_zone in (1, 2)
        cheap = p.duration_ms is not None and p.duration_ms < CHEAP_LOSS_MS
        if not (own_half or cheap):
            continue
        if own_half:
            title, reason = f"Perte dans notre moitié ({ZONE_FR[p.end_zone]})", "Ballon rendu près de notre but."
        else:
            title = f"Ballon reperdu en {p.duration_ms / 1000:.0f} s"
            reason = f"Récupéré puis reperdu aussitôt en {ZONE_FR.get(p.end_zone, 'zone ?')}."
        out.append(make_clip(veo, ps, "costly_loss", p.half, loss["timestamp_ms"], title, reason,
                             ev_score(loss), p.possession_id, extra=5 if own_half and cheap else 0,
                             is_loss_own_half=own_half))
    return out


def press_win_clips(veo, ps):
    out = []
    for p in ps:
        if p.team != US or p.start_type != "recup" or p.start_zone not in HIGH_PRESS_ZONES or not reached_box(p):
            continue
        first = next(e for e in p.events if is_box_event(e) or e["code"] in SHOT_CODES)
        gap = (first["timestamp_ms"] - p.start_ms) / 1000
        what = "tir" if first["code"] in SHOT_CODES else "entrée dans la surface"
        out.append(make_clip(veo, ps, "press_win", p.half, p.start_ms,
                             f"Récupération haute ({ZONE_FR[p.start_zone]})", f"→ {what} {gap:.0f} s plus tard.",
                             ev_score(p.events[0]), p.possession_id))
    return out


def recurring_clips(veo, ps):
    losses = [p for p in ps if p.team == US and p.end_type == "perte" and p.end_zone in (3, 4) and p.events]
    if not losses:
        return []
    zone = max((3, 4), key=lambda z: sum(p.end_zone == z for p in losses))
    in_zone = [p for p in losses if p.end_zone == zone]
    n = min(RECURRING_EXAMPLES, len(in_zone))
    picks = [in_zone[round(i * (len(in_zone) - 1) / max(n - 1, 1))] for i in range(n)]
    return [make_clip(veo, ps, "recurring", p.half, p.events[-1]["timestamp_ms"],
                      f"Perte en {ZONE_FR[zone]} ({k + 1}/{n})",
                      f"{len(in_zone)} pertes en {ZONE_FR[zone]} dans ce match : exemple réparti sur la rencontre.",
                      ev_score(p.events[-1]), p.possession_id)
            for k, p in enumerate(picks)]


def select(clips):
    chosen = []
    for c in sorted(clips, key=lambda c: (-c["priority"], c["half"], c["t_ms"])):
        if any(c["half"] == k["half"] and abs(c["t_ms"] - k["t_ms"]) < DEDUPE_MS for k in chosen):
            continue
        chosen.append(c)
        if len(chosen) == SELECTION_SIZE:
            break
    return sorted(chosen, key=lambda c: (c["half"], c["t_ms"]))


def review_clips(match_data, possessions, veo) -> dict:
    clips = (goal_against_clips(veo, possessions) + goal_for_clips(veo, possessions)
             + chance_clips(veo, possessions) + costly_loss_clips(veo, possessions)
             + press_win_clips(veo, possessions) + recurring_clips(veo, possessions))
    by_cat = {k: sorted([c for c in clips if c["category"] == k], key=lambda c: (c["half"], c["t_ms"]))
              for k in CATEGORIES}
    return {
        "has_video": bool(veo.get("url")) and veo.get("offset1") is not None,
        "selection": select(clips),
        "categories": [{"key": k, "label": CATEGORIES[k][0], "clips": by_cat[k]} for k in CATEGORIES],
    }

"""
video links - maps a tagged moment to its position in the Veo video

The tagger stores, per match, the Veo URL and the video position of each
half's kickoff (veoKickoffOffsetMs, veoKickoffOffsetMs2). Veo opens a
match at a given moment with "<url>#t=MM:SS" (minutes can exceed 59).

DEFINITIONS
    lead-in   : tags are entered live and lag the action by a few
                seconds, so every link opens CLIP_LEAD_MS before the tag.
    half 2    : game clock is 45:00-based in half 2, so video position =
                offset2 + (t - 45:00). Without offset2 the half-1 offset
                is used (continuous footage).
"""

from src.analytics.possessions import HALF_LENGTH_MS

CLIP_LEAD_MS = 8_000


def veo_info(match_data: dict) -> dict:
    meta = match_data.get("match") or {}
    return {
        "url": (meta.get("veoUrl") or "").strip() or None,
        "offset1": meta.get("veoKickoffOffsetMs"),
        "offset2": meta.get("veoKickoffOffsetMs2"),
    }


def video_ms(veo: dict, half: int, t_ms: float):
    """Position in the video of game time t_ms, or None without an offset."""
    if half == 2 and veo.get("offset2") is not None:
        return veo["offset2"] + (t_ms - HALF_LENGTH_MS)
    if veo.get("offset1") is None:
        return None
    return veo["offset1"] + t_ms


def video_url(veo: dict, half: int, t_ms: float, lead_ms: float = CLIP_LEAD_MS):
    if not veo.get("url"):
        return None
    pos = video_ms(veo, half, t_ms)
    if pos is None:
        return None
    seconds = max(0, int((pos - lead_ms) // 1000))
    return f"{veo['url'].split('#')[0]}#t={seconds // 60}:{seconds % 60:02d}"

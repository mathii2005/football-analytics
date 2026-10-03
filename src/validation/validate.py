"""
Validation layer before going through analytics engine

Field reference (from tagger export schema 0.7):
    timestamp_ms : float, elapsed milliseconds WITHIN the current half.
                   Resets at the start of each half — not a global
                   match clock. Do not compare timestamps across halves.
    half         : int, 1 or 2.
    code         : str, event type (see event_codes.ALLOWED_EVENT_CODES).
    zone         : int (1-4), the string "BOX", or null.
                   A null zone means zone 4 by convention (implied,
                   not stored). Null is therefore valid, not missing data.
"""

from src.validation.event_codes import ALLOWED_EVENT_CODES

VALID_ZONE_VALUES = {1, 2, 3, 4, "BOX"}
MIN_EVENT_GAP_MS = 500

def validate_timestamps(events:list[dict]) -> list[dict]:
    """
    checks for duplicate timestamps in the same half
    checks for less than the minimum gap between events
    events are always grouped by halves to avoid duplicate timestamps
    """
issues = []

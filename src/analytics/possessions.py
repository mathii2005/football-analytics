"""
possession reconstruction - turns a flat list of tagged events into
alternating possessions (us / them)

The tagger only records a subset of what happens on the pitch, so
possessions are rebuilt with a small state machine: every event either
says "we have the ball", "they have the ball", or nothing at all.

DEFINITIONS (change these deliberately, the tests pin them down)
    team          : our events are team null or "us", opponent events
                    are team "them" (same convention as the tagger).
    US starts     : RECUP, or any of our set pieces while they have
                    the ball (free kick won, our goal kick, ...), or our
                    kickoff.
    US ends       : PERTE, BUT (they kick off next), or any opponent
                    set piece (their goal kick after our missed shot,
                    their free kick, ...).
    THEM          : the complement - from the end of one of our
                    possessions to the start of the next.
    own set piece : a set piece by the team already in possession does
                    NOT split the possession (e.g. corner after a shot).
    kickoff       : half 1 kickoff team comes from the match metadata
                    (match.kickoffTeam, "us" / "them") when the tagger
                    records it; half 2 is kicked off by the other team;
                    after a goal the team that conceded kicks off. With
                    no kickoff team the first event of the half decides
                    who had the ball, but that start is flagged inexact
                    (the first event can be well after 0:00).
    opponent goal : not tagged; inferred when score_them goes up
                    between two consecutive events.
    stoppages     : STOPPAGE_START / STOPPAGE_END spans are long
                    dead-ball delays - nobody has the ball. Tagging
                    convention: the toggle is only pressed once a
                    restart is clearly going to take a while (players
                    getting in position), a few seconds after the
                    whistle; quick restarts are not toggled and count as
                    live time on purpose. The overlap is subtracted from
                    every possession, so duration_ms excludes long
                    delays only.
                    When an untagged change of possession (or an
                    opponent goal) falls in a gap that contains a
                    stoppage, the change is placed at the stoppage start
                    and treated as exact - it can be a few seconds late
                    (the toggle delay), far tighter than the gap.
    half start    : the tagger clock jumps to 45:00 at half time
                    (markHalfTime), so half 2 starts at 45:00, not 0.
                    Exports whose half 2 clock starts below 45:00 start
                    at 0.
    half end      : last event of the half (no end-of-half marker yet).
    inconsistent  : when an event contradicts the current state (e.g.
                    two RECUP in a row, or a shot while they have the
                    ball) the missing transition is inserted and flagged
                    as inferred instead of silently dropped.

Timestamps are only exact when a tagged event (or stoppage) marks the
boundary. For inferred boundaries start_ms / end_ms hold the tightest
known bound (the previous / next event) and start_exact / end_exact are
False, so duration_ms is None - don't use those possessions for timing
metrics. live_ms is always filled (bound based) for inclusive metrics.

Ignored: cards and any code not listed below (e.g. BALLON2 from schema
0.4) - unknown codes never move possession.
"""

from dataclasses import dataclass, field, asdict

US = "us"
THEM = "them"

REGAIN_CODES = {"RECUP"}
LOSS_CODES = {"PERTE"}
GOAL_CODES = {"BUT"}
SET_PIECE_CODES = {"CORNER", "COUP_FRANC", "TOUCHE", "PENALTY", "DEGAGEMENT"}
SHOT_CODES = {"TIR_C", "TIR_HC", "BUT"}
ACTION_CODES = {"PASSE_PROF", "CONDUITE", "CENTRE", "SWITCH", "SEQUENCE"} | SHOT_CODES
STOPPAGE_START = "STOPPAGE_START"
STOPPAGE_END = "STOPPAGE_END"

HALF_LENGTH_MS = 45 * 60 * 1000

# a null zone means zone 4 by tagger convention (see validation/validate.py)
DEFAULT_ZONE = 4


def other(team: str) -> str:
    return THEM if team == US else US


@dataclass
class Possession:
    match_id: str
    possession_id: int
    half: int
    team: str
    start_ms: float
    end_ms: float
    start_exact: bool
    end_exact: bool
    start_type: str   # recup | set_piece | kickoff | restart | half_start | inferred
    end_type: str     # recup | perte | goal | opp_goal | set_piece | opp_set_piece | stoppage | half_end | inferred
    start_zone: object = None
    end_zone: object = None
    score_us: int = 0
    score_them: int = 0
    stoppage_ms: float = 0.0
    event_ids: list = field(default_factory=list)
    codes: list = field(default_factory=list)
    events: list = field(default_factory=list, repr=False)     # raw events, for metrics
    stoppages: list = field(default_factory=list, repr=False)  # dead-ball spans inside

    @property
    def live_ms(self):
        """Live (ball in play) time between the bounds, exact or not."""
        return self.end_ms - self.start_ms - self.stoppage_ms

    @property
    def duration_ms(self):
        """Live time, only when both boundaries are known."""
        return self.live_ms if self.start_exact and self.end_exact else None

    @property
    def n_events(self):
        return len(self.event_ids)

    @property
    def n_shots(self):
        return sum(c in SHOT_CODES for c in self.codes)

    @property
    def is_inferred(self):
        return not (self.start_exact and self.end_exact)

    def to_dict(self) -> dict:
        d = asdict(self)
        del d["events"], d["stoppages"]
        d.update(live_ms=self.live_ms, duration_ms=self.duration_ms, n_events=self.n_events,
                 n_shots=self.n_shots, is_inferred=self.is_inferred)
        return d


def event_team(event: dict) -> str:
    return THEM if event.get("team") == THEM else US


def event_zone(event: dict):
    zone = event.get("zone")
    return DEFAULT_ZONE if zone is None else zone


def implied_possessor(event: dict):
    """Who must have the ball right after this event, or None if the event says nothing."""
    code = event["code"]
    if code in LOSS_CODES:
        return THEM
    if code in REGAIN_CODES:
        return US
    if code in SET_PIECE_CODES or code in ACTION_CODES:
        # BUT included - the goal itself is handled in reconstruct_half
        return event_team(event)
    return None  # cards, stoppage markers, unknown codes


def stoppage_spans(events: list[dict]) -> list[tuple[float, float]]:
    """Pair STOPPAGE_START / STOPPAGE_END of ONE half into (start_ms, end_ms).

    Same pairing as the tagger pipeline (laureats-tagger derive.py): an END
    with no open START is ignored, a second START while one is open is
    ignored, and a START still open at the end is closed on the last event.
    """
    events = sorted(events, key=lambda e: e["timestamp_ms"])
    spans, open_start = [], None
    for e in events:
        if e["code"] == STOPPAGE_START and open_start is None:
            open_start = e["timestamp_ms"]
        elif e["code"] == STOPPAGE_END and open_start is not None:
            spans.append((open_start, e["timestamp_ms"]))
            open_start = None
    if open_start is not None and events:
        spans.append((open_start, max(open_start, events[-1]["timestamp_ms"])))
    return spans


def overlap_ms(start: float, end: float, spans: list[tuple[float, float]]) -> float:
    return sum(max(0.0, min(end, s_end) - max(start, s_start)) for s_start, s_end in spans)


def half_start_ms(events: list[dict], half: int) -> float:
    """Clock value at kickoff of this half (tagger: 0:00, then 45:00)."""
    nominal = (half - 1) * HALF_LENGTH_MS
    if events and min(e["timestamp_ms"] for e in events) < nominal:
        return 0.0
    return float(nominal)


def reconstruct_half(events: list[dict], match_id: str, half: int, first_id: int = 1,
                     kickoff_team: str | None = None) -> list[Possession]:
    events = sorted(events, key=lambda e: e["timestamp_ms"])
    kickoff_ms = half_start_ms(events, half)
    spans = stoppage_spans(events)
    possessions: list[Possession] = []

    def current() -> Possession | None:
        return possessions[-1] if possessions else None

    def open_(team, start_ms, exact, start_type, event):
        possessions.append(Possession(
            match_id=match_id, possession_id=first_id + len(possessions), half=half,
            team=team, start_ms=start_ms, end_ms=start_ms, start_exact=exact,
            end_exact=False, start_type=start_type, end_type="half_end",
            start_zone=event_zone(event) if start_type == "recup" else None,
            score_us=event.get("score_us", 0), score_them=event.get("score_them", 0),
        ))

    def switch(team, t, exact, end_type, start_type, event):
        """Close the current possession at t and open one for team."""
        p = current()
        p.end_ms, p.end_exact, p.end_type = t, exact, end_type
        if event["code"] in LOSS_CODES and exact:
            p.end_zone = event_zone(event)
        open_(team, t, exact, start_type, event)

    def dead_ball_between(t0, t1):
        """Start of the last stoppage that began in (t0, t1), if any."""
        starts = [s for s, _ in spans if t0 < s < t1]
        return starts[-1] if starts else None

    def infer_switch(team, event, end_type="inferred", start_type="inferred"):
        """A transition was not tagged: it happened after the last known
        event - at the dead ball if one happened in between."""
        dead = dead_ball_between(current().end_ms, event["timestamp_ms"])
        if dead is not None:
            switch(team, dead, True, "stoppage" if end_type == "inferred" else end_type,
                   "restart" if start_type == "inferred" else start_type, event)
        else:
            switch(team, current().end_ms, False, end_type, start_type, event)

    def add(event):
        p = current()
        p.event_ids.append(event.get("id"))
        p.codes.append(event["code"])
        p.events.append(event)
        p.end_ms = event["timestamp_ms"]

    prev = None
    for event in events:
        who = implied_possessor(event)
        if who is None:
            continue
        t = event["timestamp_ms"]
        code = event["code"]

        if current() is None:
            if kickoff_team is not None:
                open_(kickoff_team, kickoff_ms, True, "kickoff", event)
            else:
                # unknown kickoff: whoever had the ball before the first
                # event is assumed to have had it since kickoff - not exact
                if code in LOSS_CODES:
                    before = US
                elif code in REGAIN_CODES or code in SET_PIECE_CODES:
                    before = other(who)
                else:
                    before = who
                open_(before, kickoff_ms, False, "half_start", event)

        # opponent goal between prev and this event: we kick off
        if prev is not None and event.get("score_them", 0) > prev.get("score_them", 0):
            if current().team == US:
                switch(THEM, current().end_ms, False, "inferred", "inferred", event)
            infer_switch(US, event, end_type="opp_goal", start_type="kickoff")

        is_transition = code in REGAIN_CODES or code in LOSS_CODES or (
            code in SET_PIECE_CODES and who != current().team)

        if code in REGAIN_CODES:
            if current().team == US:
                infer_switch(THEM, event)       # untagged loss before this recup
            switch(US, t, True, "recup", "recup", event)
            add(event)

        elif code in LOSS_CODES:
            if current().team == THEM:
                infer_switch(US, event)         # untagged regain before this loss
            add(event)
            switch(THEM, t, True, "perte", "perte", event)

        elif is_transition:
            # set piece for the side without the ball: possession changes here
            switch(who, t, True, "set_piece" if who == US else "opp_set_piece", "set_piece", event)
            add(event)

        else:
            if who != current().team:
                infer_switch(who, event)        # e.g. our shot while they had the ball
            add(event)

        if code in GOAL_CODES and who == US:
            switch(THEM, t, True, "goal", "kickoff", event)

        prev = event

    for p in possessions:
        p.stoppage_ms = overlap_ms(p.start_ms, p.end_ms, spans)
        p.stoppages = [(max(s, p.start_ms), min(e, p.end_ms)) for s, e in spans
                       if s < p.end_ms and e > p.start_ms]
    return possessions


def reconstruct_possessions(events: list[dict], match_id: str = "",
                            kickoff_team: str | None = None) -> list[Possession]:
    """Possessions for a whole match, halves reconstructed independently
    (timestamp_ms resets every half). kickoff_team is who kicked off
    half 1; the other team kicks off half 2."""
    possessions: list[Possession] = []
    for half in sorted({e["half"] for e in events}):
        half_events = [e for e in events if e["half"] == half]
        half_kickoff = None
        if kickoff_team is not None:
            half_kickoff = kickoff_team if half % 2 == 1 else other(kickoff_team)
        possessions += reconstruct_half(half_events, match_id, half,
                                        first_id=len(possessions) + 1, kickoff_team=half_kickoff)
    return possessions


def match_kickoff_team(match_data: dict) -> str | None:
    team = (match_data.get("match") or {}).get("kickoffTeam")
    return team if team in (US, THEM) else None


def possessions_from_match(match_data: dict, match_id: str | None = None) -> list[Possession]:
    return reconstruct_possessions(
        match_data.get("events", []),
        match_id or (match_data.get("match") or {}).get("id", ""),
        kickoff_team=match_kickoff_team(match_data),
    )


def possessions_to_dataframe(possessions: list[Possession]):
    import pandas as pd
    return pd.DataFrame([p.to_dict() for p in possessions])


def format_ms(ms) -> str:
    seconds = int(ms // 1000)
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


def print_possessions(possessions: list[Possession]) -> None:
    print(f"{'#':>3} {'H':>1} {'team':<4} {'start':>5}  {'end':>5}  {'live':>5}  "
          f"{'start_type':<10} {'end_type':<13} events")
    for p in possessions:
        dur = f"{p.duration_ms / 1000:5.1f}" if p.duration_ms is not None else "    ?"
        start = format_ms(p.start_ms) if p.start_exact else "~" + format_ms(p.start_ms)
        end = format_ms(p.end_ms) if p.end_exact else "~" + format_ms(p.end_ms)
        dead = f" (dead {p.stoppage_ms / 1000:.0f}s)" if p.stoppage_ms else ""
        print(f"{p.possession_id:>3} {p.half:>1} {p.team:<4} {start:>6} {end:>6} {dur}s  "
              f"{p.start_type:<10} {p.end_type:<13} {' '.join(p.codes)}{dead}")

    ours = [p for p in possessions if p.team == US]
    theirs = [p for p in possessions if p.team == THEM]
    inferred = sum(p.is_inferred for p in possessions)
    print(f"\nus: {len(ours)} possessions, {sum(p.n_shots for p in ours)} shots, "
          f"{sum(p.end_type == 'goal' for p in ours)} goals | them: {len(theirs)} possessions, "
          f"{sum(p.end_type == 'opp_goal' for p in theirs)} goals | {inferred} with inferred boundaries")


if __name__ == "__main__":
    import argparse
    from src.ingestion.load_match import load_match

    parser = argparse.ArgumentParser()
    parser.add_argument("match_id", nargs="?", default="match_001")
    parser.add_argument("--kickoff", choices=[US, THEM], help="who kicked off half 1 (overrides match metadata)")
    args = parser.parse_args()

    match = load_match(args.match_id)
    if args.kickoff:
        match["match"]["kickoffTeam"] = args.kickoff
    print_possessions(possessions_from_match(match, args.match_id))

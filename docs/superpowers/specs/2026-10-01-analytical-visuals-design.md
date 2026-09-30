# Analytical visuals – design

Date: 2026-10-01 · Status: decided by Claude on the user's explicit delegation
("you are the expert, you tell me what you would do")

## Intent

The metrics are right; the presentation is wrong. Most views are bar lists
and big numbers. Rebuild the presentation the way an analytics provider would:
each view answers one question with the chart form that fits the data, laid
out as a dense tile grid (Tableau / Power BI feel), not a decorated page.

## Data honesty rules

- Time is precise (every event), so time-based views get the most investment.
- Space is coarse: 4 zones for everything, 3 couloirs only on dangerous
  actions. Pitch views are drawn at that true resolution (4 bands, or 4 × 3
  grid). No smoothed blobs, no shot maps, no invented positions.
- Opponent actions are barely tagged: no opponent threat line.
- Small samples are shown with their n; the season baseline is our own
  tagged matches (not a league).

## Palette (validated with dataviz validate_palette, light surface #fff)

- Lauréats `#b8862e`, opponent `#2a6aa8` — all checks pass (CVD ΔE 23.4).
- Sequential: gold ramp for our actions/recoveries; slate-blue ramp for
  losses. Diverging (balances): slate-blue ↔ grey `#e8e6e1` ↔ gold.
- Brand band colours (black/white/gold #c79741) stay for chrome only.

## Views

| # | View | Question | Form |
|---|------|----------|------|
| 1 | Match story (Aperçu) | When were we on top, did it turn into goals? | Two stacked panels, shared minute axis: our threat (per-minute threat smoothed with a Gaussian, σ = 2.5 min) as line + area; possession share (rolling ±2.5 min live-time window, inclusive) as line around a 50 % reference. Vertical event lines through both: goals (ours gold / theirs blue), cards, half-time. |
| 2 | Team radar (Aperçu) | What kind of performance was this vs our usual? | Radar, 8 axes: possession (strict), field tilt, high recoveries %, won back ≤ 10 s, shots per possession, box entries per possession, verticality, possessions not lost cheaply (1 − cheap-loss rate). Each axis scaled 0 → max over our matches. This match (gold, filled) vs season average (blue outline). Tooltip shows raw values. |
| 3 | KPI bullets (Aperçu) | Is each headline number good for us? | Bullet chart per KPI: season min–max range bar, season-average tick, this match's marker + value. |
| 4 | Couloir usage (Terrain) | Which lane do we attack through? | Pitch with 3 lanes shaded by share (gold ramp), big % per lane, arrows with width ∝ share, n per lane. |
| 5 | Zone × couloir heat (Terrain) | Where do dangerous actions arrive? | 4 × 3 grid on pitch (+ box row), gold ramp, counts. |
| 6 | Recovery / loss / balance pitches (Terrain) | Where do we win and lose the ball? | Three pitches, 4 bands each: recoveries (gold ramp), losses (blue ramp), net balance (diverging). Clickable → clips. |
| 7 | Recovery value pitch (Possession) | Which recoveries become danger? | 4-band pitch coloured by % leading to box or shot, n printed, n < 5 hatched. |
| 8 | Possession flow (Possession) | How do possessions start and end? | Sankey: start (Récup Z1–2, Récup Z3–4/surface, CPA, Engagement, Autre) → outcome (But/Tir, Surface, Perte leur ½, Perte notre ½, Perte rapide, Sortie, Inconnu). |
| 9 | Regain curve (Possession) | How fast do we win the ball back? | Survival curve: % of losses not yet regained at t = 0…60 s (1 s steps), overall + one line per loss zone (3, 4, own half); reference lines at 5 s and 10 s. Not-regained losses stay "not regained" to the end. |
| 10 | Transition beeswarm (Possession) | How direct are we after winning it? | Every recovery → next dangerous action time (old definition) as a dot on a 0–60 s axis, bands contre / rapide / construit shaded, median line. |
| 11 | Possession duration density (Possession) | Who keeps the ball longer? | Overlaid smoothed densities (us gold, them blue) of timed possession durations, log-ish axis capped at 120 s, medians marked. |
| 12 | Game-state possession (Possession) | Does score change our possession? | Dot plot: possession % per state with n. |
| 13 | Halves slopegraph (Attaque) | What changed at half-time? | Per metric a line MT1 → MT2, values normalised per row, labels at both ends. |
| 14 | Shot funnel (Attaque) | Where do attacks die? | Recharts funnel with conversion labels. |
| 15 | Actions / box entries by type (Attaque) | How do we attack? | 100 % stacked bar by type + box share, compact. |
| 16 | Set pieces (Attaque) | Who won the restarts? | Butterfly chart, ours left / theirs right. |
| 17 | Clips | unchanged (library, filters, links) | – |

Kept: possession timeline strip (Aperçu), clip links on every countable view.
Removed: scoreboard band as a tall block → compact KPI strip row.

## Backend additions

- `src/analytics/timeline.py` → `match_timeline(match, possessions)`:
  `{minutes: [{half, minute, threat, threat_smooth, poss_share}], events:
  [{half, minute, kind: goal|card|half, team, code}]}`.
- `phases.py` additions: `regain_curve` `{t: [0..60], overall: [...], by_zone:
  {"own": [...], "3": [...], "4": [...]}, n: {...}}`; `durations` `{us: [ms],
  them: [ms]}`; `flow` `{nodes: [{name}], links: [{source, target, value}]}`.
- `classic.transition_speed` adds `deltas_s` (list).
- `src/analytics/season.py` → `season_profile(match_dir)`: per match the
  radar/bullet metrics; `summary` with mean/min/max per metric. Endpoint
  `GET /season` (all matches in FA_MATCH_DIR) and the match page reads it.

Definitions of the radar metrics are documented in `season.py`; tests pin
them on the fixtures.

## Testing

TDD for every backend function (synthetic events + Vanier fixture). Frontend:
build + CDP captures of all tabs at 1440 and 390, checked against real data;
impeccable detector; one finish review.

# Dashboard rebuild – design

Date: 2026-09-30 · Status: approved in chat ("go ahead"), awaiting spec review

## Intent

The user judged the first merged dashboard "a less useful version": too few
stats, the possession engine barely visible, familiar visuals removed. The tool
exists to show stats. Success = every useful view of the old staff dashboard
(`../laureats-tagger/dashboard_vanier2.html`) is back, the possession engine
adds a large layer of stats no event count can give, visuals are the ones real
analytics dashboards use, and the Veo tab becomes a large filterable clip
library. Brand, French UI, scoreboard band and "no football logic in the
frontend" stay.

Constraint: numbers shared with the old dashboard must match it (Vanier
2026-09-26 is the reference). Old definitions are reused verbatim; new ones are
documented in module docstrings and pinned by tests.

## Structure: five tabs

| Tab | Purpose |
|---|---|
| Aperçu | the match in one screen: headline band, auto summary, momentum, possession timeline, top clips |
| Possession & transitions | new engine layer |
| Attaque & finition | old attack views + finishing |
| Terrain | pitch views (restored) |
| Clips Veo | clip library + analyst tagging check |

Each tab keeps a black scoreboard band (5–6 gold figures). Hash-addressable
(`#possession`, `#attaque`, …).

## 1. Restored views (old definitions, verbatim)

From `laureats-tagger/pipeline/build_dashboard.py`:

- **Headline**: récup/perte balance; dangerous actions (PASSE_PROF, CONDUITE,
  CENTRE, SWITCH); actions per shot; shots / on target / goals; **field tilt =
  % of all events with zone 3, 4 or BOX**; high recoveries % (RECUP in
  3/4/BOX); recovery height (zone weights 1–4, BOX 5).
- **Zone control** per zone = récup / (récup + perte); **territorial balance**
  = récup − perte (bar charts).
- **Losses by zone** ("pertes dangereuses", share in our half);
  **recovery-height distribution** (RECUP count per zone).
- **Actions by type** (split box / non-box); **box entries by type**
  (attack codes with is_box).
- **Attack style**: vertical = PASSE_PROF + CONDUITE, lateral = SWITCH +
  CENTRE, as % of their sum; side asymmetry |L − R| / (L + R) over couloir
  counts.
- **Transition speed** (raw, per event): for each RECUP, time to the next
  dangerous action in the same half; excluded if a PERTE comes first, the gap
  exceeds 60 s, or it crosses a tagged stoppage. Median, n, % of recoveries
  leading to an action, buckets contre < 5 s / rapide 5–15 s / construit ≥ 15 s.
- **Tempo per half**: actions, shots, actions/shot, losses.
- **Shot funnel**: dangerous actions → box entries → shots → on target → goals.
- **Momentum** ("intensité offensive"): threat per 5 min (action 1, +2 into
  box, TIR_HC 3, TIR_C 4, BUT 6), both halves on one continuous axis, goal
  markers for both teams, card markers (ours/theirs).
- **Pitch views**: territorial balance drawn on a vertical pitch; attack
  origins couloir × arrival zone heat map on the pitch (box nested in Z4);
  couloir origin bars stacked by action type with % per couloir;
  actions × arrival zone.
- **Set pieces**: counts ours/theirs per type, corner asymmetry, **shots and
  goals from a set piece = our set piece ≤ 20 s before the shot with no PERTE
  in between** (replaces the possession-based rule in `report.py` so numbers
  match the old dashboard).
- **Summary**: generated key points (replace the handwritten narrative;
  factual sentences only). *Amended during build: no separate paragraph – it
  would repeat the key points.*

## 2. New possession-engine layer (new module `src/analytics/phases.py`)

All times are live time (stoppages excluded). Possessions with inferred
boundaries are excluded from any duration statistic and counted in "n".

- **Possession splits**: strict / inclusive / coverage (existing) plus by half,
  by 15-min period (0–15 … 75–90+, stoppage time in the last bin of its half)
  and by game state at possession start (menée / égalité / en avance, from
  score_us − score_them).
- **Possession profile** (us and them): count, median and max duration,
  duration histogram (bins 0–5, 5–10, 10–20, 20–40, 40+ s); start type
  (recup / set_piece / kickoff / other) × outcome counts (existing outcome
  categories).
- **Progression**: start zone of our possessions (RECUP zone, or set-piece
  field zone) × outcome matrix; **recovery value by zone** = for recoveries in
  each zone, % whose possession reached the box, % with a shot, % lost within
  5 s.
- **Counter-press** (new definition): after each of our PERTE, the live time
  until the opponent possession it opened ends with our regain (recup or our
  set piece). Reported: median time to regain, % regained within 5 s and
  10 s, split by the loss zone. Opponent possessions ending in an opponent goal
  or half end count as "not regained". Inferred boundaries excluded.
- **Defensive phases**: opponent possession durations (median, histogram),
  PPDA-lite (existing), opponent possessions ended by a high recovery (%).
- **Finishing efficiency**: shots per possession, possessions per shot, shot
  sequences by start type.
- **Game time**: total live time, dead time (tagged stoppages), tagged
  actions per live minute of our possession (tempo).

## 3. Clip library (`clips.py` extended)

- Priority selection stays, raised to 20 (`SELECTION_SIZE`).
- New library categories (each clip: time, half, zone, game state, period,
  reason, Veo link 8 s early): every shot (not only chances), every box entry,
  every high recovery, losses in our half, **failed counter-press** (loss not
  regained within 10 s and the opponent possession reached a set piece or goal),
  **quick regains** (regained ≤ 5 s – positive), **long build-ups** (our
  possessions ≥ 30 s live), set pieces ours/theirs, goal build-ups (existing),
  goals against (existing).
- API returns the flat library with facet fields; the dashboard filters by
  category, half, zone, game state and sorts by priority or time.
- Analyst tagging check (long silences with links, inferred transitions) stays.
- *Added during build:* `loss` (every PERTE) and `recup` (every RECUP)
  categories, and stat → clips links: zone rows, pitch zones, funnel stages,
  counter-press zones and set pieces open the library pre-filtered.

## 4. API

- `GET /matches/{id}/report` extended with the restored blocks (field tilt,
  zone control, recovery height distribution, actions by type, box entries by
  type, attack style, side asymmetry, transition speed, tempo per half, funnel,
  momentum with cards, set pieces incl. asymmetry, pitch data).
- `GET /matches/{id}/phases` – the new layer (section 2).
- `GET /matches/{id}/clips` – selection + flat library with facets.
- Existing endpoints unchanged.

## 5. Frontend

- Recharts for bars/stacked bars/histograms/line+bar momentum; SVG for pitch
  views and heat maps; one axis per chart; single-series charts in ink, gold
  only for positives (DESIGN.md "Gold Means Good").
- Components split one per view under `dashboard/src/components/`; tab
  screens under `dashboard/src/tabs/`.
- Every chart has a hover tooltip; tables stay available for counts.

## 6. Testing and verification

- TDD per new metric on synthetic events; fixtures: match_001, Champlain
  (stoppages), plus a Vanier regression test asserting the old dashboard's
  numbers (balance −6, 23 dangerous actions, 2.9 actions/shot, 8/5/2 shots,
  field tilt 54 % on the current export (the old sheet shows 56 %: it was built
  before the export was re-saved with 5 card events), high recoveries 33 %, recovery height 2.1, zone balances
  −20/−13/+15/+12, transition median 7.9 s over 16, buckets 4/7/5, 1 goal and 1
  shot from a set piece). Vanier export copied into `tests/fixtures/`.
- API tests for new endpoints; frontend build; impeccable detector and the
  shipped `impeccable-finish-reviewer` at desktop + 390 px (CDP captures).

## Out of scope

Player-level views (no player data), opponent shots (not tagged yet), season
trends, deployment/auth.

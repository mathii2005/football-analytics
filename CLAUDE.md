# Football analytics (Laureats)

Match analytics for the Laureats team, built from our own tagging (laureats
tagger + Veo video). Tag a match → export JSON → possessions and metrics →
API → dashboard / team website / LLM assistant.

## v1 pipeline (in progress, branch `pipeline-v1`)

The next version of the whole system is specified in `docs/pipeline/PIPELINE.md`
(process, tools, weekly routine, build phases P0–P9) and
`docs/pipeline/CODEBOOK.md` (every key, review question, definition and formula).
`shared/codebook.v1.json` is the machine copy, loaded with `src/codebook.py`.
`tests/test_codebook_v1.py` fails if the JSON and the markdown disagree, so a
codebook change means editing both (and the changelog, CODEBOOK §12).
v1 football constants come from the codebook, never hard-coded. The old v0 path
(below) keeps working for existing exports.

## The rule that matters most

**Football definitions belong to the user.** What counts as a possession, a
cheap loss, a high recovery, a direct attack, every threshold and every
statistical interpretation. Claude implements, tests, debugs and proposes; it
never changes a definition silently.

- Every definition lives in the docstring + constants at the top of its module
  (`src/analytics/possessions.py`, `metrics.py`, `quality.py`) and is pinned by
  tests. Changing one = update the docstring, the constant, the tests, and say
  so explicitly to the user.
- Confirmed thresholds: cheap loss < 5 s, direct = box within 15 s, high
  recovery = zone 3/4/BOX, final third = zone 4 + BOX, long gap > 90 s,
  Veo links open 8 s before the tag (tagging lag; user asked for 5–10 s).
- `report.py` reuses the staff dashboard's existing definitions (threat
  weights, recovery height, dangerous actions) so known numbers don't move.
- `clips.py` review-clip rules (categories, priorities, context bonuses) are
  a proposal the user delegated – keep them documented and pinned by tests.

## Architecture (5 layers, never mix them)

1. **Raw data** – tagger exports, untouched. `data/raw/` (versioned fixtures
   only), real season in `../laureats-tagger/exports/`.
2. **Validation** – `src/validation/` (incomplete, see known issues).
3. **Analytics engine** – `src/analytics/`: `possessions.py` (state machine
   rebuilding us/them possessions), `metrics.py` (match metrics),
   `classic.py` (the old staff dashboard formulas, verbatim), `phases.py`
   (possession-engine layer: splits, durations, progression, counter-press,
   defence, game time), `report.py` (composes classic + halves + French key
   points), `clips.py` (Veo moments worth
   reviewing, by cost/benefit and game context), `video.py` (Veo `#t=MM:SS`
   links with per-half kickoff offsets), `quality.py` (automatic tagging checks).
4. **Stable data API** – `src/api/app.py` (FastAPI). No football logic here.
5. **Frontend** – `dashboard/` (Vite + React + Tailwind + Recharts, port 3000,
   `/api` proxied to :8000). No football logic here either. French UI, tabs Aperçu / Possession / Attaque / Terrain / Clips Veo (addressable as `#clips` etc.);
   stats link into the clip library pre-filtered.
   Replaces the tagger project's per-match HTML dashboards. Design context for
   the impeccable skill lives in `PRODUCT.md` and `.impeccable/`; brand is
   gold `#c79741`, black, white. Logo goes in `dashboard/public/logo.png`.

Video / YOLO work sits **beside** the pipeline (`src/video/`, later on the
user's other computer) and only feeds in if it proves reliable. If it fails,
nothing in the main pipeline may break.

Build order (vertical slices, each working end to end): possessions ✅ →
metrics ✅ → API ✅ → dashboard ✅ → video clip links ✅ → season trends →
diagnosis engine → training priorities.

## Tagger data – facts that are easy to get wrong

- `timestamp_ms` is the tagger clock. **Half 2 starts at 45:00** (the
  half-time button jumps the clock), not 0. Old exports may reset to 0.
- `team`: `null` or `"us"` = our event, `"them"` = opponent (set pieces,
  cards, sometimes shots). RECUP/PERTE are always ours.
- `score_us` / `score_them` are the score **before** the event. Our goals are
  `BUT` events; **opponent goals are not tagged** – inferred when `score_them`
  goes up between two events.
- `zone`: 1 (own end) … 4 (attacking end) or `"BOX"`. Null = zone 4 by tagger
  convention, except our `DEGAGEMENT` (goal kick) = zone 1; other null-zone set
  pieces are unknown.
- `couloir`: left / center / right, on some actions only.
- **Stoppages** (`STOPPAGE_START` / `STOPPAGE_END`): the user toggles them only
  for **long set-up delays**, a few seconds after the whistle. Quick restarts
  (usually the opponent's) are deliberately not toggled and count as live
  time. Don't treat that as missing data.
- `match.kickoffTeam` (`"us"` / `"them"`) is read if present but the tagger
  doesn't record it yet → half starts are flagged as assumed.
- Schema 0.4 exports contain `BALLON2` (unknown meaning, ignored). Cards are
  ignored for possession.

## Commands

Run from this folder. Use `.venv/bin/python -m pip` (the venv was moved from
PycharmProjects, so `.venv/bin/pip` is broken).

```bash
.venv/bin/python -m pytest -q                      # all Python tests
node --test dashboard/tests                        # dashboard link/preset logic
.venv/bin/python -m src.analytics.possessions match_001 [--kickoff us]
.venv/bin/python -m src.analytics.metrics <match id | path.json> [--write]
FA_MATCH_DIR=/Users/mathi/Projects/laureats-tagger/exports .venv/bin/python -m uvicorn src.api.app:app --port 8000
npm --prefix dashboard run dev                     # http://localhost:3000
```

API: `/matches`, `/matches/{id}/summary|report|phases|clips|possessions|transitions|losses|quality`,
docs at `/docs`. A match id is the export file name without `.json`.

## Tests and fixtures

- `data/raw/laureats_2026-08-26_match_001_v1.json` – simulated match with
  known outcomes (20 possessions, 2–1).
- `tests/fixtures/champlain_15min.json` – real 15-min tagging with stoppages.
- New metric or definition → failing test first, on a fixture. Before calling
  anything done: run the tests **and** run it on the real exports
  (Montmorency 3–2 and Vanier 2026-09-26 are good checks; goal totals must
  match the final score).

## Related work (other sessions / projects)

- `../laureats-tagger/` – the tagger (HTML) and its own pipeline building
  `data/laureats.db`. Worked on in a separate session; don't edit it from
  here without asking.
- The user is building a Java online part, a self-hosted home server and a
  team website with an LLM connected to the database. This API is meant to
  feed all three.

## Known issues / todo

- `src/validation/validate.py` is incomplete and its docstring wrongly says
  timestamps reset each half; `event_codes.py` lacks cards and stoppage codes.
- `data/raw/*match_002*` (validation stress fixture) is missing.
- Duplicate export `laureats_2026-08-23_Vanier_v1 copy.json` in the tagger
  exports.
- Opponent shot sequences: not built until a tagged match contains opponent
  shots.

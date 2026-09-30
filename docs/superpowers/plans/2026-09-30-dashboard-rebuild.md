# Dashboard Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore every view of the old staff dashboard, add the possession-engine layer and a filterable clip library, in a five-tab dashboard.

**Architecture:** Old-dashboard definitions go in a new `src/analytics/classic.py`, the new engine layer in `src/analytics/phases.py`; `report.py` composes classic blocks, `clips.py` grows a faceted library. The API exposes `/report` (extended), `/phases` (new), `/clips` (extended). The React dashboard gets one file per tab under `dashboard/src/tabs/` and one component per view.

**Tech Stack:** Python 3.14, pytest, FastAPI; React 18, Vite 5, Tailwind 3, Recharts 2, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-30-dashboard-rebuild-design.md`

## Global Constraints

- Numbers shared with the old dashboard must equal it on Vanier 2026-09-26 (values in Task 1).
- Old definitions verbatim from `../laureats-tagger/pipeline/build_dashboard.py`; every new definition written in its module docstring.
- Durations = live time (stoppages excluded); possessions with an inexact start or end are excluded from duration stats but counted in `n`.
- No football logic in the frontend. French UI. Gold only for positives (DESIGN.md "Gold Means Good"); gold text on white uses `--gold-deep`.
- One y-axis per chart; every chart has a hover tooltip.
- Tests: `.venv/bin/python -m pytest -q`; build: `npm --prefix dashboard run build`.

## Review Focus

- A match with no Veo URL/offsets: clips and library must still list with `video_url: null` (Task 4 test).
- A match with a single half or no shots: phases/classic must return zeros/`None`, never raise (Task 2, 3 tests).
- A loss at the last event of a half (no following opponent possession end): counter-press counts it "not regained", not a crash (Task 3 test).
- Old exports (schema 0.4, `BALLON2`, no `team` field): classic metrics ignore unknown codes (Task 2 test with UdeS-like events).
- Filters that match zero clips: the library shows an empty-state line, not a blank area (Task 9).

---

### Task 1: Vanier reference fixture

**Files:**
- Create: `tests/fixtures/vanier_2026-09-26.json` (copy of `../laureats-tagger/exports/laureats_2026-09-26_Vanier_v1.json`)
- Test: `tests/test_classic.py`

- [ ] **Step 1:** copy the export to the fixture path; add a `vanier` pytest fixture in `tests/test_classic.py` loading it and `possessions_from_match`.
- [ ] **Step 2: Write the failing regression test** `test_vanier_matches_old_dashboard`:
```python
r = classic_report(vanier_match, vanier_possessions)
assert r["headline"]["balance"] == -6
assert r["headline"]["dangerous_actions"] == 23
assert r["headline"]["actions_per_shot"] == pytest.approx(2.875)
assert (r["headline"]["shots"], r["headline"]["shots_on_target"], r["headline"]["goals"]) == (8, 5, 2)
assert round(r["headline"]["field_tilt"] * 100) == 56
assert round(r["headline"]["high_recup_share"] * 100) == 33
assert round(r["headline"]["recovery_height"], 1) == 2.1
assert {z["zone"]: z["balance"] for z in r["zones"]} == {"1": 12, "2": 15, "3": -13, "4": -20, "BOX": 0}
t = r["transition_speed"]
assert (t["median_s"], t["n"], t["fast"], t["mid"], t["slow"]) == (7.9, 16, 4, 7, 5)
assert round(t["pct_leading"] * 100) == 28
assert (r["set_pieces"]["shots_from_set_piece"], r["set_pieces"]["goals_from_set_piece"]) == (1, 1)
assert r["attack_style"]["vertical_pct"] == 1.0
assert [h["actions"] for h in r["tempo"]] == [13, 10]
```
- [ ] **Step 3:** run `pytest tests/test_classic.py -q` → FAIL (`classic_report` not defined). Commit fixture + test together with Task 2.

### Task 2: `classic.py` – old dashboard definitions

**Files:**
- Create: `src/analytics/classic.py`
- Modify: `src/analytics/report.py` (import `DANGEROUS_CODES`, `THREAT_WEIGHTS`, `event_threat`, `RECOVERY_WEIGHTS`, `zones_report`, `attack_origins`, `threat_timeline`, `headline`, `set_pieces_report` from classic; `match_report` returns `**classic_report(...)` merged with its own keys; key points use the ≤20 s set-piece rule)
- Test: `tests/test_classic.py`, update `tests/test_report_clips.py` imports

**Interfaces:**
- Produces: `classic_report(match_data: dict, possessions: list[Possession]) -> dict` with keys:
  `headline` {recups, losses, balance, shots, shots_on_target, box_shots, goals, dangerous_actions, actions_per_shot, field_tilt, high_recups, high_recup_share, recovery_height},
  `zones` [{zone, recups, losses, balance, control}], `recovery_distribution` [{zone, n}],
  `actions_by_type` [{code, label, box, non_box}], `box_entries_by_type` [{code, label, n}],
  `attack_style` {vertical, lateral, vertical_pct, side_asymmetry},
  `transition_speed` {median_s, n, fast, mid, slow, pct_leading},
  `tempo` [{half, actions, shots, actions_per_shot, losses}],
  `funnel` [{stage, n}] stages "Actions dangereuses", "Entrées surface", "Tirs", "Cadrés", "Buts",
  `threat` (existing timeline shape + `cards` [{half, minute, team, code}]),
  `attack_origins` {couloir: {zone: n}}, `couloir_origins` [{couloir, share, by_type: {code: n}}],
  `actions_by_arrival_zone` [{zone, by_type: {code: n}}],
  `set_pieces` {counts, corner_asymmetry: {us, them}, shots_from_set_piece, goals_from_set_piece}.
- Constants (verbatim): `TRANSITION_CAP_MS = 60_000`, buckets `<5`, `5–15`, `≥15` s, `SET_PIECE_WINDOW_MS = 20_000`, field tilt = events with zone in {3, 4, "BOX"} / all events, vertical = PASSE_PROF+CONDUITE, lateral = SWITCH+CENTRE, side asymmetry = |L−R|/(L+R).

- [ ] **Step 1:** add unit tests: `test_transition_excludes_loss_between`, `test_transition_excludes_over_60s`, `test_transition_excludes_crossing_stoppage`, `test_set_piece_shot_window_20s` (corner at 0 s, shot at 19 s counts; at 21 s doesn't; PERTE between cancels), `test_field_tilt_counts_all_events`, `test_classic_ignores_unknown_codes` (BALLON2 events change nothing but `field_tilt` denominator), `test_classic_single_half_no_shots` (actions_per_shot None, funnel zeros).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement `classic.py` (move shared helpers out of `report.py`; `report.py` re-exports nothing new).
- [ ] **Step 4:** run full suite → PASS (Task 1 test included; existing report/API tests still green).
- [ ] **Step 5:** commit `feat: restore old dashboard definitions in classic.py`.

### Task 3: `phases.py` – possession-engine layer

**Files:**
- Create: `src/analytics/phases.py`
- Test: `tests/test_phases.py`

**Interfaces:**
- Consumes: `Possession` (possessions.py), `outcome`, `reached_box`, `live_between`, `possession_share` (metrics.py).
- Produces: `phases_report(match_data: dict, possessions) -> dict` with keys:
  `splits` {by_half: [{half, strict, inclusive}], by_period: [{half, label, strict, inclusive}], by_state: [{state, strict, n_us, n_them}]},
  `profile` {us|them: {n, n_timed, median_ms, max_ms, histogram: [{bin, n}]}, start_x_outcome: [{start, outcome, n}]},
  `progression` {start_zone_x_outcome: [{zone, outcome, n}], recovery_value: [{zone, n, box_rate, shot_rate, quick_loss_rate}]},
  `counter_press` {n_losses, n_timed, median_regain_ms, within_5s, within_10s, by_zone: [{zone, n, within_5s, within_10s, median_regain_ms}]},
  `defence` {median_opp_ms, histogram, ended_by_high_recup_share, ppda_lite},
  `finishing` {shots_per_possession, possessions_per_shot, shot_sequences_by_start: [{start, n, shot_seq}]},
  `game_time` {live_ms, dead_ms, actions_per_live_min}.
- Constants: `PERIOD_MIN = 15`; histogram bins `[(0,5),(5,10),(10,20),(20,40),(40,None)]` seconds with labels "0–5 s", "5–10 s", "10–20 s", "20–40 s", "40 s+"; states "menée" (<0), "égalité" (0), "en avance" (>0) from possession `score_us - score_them`; `REGAIN_FAST_MS = 5_000`, `REGAIN_MS = 10_000`.
- Counter-press algorithm: for each our possession with `end_type == "perte"` and `end_exact`, the next possession (same half) is theirs; regained if it `end_exact` and its `end_type in ("recup", "set_piece")`; regain time = its `live_ms`; otherwise "not regained" (counted in `n_losses`, excluded from `n_timed`/median, counted as failure in within_5s/10s).

- [ ] **Step 1: failing tests:** `test_splits_by_state` (score changes flip state), `test_period_bins_stoppage_time_in_last_bin` (event at 47:00 H1 → "30–45+"), `test_histogram_excludes_inferred`, `test_counter_press_regain_times` (losses regained after 3 s and 12 s → within_5s 0.5, within_10s 0.5, median 7.5 s), `test_counter_press_loss_at_half_end_not_regained`, `test_recovery_value_by_zone`, `test_game_time_dead_ms_from_stoppages` (Champlain fixture dead time = 48 s total), `test_phases_empty_match` (no events → zeros/None, no exception).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run → PASS.
- [ ] **Step 5:** commit `feat: possession-engine phases layer`.

### Task 4: clip library

**Files:**
- Modify: `src/analytics/clips.py`
- Test: `tests/test_report_clips.py`

**Interfaces:**
- Produces: `review_clips(match_data, possessions, veo) -> dict` now `{has_video, selection, categories, library}` where `library` is a flat list of clip dicts, each with existing fields plus `zone` (1–4/"BOX"/None), `state` ("menée"/"égalité"/"en avance"), `period` (label as in phases), `positive` (bool).
- New categories (label, base priority): `shot` ("Tous les tirs", 40), `box_entry` ("Entrées surface", 35), `high_recup` ("Récupérations hautes", 35), `quick_regain` ("Récupérations rapides après perte", 45, positive), `failed_press` ("Contre-pressing raté", 65), `long_buildup` ("Longues possessions", 30), `set_piece_us` ("Nos coups de pied arrêtés", 30), `set_piece_them` ("Coups de pied arrêtés adverses", 35). `SELECTION_SIZE = 20`. Existing categories unchanged.
- `failed_press`: our loss not regained within 10 s whose opponent possession contains their set piece or ends in `opp_goal`. `quick_regain`: regained ≤ 5 s (clip at the loss time). `long_buildup`: our possession `duration_ms >= 30_000` (clip at start).

- [ ] **Step 1: failing tests:** `test_library_has_facets` (every library clip has zone/state/period/positive keys), `test_library_without_video` (match_001 → all `video_url` None), `test_failed_press_and_quick_regain`, `test_long_buildup_threshold`, `test_selection_size_20`.
- [ ] **Step 2–4:** fail → implement → pass (reuse `phases` regain helper; export `regain_ms(ps, i) -> float | None` from phases.py for this).
- [ ] **Step 5:** commit `feat: faceted clip library`.

### Task 5: API

**Files:**
- Modify: `src/api/app.py`
- Test: `tests/test_api.py`

- [ ] **Step 1: failing tests:** `test_phases_endpoint` (keys `splits`, `profile`, `progression`, `counter_press`, `defence`, `finishing`, `game_time`), `test_report_has_classic_blocks` (keys `transition_speed`, `funnel`, `couloir_origins`, `recovery_distribution`, `tempo`), `test_clips_library_facets`.
- [ ] **Step 2–4:** add `GET /matches/{match_id}/phases` → `phases_report(match, ps)`; `/report` already merges classic via `match_report`. Run → PASS.
- [ ] **Step 5:** commit `feat: phases endpoint and extended report`.

### Task 6: dashboard shell + Aperçu

**Files:**
- Create: `dashboard/src/tabs/Apercu.jsx`, `dashboard/src/components/Momentum.jsx`, `dashboard/src/components/Summary.jsx`
- Modify: `dashboard/src/App.jsx` (5 tabs: apercu, possession, attaque, terrain, clips; band figures per tab; fetch `/phases`), `dashboard/src/api.js` (add phases), `dashboard/src/format.js` (labels for new categories, states, periods)

- [ ] **Step 1:** `Momentum.jsx` – one continuous x axis (minutes, halves separated by a gap tick "MT"), bars = threat per 5 min in ink, bins with our goal in gold-deep, goal markers above for both teams (gold = ours, grey = theirs), card markers (yellow/red squares with label) – Recharts ComposedChart + ReferenceDot; tooltip lists threat, goals, cards.
- [ ] **Step 2:** `Summary.jsx` – key points list (existing API) under a paragraph heading "Résumé".
- [ ] **Step 3:** `Apercu.jsx` layout: summary (1/3) | momentum (2/3); possession timeline full width; top 5 clips.
- [ ] **Step 4:** band figures: Aperçu = possession, tirs (cadrés·buts), bilan récup/perte, field tilt, récup hautes, actions/tir.
- [ ] **Step 5:** `npm --prefix dashboard run build` → "built"; commit `feat: five-tab shell and Aperçu with momentum`.

### Task 7: Possession & transitions tab

**Files:**
- Create: `dashboard/src/tabs/Possession.jsx`, `dashboard/src/components/{SplitBars,DurationHistogram,StartOutcomeMatrix,RecoveryValue,CounterPress,TransitionSpeed}.jsx`

- [ ] **Step 1:** `SplitBars` – possession % per half / period / state as horizontal 0–100 % bars with 50 % reference line (strict solid, inclusive as marker).
- [ ] **Step 2:** `DurationHistogram` – grouped bars us (ink) vs them (grey) over the 5 bins.
- [ ] **Step 3:** `StartOutcomeMatrix` – heat table start type × outcome (counts, one-hue grey ramp; goal/shot columns tinted gold).
- [ ] **Step 4:** `RecoveryValue` – per zone bars of box_rate and shot_rate (two series, legend) + quick_loss_rate column.
- [ ] **Step 5:** `CounterPress` – big figures (median regain, % ≤5 s, % ≤10 s) + by-zone table.
- [ ] **Step 6:** `TransitionSpeed` – old tile: median, % leading, contre/rapide/construit bars.
- [ ] **Step 7:** band: possession strict, médiane possession, récupéré ≤10 s, récup→action médiane, tirs par possession, temps effectif. Build → "built"; commit.

### Task 8: Attaque & finition + Terrain tabs

**Files:**
- Create: `dashboard/src/tabs/{Attaque,Terrain}.jsx`, `dashboard/src/components/{ShotFunnel,ActionsByType,BoxEntries,AttackStyle,TempoTable,ZoneControl,RecoveryDistribution,PitchBalance,PitchOrigins,CouloirOrigins,ArrivalZones}.jsx`
- Modify: keep `HalvesTable`, `OutcomeChart`, `SetPieces` (add corner asymmetry line), `CouloirTable`; remove `PitchZones.jsx`, `AttackOrigins.jsx` (replaced by pitch versions).

- [ ] **Step 1:** Attaque: funnel, actions by type (stacked box/non-box), box entries by type, attack style (vertical/lateral split bar + side asymmetry), tempo per half table, halves table, outcomes chart, set pieces. Band: actions dangereuses, actions/tir, entrées surface, séquences avec tir, % vertical, tirs dans la surface.
- [ ] **Step 2:** Terrain: `PitchBalance` (SVG vertical pitch with markings; each zone band shows balance number + récup/perte bars), `PitchOrigins` (SVG pitch, 3 couloir columns × zones, gold-deep ramp cells with counts, box nested in Z4), `CouloirOrigins` (stacked bars per couloir by action type with % labels), `ZoneControl` (bars 0–100 %), `RecoveryDistribution`, `ArrivalZones`, couloir value table. Band: field tilt, dernier tiers (temps), hauteur récup, zone la plus perdue, couloir principal, intensité du pressing.
- [ ] **Step 3:** build → "built"; commit `feat: attack and pitch tabs with restored views`.

### Task 9: Clips library tab

**Files:**
- Modify: `dashboard/src/components/ClipsView.jsx`
- Create: `dashboard/src/components/ClipFilters.jsx`

- [ ] **Step 1:** priority selection (20) on top; library below with filter row (category multi-select chips, half, zone, state, positive/negative, sort priority|time) – state kept in component, count shown ("34 clips").
- [ ] **Step 2:** empty result → "Aucun clip pour ces filtres." with a reset button.
- [ ] **Step 3:** keep tagging check section. Build → "built"; commit.

### Task 10: verification and finish

- [ ] **Step 1:** `.venv/bin/python -m pytest -q` → all pass.
- [ ] **Step 2:** run the app (`./run.sh`), CDP captures of the five tabs at 1440 and 390 into `.impeccable/review/` (script `scratchpad/capture.mjs` pattern: Chrome DevTools `Emulation.setDeviceMetricsOverride`).
- [ ] **Step 3:** `impeccable detect --json dashboard/src` → `[]`.
- [ ] **Step 4:** spawn `impeccable-finish-reviewer` with the direction contract, PRODUCT.md, DESIGN.md and captures; apply its fixes (max two rounds).
- [ ] **Step 5:** update `CLAUDE.md` (modules classic/phases, endpoints) and DESIGN.md via `impeccable-documenter` if components changed the system; commit.

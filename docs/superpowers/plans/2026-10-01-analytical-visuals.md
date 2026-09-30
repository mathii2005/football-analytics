# Analytical Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace bar/number views with analytical charts (match story, radar, bullets, pitch heatmaps, Sankey, regain curve, beeswarm, densities, slopegraph, butterfly) in a dense tile layout.

**Architecture:** New backend series in `timeline.py`, `season.py`, and additions to `phases.py` / `classic.py`; API gains `/matches/{id}/timeline` and `/season`. Frontend gets one component per chart under `dashboard/src/charts/`, tabs recomposed as tile grids.

**Tech Stack:** Python/pytest/FastAPI; React 18, Recharts 2 (Area/Line/Radar/Sankey/Funnel/Scatter), SVG for pitches.

**Spec:** `docs/superpowers/specs/2026-10-01-analytical-visuals-design.md`

## Global Constraints

- Colours: us `#b8862e`, them `#2a6aa8`, diverging mid `#e8e6e1`; chrome keeps black/white/`#c79741`.
- Pitch views at true resolution: 4 zone bands or 4 × 3 grid (+ box). No invented positions.
- Every chart: title phrased as its question, axis labels, tooltip, n where samples are small. Clickable views keep `openClips`.
- No football logic in the frontend (series come from the API).

## Review Focus

- Match with one half / no events: timeline and season must return empty lists, not raise.
- Season folder containing a non-export JSON or a single match: `/season` still returns (min = max = mean).
- Regain curve with zero losses: empty curve, component shows a no-data line.
- Old exports with half 2 clock at 0: timeline minutes still ordered (half + minute keys).
- Radar axis whose season max is 0: axis drawn at 0 without NaN.

---

### Task 1: timeline series
**Files:** Create `src/analytics/timeline.py`; Test `tests/test_timeline.py`.
**Produces:** `match_timeline(match_data, possessions) -> {minutes: [{half, minute, threat, threat_smooth, poss_share}], events: [{half, minute, kind, team, code}]}`; constants `SMOOTH_SIGMA_MIN = 2.5`, `POSS_WINDOW_MIN = 5`.
- [ ] Tests: `test_threat_per_minute` (TIR_C at 10:30 → minute 10 threat 4), `test_smoothing_preserves_total` (sum threat_smooth ≈ sum threat within 1 %), `test_poss_share_window` (us possession 0–10 min, them 10–20 → share at minute 5 = 1.0, at minute 15 = 0.0), `test_events_goals_cards_half` (our BUT, opp_goal possession end, card, half-time marker), `test_timeline_empty`.
- [ ] Implement; run; commit.

### Task 2: phases additions + transition deltas
**Files:** Modify `src/analytics/phases.py`, `src/analytics/classic.py`; Test `tests/test_phases.py`, `tests/test_classic.py`.
**Produces:** in `phases_report`: `regain_curve {t, overall, by_zone: {own, "3", "4"}, n: {overall, own, "3", "4"}}` (fraction not yet regained, 0–60 s), `durations {us: [ms], them: [ms]}`, `flow {nodes: [{name}], links: [{source, target, value}]}`; in `classic.transition_speed`: `deltas_s`.
- [ ] Tests: `test_regain_curve_steps` (regains at 3 s and 12 s of 2 losses → curve[0]=1.0, curve[3]=0.5, curve[12]=0.0), `test_regain_curve_not_regained_stays`, `test_regain_curve_empty`, `test_flow_links_sum_to_possessions`, `test_durations_lists_timed_only`, `test_transition_deltas_listed` (Vanier: len 16, median 7.9).
- [ ] Implement; run; commit.

### Task 3: season profile + endpoints
**Files:** Create `src/analytics/season.py`; Modify `src/api/app.py`; Test `tests/test_season.py`, `tests/test_api.py`.
**Produces:** `match_profile(match_data, possessions) -> dict` of radar/bullet metrics: `possession, field_tilt, high_recup_share, regain_10s, shots_per_possession, box_entries_per_possession, verticality, not_cheap_loss, shots, losses_opp_half_share`; `season_profile(paths) -> {matches: [{id, date, opponent, metrics}], summary: {metric: {mean, min, max}}}`. Endpoints `GET /season`, `GET /matches/{id}/timeline`.
- [ ] Tests: `test_match_profile_vanier` (possession ≈ 0.56, high_recup_share ≈ 0.33, verticality 1.0), `test_season_summary_min_max_mean`, `test_season_single_match`, `test_season_skips_non_exports`, API tests for both endpoints.
- [ ] Implement; run; commit.

### Task 4: chart kit + Aperçu (match story, radar, bullets)
**Files:** Create `dashboard/src/charts/{palette.js,Tile.jsx,MatchStory.jsx,TeamRadar.jsx,Bullets.jsx}`, `dashboard/src/tabs/Apercu.jsx` (rewrite); Modify `App.jsx` (fetch timeline + season; compact KPI strip), `api.js`.
- [ ] Tile = titled chart panel (question as title, n/note line, dense). MatchStory = two ComposedCharts sharing minute domain, ReferenceLines for events. TeamRadar = Recharts RadarChart (match vs season mean). Bullets = SVG rows. Build; commit.

### Task 5: Possession tab visuals
**Files:** Create `dashboard/src/charts/{FlowSankey,RegainCurve,TransitionSwarm,DurationDensity,RecoveryValuePitch,StateDots}.jsx`; rewrite `dashboard/src/tabs/Possession.jsx` (keep counter-press zone links, possession table).
- [ ] Build; commit.

### Task 6: Terrain + Attaque visuals
**Files:** Create `dashboard/src/charts/{CouloirPitch,ZoneGridPitch,BandPitch,HalvesSlope,Funnel,SetPieceButterfly,TypeStack}.jsx`; rewrite `tabs/Terrain.jsx`, `tabs/Attaque.jsx`; delete superseded components.
- [ ] Build; commit.

### Task 7: verification
- [ ] pytest + node tests + build; CDP captures 1440/390 of all tabs; read every capture against the real numbers; detector; `impeccable-finish-reviewer` once; final code review; update CLAUDE.md/DESIGN.md.

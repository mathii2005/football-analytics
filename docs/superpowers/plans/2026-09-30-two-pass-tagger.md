# Two-pass tagger v1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-file event tagger with a two-pass system — a live state tagger (who has the ball, where, restarts, shots) and a video review pass of closed-question cards — plus the engine path that turns both into possessions and proof metrics, each linked to its clips.

**Architecture:** One codebook (`shared/codebook.v1.json`) drives everything. The tagger is a Vite/React app in `tagger/` built into one offline HTML file; its pure logic lives in `tagger/src/core/` with `node --test`. The Python engine gets a v1 path (`normalize_match`) that derives the same timeline as the JS (golden fixtures in `shared/fixtures/` keep them equal), builds possessions from state, and feeds the existing engine through a legacy-event adapter so the current dashboard keeps working.

**Tech Stack:** Vite 5, React 18, Tailwind 3, vite-plugin-singlefile, idb (tagger); Python 3.14, FastAPI, pytest (engine); Node ≥ 22 built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-30-two-pass-tagger-design.md`

## Global Constraints

- UI copy is French. Code, identifiers and comments are English.
- Every key, op value, label, definition, threshold, card kind and question comes from `shared/codebook.v1.json`; no football constant is hard-coded in JS or Python outside it (Python may mirror constants in a module docstring, read from the codebook at import).
- Op values are uppercase (`US`, `THEM`, `DEAD`); timeline values are lowercase (`us`, `them`, `dead`, `unknown`) to match `possessions.US/THEM`.
- Live clock: half 1 starts at 0 ms, half 2 at 2 700 000 ms (45:00).
- The tagger build is ONE offline HTML file (`tagger/dist/index.html`): no CDN, no network calls.
- Schema 0.x exports go through the existing path unchanged; all existing tests (124 pytest, dashboard node tests) stay green.
- New runtime deps allowed: `idb`, `vite-plugin-singlefile` (tagger only). No new Python deps.
- Definitions marked [STAFF] in the spec are implemented exactly as written and listed in `CLAUDE.md` as awaiting staff sign-off.
- Commit after every task; message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Undo edge cases** — Backspace with no ops, undoing an `H` op, an undo of an undo: derive must ignore the undo of `H`/`U` ops and never crash (test in Task 2).
2. **Out-of-order and simultaneous ops** — corrections inserted mid-match, two state ops with the same `t`: derive sorts by (half, t, seq) and drops zero-length segments (Task 2).
3. **Shot or goal while DEAD (penalty, direct free kick)** — team = last live state before the whistle; a goal still closes the dead segment and opens DEAD + KICKOFF (Task 2).
4. **Storage unavailable** (private window, IndexedDB throws) — live tagging keeps every op in memory, shows the red save dot, export still works (Task 4).
5. **Same match exported twice** (pass 1 only, then after review; or 0.7 and 1.0) — season and API use the export with the latest `exported_at` (Task 10).

---

## File map

```
shared/
  codebook.v1.json                 # Task 1 – single source of truth
  fixtures/mini_half.export.json   # Task 1 – golden ops (a v1 export)
  fixtures/mini_half.timeline.json # Task 1 – expected derived timeline
  fixtures/mini_half.cards.json    # Task 1 – expected card queue ids
tagger/
  package.json, vite.config.js, tailwind.config.js, postcss.config.js, index.html
  src/core/codebook.js   derive.js  keymap.js  clock.js  exportV1.js
          cards.js  videoTime.js  calibration.js  corrections.js
  src/store/db.js
  src/live/LiveScreen.jsx  src/setup/SetupScreen.jsx  src/review/ReviewScreen.jsx
  src/App.jsx  src/main.jsx  src/index.css
  scripts/manual.mjs
  tests/*.test.js
src/analytics/states.py  calibration.py  proof.py
src/ingestion/v1.py  normalize.py
tests/test_states.py  test_v1_ingestion.py  test_proof.py
docs/tagging-manual-v1.md (generated)
```

---

### Task 1: Codebook and golden fixtures

**Files:**
- Create: `shared/codebook.v1.json`, `shared/fixtures/mini_half.export.json`, `shared/fixtures/mini_half.timeline.json`, `shared/fixtures/mini_half.cards.json`
- Test: `tests/test_codebook.py`

**Interfaces:**
- Produces: the codebook JSON below (exact keys) and three fixtures every later task tests against.

- [ ] **Step 1: Write the failing test** `tests/test_codebook.py`

```python
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "shared"

def load(p): return json.loads((ROOT / p).read_text())

def test_codebook_keys_cover_every_op():
    cb = load("codebook.v1.json")
    ops = {(v["k"], v["v"]) for v in cb["keys"].values()}
    assert ("S", "US") in ops and ("R", "PEN") in ops and ("Z", 5) in ops and ("U", None) in ops
    assert cb["keys"]["Shift+KeyD"] == {"k": "R", "v": "PEN"}

def test_every_op_has_a_french_label():
    cb = load("codebook.v1.json")
    for v in cb["keys"].values():
        key = v["k"] if v["v"] is None else f'{v["k"]}.{v["v"]}'
        assert key in cb["labels"], key

def test_cards_are_ordered_by_priority():
    cb = load("codebook.v1.json")
    assert [c["kind"] for c in cb["cards"]] == ["SHOT", "FLAG", "STALE", "ENTRY_US_BOX", "LOSS_OWN",
                                                 "ENTRY_US_Z4", "LOSS_OPP", "ENTRY_THEM"]

def test_fixture_is_a_v1_export():
    ex = load("fixtures/mini_half.export.json")
    assert ex["schema_version"] == "1.0" and len(ex["pass1"]["ops"]) == 23
```

- [ ] **Step 2: Run it** — `pytest tests/test_codebook.py -v` → FAIL (file not found).

- [ ] **Step 3: Create `shared/codebook.v1.json`** with exactly these top-level keys and values (labels/definitions are the spec's French copy):

```json
{
  "version": "1.0",
  "keys": {
    "KeyQ": {"k": "S", "v": "US"}, "KeyW": {"k": "S", "v": "THEM"}, "KeyE": {"k": "S", "v": "DEAD"},
    "KeyA": {"k": "R", "v": "THROW"}, "KeyS": {"k": "R", "v": "CORNER"}, "KeyD": {"k": "R", "v": "FK"},
    "Shift+KeyD": {"k": "R", "v": "PEN"}, "KeyF": {"k": "R", "v": "GK"},
    "KeyZ": {"k": "SH", "v": "OFF"}, "KeyX": {"k": "SH", "v": "ON"}, "KeyC": {"k": "SH", "v": "GOAL"},
    "Digit0": {"k": "Z", "v": 0}, "Digit1": {"k": "Z", "v": 1}, "Digit2": {"k": "Z", "v": 2},
    "Digit3": {"k": "Z", "v": 3}, "Digit4": {"k": "Z", "v": 4}, "Digit5": {"k": "Z", "v": 5},
    "Space": {"k": "F", "v": null}, "Backspace": {"k": "U", "v": null}
  },
  "labels": {
    "S.US": "Notre ballon", "S.THEM": "Leur ballon", "S.DEAD": "Ballon mort",
    "R.THROW": "Touche", "R.CORNER": "Corner", "R.FK": "Coup franc", "R.GK": "Dégagement (6 m)",
    "R.PEN": "Penalty", "R.KICKOFF": "Engagement",
    "SH.OFF": "Tir non cadré / contré", "SH.ON": "Tir cadré", "SH.GOAL": "But",
    "Z.0": "Notre surface", "Z.1": "Zone 1", "Z.2": "Zone 2", "Z.3": "Zone 3", "Z.4": "Zone 4", "Z.5": "Leur surface",
    "F": "À revoir", "U": "Annuler"
  },
  "definitions": {
    "S": "Appuyer quand un joueur contrôle le ballon — pas sur une déviation, pas au départ de la passe. Un 50/50 n'est tagué que lorsque quelqu'un le contrôle.",
    "Z": "Appuyer quand le ballon est contrôlé dans une nouvelle bande, dans les deux sens. Zone 1 = notre quart, zone 4 = leur quart.",
    "R": "Appuyer pendant le ballon mort, dès que la reprise est connue. La touche Q/W suivante dit qui la joue.",
    "SH": "Le tir appartient à l'équipe qui a le ballon. Contré = non cadré.",
    "F": "Je ne suis pas sûr : ce moment sera revu sur vidéo. Ne change rien d'autre."
  },
  "auto_zone": {"KICKOFF": {"US": 2, "THEM": 3}, "CORNER": {"US": 4, "THEM": 1},
                "GK": {"US": 0, "THEM": 5}, "PEN": {"US": 5, "THEM": 0}},
  "thresholds": {
    "stale_ms": 60000, "busy_window_ms": 15000, "busy_min_state_ops": 3,
    "default_lag_ms": 2000, "min_calibration_n": 5,
    "clip_before_ms": 8000, "clip_after_ms": 4000, "card_cost_s": 18, "review_budget_min": 30,
    "shot_ends_loss_ms": 5000, "proof_lead_ms": 5000, "regain_box_ms": 10000,
    "legacy_stoppage_min_ms": 10000, "correction_window_ms": 20000,
    "snapshot_every_ms": 300000, "snapshots_kept": 3, "presses_target_per_min": 12
  },
  "cards": [
    {"kind": "SHOT", "priority": 1, "questions": [{"id": "lane", "options": ["left", "center", "right"]},
                                                  {"id": "body", "options": ["FOOT", "HEAD"]}]},
    {"kind": "FLAG", "priority": 2, "mode": "correction", "questions": []},
    {"kind": "STALE", "priority": 3, "questions": [{"id": "check", "options": ["OK", "FIX", "UNKNOWN"]}]},
    {"kind": "ENTRY_US_BOX", "priority": 4, "questions": [{"id": "lane", "options": ["left", "center", "right"]},
      {"id": "how", "options": ["PASS", "THROUGH", "CARRY", "CROSS", "SECOND_BALL"]}]},
    {"kind": "LOSS_OWN", "priority": 5, "questions": [{"id": "cause", "options": ["PASS", "DUEL", "CONTROL", "OUT", "FOUL"]}]},
    {"kind": "ENTRY_US_Z4", "priority": 6, "questions": [{"id": "lane", "options": ["left", "center", "right"]},
      {"id": "how", "options": ["PASS", "THROUGH", "CARRY", "SECOND_BALL"]}]},
    {"kind": "LOSS_OPP", "priority": 7, "questions": [{"id": "cause", "options": ["PASS", "DUEL", "CONTROL", "OUT", "FOUL"]}]},
    {"kind": "ENTRY_THEM", "priority": 8, "questions": [{"id": "lane", "options": ["left", "center", "right"]}]}
  ],
  "option_labels": {
    "left": "Gauche", "center": "Centre", "right": "Droite", "FOOT": "Pied", "HEAD": "Tête",
    "OK": "État correct", "FIX": "Corriger", "UNKNOWN": "Inconnu",
    "PASS": "Passe", "THROUGH": "Passe en profondeur", "CARRY": "Conduite", "CROSS": "Centre",
    "SECOND_BALL": "Deuxième ballon", "DUEL": "Duel perdu", "CONTROL": "Contrôle raté",
    "OUT": "Sortie (notre faute)", "FOUL": "Faute commise"
  },
  "card_definitions": {
    "LOSS_OWN": "Pourquoi avons-nous perdu le ballon ? Passe = interceptée ou ratée. Duel = taclé, dribblé ou duel aérien perdu. Contrôle = ballon perdu seul.",
    "ENTRY_US_BOX": "Comment le ballon est-il entré dans leur surface ? Couloir = où le ballon entre.",
    "SHOT": "Couloir d'où part le tir ; surface de contact.",
    "STALE": "Plus de 60 s sans aucun tag : l'état affiché était-il correct pendant tout ce temps ?"
  }
}
```

(`card_definitions` must also contain `ENTRY_US_Z4`, `LOSS_OPP`, `ENTRY_THEM`, `FLAG` — reuse the matching sentence.)

- [ ] **Step 4: Create the golden fixtures.**

`mini_half.export.json`: a v1 export (spec §5) with `match.id = "m_fixture"`, `exported_at = "2026-10-04T20:00:00Z"`, `veoKickoffOffsetMs = 779000`, `veoKickoffOffsetMs2 = null`, `settings.zoneMode = "all"`, empty `pass2` (`answers: [], corrections: [], extras: []`) and these 23 ops (`half` = 1 for all):

| seq | t | k | v |  | seq | t | k | v |
|---|---|---|---|---|---|---|---|---|
| 1 | 0 | H | START | | 13 | 40000 | R | CORNER |
| 2 | 1000 | R | KICKOFF | | 14 | 45000 | S | THEM |
| 3 | 2000 | S | US | | 15 | 47000 | Z | 0 |
| 4 | 8000 | Z | 3 | | 16 | 48000 | SH | GOAL |
| 5 | 15000 | Z | 4 | | 17 | 70000 | S | US |
| 6 | 18000 | Z | 5 | | 18 | 80000 | Z | 3 |
| 7 | 20000 | SH | ON | | 19 | 81000 | F | null |
| 8 | 21000 | S | THEM | | 20 | 82000 | S | THEM |
| 9 | 30000 | Z | 3 | | 21 | 83000 | U | 20 |
| 10 | 31000 | Z | 2 | | 22 | 84000 | S | THEM |
| 11 | 32000 | Z | 1 | | 23 | 200000 | H | END |
| 12 | 33000 | S | DEAD | | | | | |

`mini_half.timeline.json` (the exact expected derivation):

```json
{
  "states": [
    {"half": 1, "from": 0, "to": 2000, "v": "dead", "restart": "KICKOFF", "taken_by": "us", "seq": 1},
    {"half": 1, "from": 2000, "to": 21000, "v": "us", "seq": 3},
    {"half": 1, "from": 21000, "to": 33000, "v": "them", "seq": 8},
    {"half": 1, "from": 33000, "to": 45000, "v": "dead", "restart": "CORNER", "taken_by": "them", "seq": 12},
    {"half": 1, "from": 45000, "to": 48000, "v": "them", "seq": 14},
    {"half": 1, "from": 48000, "to": 70000, "v": "dead", "restart": "KICKOFF", "taken_by": "us", "seq": 16},
    {"half": 1, "from": 70000, "to": 84000, "v": "us", "seq": 17},
    {"half": 1, "from": 84000, "to": 200000, "v": "them", "seq": 22}
  ],
  "zones": [
    {"half": 1, "from": 2000, "to": 8000, "v": 2, "seq": 3, "auto": true},
    {"half": 1, "from": 8000, "to": 15000, "v": 3, "seq": 4, "auto": false},
    {"half": 1, "from": 15000, "to": 18000, "v": 4, "seq": 5, "auto": false},
    {"half": 1, "from": 18000, "to": 30000, "v": 5, "seq": 6, "auto": false},
    {"half": 1, "from": 30000, "to": 31000, "v": 3, "seq": 9, "auto": false},
    {"half": 1, "from": 31000, "to": 32000, "v": 2, "seq": 10, "auto": false},
    {"half": 1, "from": 32000, "to": 47000, "v": 1, "seq": 11, "auto": false},
    {"half": 1, "from": 47000, "to": 70000, "v": 0, "seq": 15, "auto": false},
    {"half": 1, "from": 70000, "to": 80000, "v": 2, "seq": 17, "auto": true},
    {"half": 1, "from": 80000, "to": 200000, "v": 3, "seq": 18, "auto": false}
  ],
  "shots": [
    {"half": 1, "t": 20000, "team": "us", "v": "ON", "seq": 7},
    {"half": 1, "t": 48000, "team": "them", "v": "GOAL", "seq": 16}
  ],
  "flags": [{"half": 1, "t": 81000, "seq": 19}],
  "stale": [{"half": 1, "from": 84000, "to": 200000, "seq": 22}],
  "score": {"us": 0, "them": 1}
}
```

`mini_half.cards.json`: `["SHOT:7", "SHOT:16", "FLAG:19", "STALE:22", "ENTRY_US_BOX:6", "ENTRY_US_Z4:5", "LOSS_OPP:22", "ENTRY_THEM:11", "ENTRY_THEM:15"]`.

- [ ] **Step 5: Run** `pytest tests/test_codebook.py -v` → 4 PASS.
- [ ] **Step 6: Commit** `feat(shared): v1 codebook and golden fixtures`.

---

### Task 2: Tagger scaffold and timeline derivation (JS)

**Files:**
- Create: `tagger/package.json` (scripts `dev`, `build`, `test: node --test tests`), `tagger/vite.config.js` (react + `viteSingleFile()`, `server.fs.allow: [".."]`, port 3100), `tagger/index.html`, `tagger/tailwind.config.js`, `tagger/postcss.config.js`, `tagger/src/main.jsx`, `tagger/src/App.jsx` (placeholder), `tagger/src/index.css`
- Create: `tagger/src/core/codebook.js`, `tagger/src/core/derive.js`
- Test: `tagger/tests/derive.test.js`

**Interfaces:**
- Produces: `CODEBOOK` (default export of `codebook.js`, `import cb from "../../../shared/codebook.v1.json" with { type: "json" }`); `opLabel(op) -> string`.
- Produces: `deriveTimeline(ops: Op[]) -> Timeline` where `Op = {seq, t, half, k, v}` and `Timeline` has exactly the shape of `mini_half.timeline.json`.

- [ ] **Step 1: Write the failing tests** `tagger/tests/derive.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import ex from "../../shared/fixtures/mini_half.export.json" with { type: "json" };
import expected from "../../shared/fixtures/mini_half.timeline.json" with { type: "json" };
import { deriveTimeline } from "../src/core/derive.js";

const op = (seq, t, k, v, half = 1) => ({ seq, t, half, k, v });

test("golden fixture derives exactly", () => {
  assert.deepEqual(deriveTimeline(ex.pass1.ops), expected);
});

test("undo of nothing, of H and of U is ignored", () => {
  const ops = [op(1, 0, "U", 99), op(2, 0, "H", "START"), op(3, 10, "U", 2), op(4, 1000, "S", "US"),
               op(5, 2000, "U", 3), op(6, 5000, "H", "END")];
  const tl = deriveTimeline(ops);
  assert.deepEqual(tl.states.map((s) => [s.from, s.to, s.v]), [[0, 1000, "dead"], [1000, 5000, "us"]]);
});

test("ops are ordered by half, t, seq and zero-length segments dropped", () => {
  const ops = [op(1, 0, "H", "START"), op(2, 3000, "S", "THEM"), op(3, 1000, "S", "US"),
               op(4, 3000, "S", "US"), op(5, 9000, "H", "END")];
  const tl = deriveTimeline(ops);
  assert.deepEqual(tl.states.map((s) => [s.from, s.to, s.v]), [[0, 1000, "dead"], [1000, 9000, "us"]]);
});

test("goal while dead (penalty) belongs to the team that last had the ball", () => {
  const ops = [op(1, 0, "H", "START"), op(2, 1000, "S", "US"), op(3, 5000, "S", "DEAD"),
               op(4, 6000, "R", "PEN"), op(5, 9000, "SH", "GOAL"), op(6, 9500, "S", "THEM"),
               op(7, 20000, "S", "US"), op(8, 30000, "H", "END")];
  const tl = deriveTimeline(ops);
  assert.equal(tl.shots[0].team, "us");
  assert.deepEqual(tl.score, { us: 1, them: 0 });
  const pen = tl.states.find((s) => s.restart === "PEN");
  assert.deepEqual([pen.from, pen.to, pen.taken_by], [5000, 9000, "us"]);
  const kick = tl.states.find((s) => s.restart === "KICKOFF" && s.from === 9000);
  assert.deepEqual([kick.to, kick.taken_by], [9500, "them"]);
});```

- [ ] **Step 2: Run** `cd tagger && npm install && npm test` → FAIL (module not found).

- [ ] **Step 3: Implement `deriveTimeline(ops)`** in `tagger/src/core/derive.js`. Algorithm (rules from spec §3.2, in this order):
  1. Resolve undos by `seq`: a `U` op removes the op whose `seq` equals its `v` unless that op is `H` or `U` or already removed; `U` ops themselves are dropped.
  2. Sort remaining ops by `(half, t, seq)`.
  3. Per half, walk ops: `H START` opens a `dead` segment with `restart: "KICKOFF"`; `R` sets the pending restart of the current dead segment; `S` closes the current segment and opens a new one (an `S` equal to the current value is a no-op); when an `S` US/THEM closes a dead segment it sets `taken_by` and applies `auto_zone[restart][team]` at the same `t` (zone segment `auto: true`). A dead segment's `seq` is the op that opened it (`H`, `S DEAD`, or the goal `SH`).
  4. `SH`: team = current state if live; if dead, the last live state before it (a penalty or direct free kick is awarded to the team in possession). `GOAL` increments the score, closes the current segment at `t` (a dead segment closed by a goal gets `taken_by` = scoring team) and opens `dead` with `restart: "KICKOFF"`. Every dead segment's `taken_by` = the team of the `S` op that ends it.
  5. `Z` opens a zone segment unless equal to the current zone (merge); zone segments run until the next zone change or half `END`.
  6. `stale`: every live segment longer than `thresholds.stale_ms` with no `Z`, `SH` or `F` op strictly inside.
  7. Drop segments with `to <= from`, then merge adjacent live segments of the same team and adjacent zone segments of the same value (keep the first one's `seq`); dead segments are never merged (a goal from a penalty leaves PEN then KICKOFF). A half with no `H END` closes at its last op's `t`.

- [ ] **Step 4: Run** `npm test` → 4 PASS. Also `npm run build` → `dist/index.html` exists (one file).
- [ ] **Step 5: Commit** `feat(tagger): scaffold and timeline derivation pinned to golden fixture`.

---

### Task 3: Keymap and live clock

**Files:**
- Create: `tagger/src/core/keymap.js`, `tagger/src/core/clock.js`
- Test: `tagger/tests/keymap.test.js`

**Interfaces:**
- Produces: `keyToOp(e: {code, shiftKey}) -> {k, v} | null` (lookup `Shift+${code}` first when `shiftKey`, then `code`; unknown → `null`).
- Produces: `makeClock(now = () => performance.now())` → `{startHalf(half), stop(), t() -> ms | null, half}`; `startHalf(2)` makes `t()` start at 2 700 000.
- Produces: `pressesPerMinute(ops, nowT, windowMs = 300000) -> number` (counts every op except `H` in the window, per minute, one decimal).

- [ ] **Step 1: Failing tests**

```js
test("keys map through the codebook, shift first", () => {
  assert.deepEqual(keyToOp({ code: "KeyQ", shiftKey: false }), { k: "S", v: "US" });
  assert.deepEqual(keyToOp({ code: "KeyD", shiftKey: true }), { k: "R", v: "PEN" });
  assert.deepEqual(keyToOp({ code: "KeyD", shiftKey: false }), { k: "R", v: "FK" });
  assert.deepEqual(keyToOp({ code: "Digit5", shiftKey: false }), { k: "Z", v: 5 });
  assert.equal(keyToOp({ code: "KeyP", shiftKey: false }), null);
});
test("half 2 clock starts at 45:00", () => {
  let n = 1000; const c = makeClock(() => n);
  c.startHalf(2); n = 4000;
  assert.equal(c.t(), 2_703_000);
});
test("presses per minute over the last 5 minutes", () => {
  const ops = Array.from({ length: 30 }, (_, i) => ({ seq: i, t: i * 10000, half: 1, k: "S", v: "US" }));
  assert.equal(pressesPerMinute(ops, 300000), 6);
});
```

- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement. **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(tagger): keymap from codebook, live clock, presses-per-minute`.

---

### Task 4: Storage, export and the live screen

**Files:**
- Create: `tagger/src/store/db.js`, `tagger/src/core/exportV1.js`, `tagger/src/setup/SetupScreen.jsx`, `tagger/src/live/LiveScreen.jsx`; modify `tagger/src/App.jsx` (hash routes `#setup` default, `#live`, `#review`)
- Test: `tagger/tests/exportV1.test.js`, `tagger/tests/db.test.js`

**Interfaces:**
- Produces: `makeStore(backend)` → `{appendOp(matchId, op), ops(matchId), saveMatch(meta), match(id), snapshot(matchId), ok: boolean}`. `backend` is an object with async `get/set` (real one wraps `idb`; tests pass a fake). Every call catches backend errors: on failure `ok` becomes `false` and ops stay in an in-memory array that `ops()` still returns.
- Produces: `buildExport(meta, ops, pass2 = emptyPass2(), now = new Date()) -> object` (spec §5 shape, `schema_version: "1.0"`, `tagger_version: "two-pass@1.0.0"`) and `exportFileName(meta) -> "laureats_YYYY-MM-DD_<Opponent>_v1.json"` (opponent spaces → `-`).

- [ ] **Step 1: Failing tests**

```js
test("export has the v1 shape and file name", () => {
  const meta = { id: "m_1", opponent: "Bois de Boulogne", date: "2026-10-04", venue: "home",
                 veoUrl: "", veoKickoffOffsetMs: null, veoKickoffOffsetMs2: null, settings: { zoneMode: "all" } };
  const ex = buildExport(meta, [{ seq: 1, t: 0, half: 1, k: "H", v: "START" }], undefined, new Date("2026-10-04T20:00:00Z"));
  assert.equal(ex.schema_version, "1.0");
  assert.equal(ex.pass1.ops.length, 1);
  assert.deepEqual(ex.pass2, { answers: [], corrections: [], extras: [], minutes_spent: 0 });
  assert.equal(exportFileName(meta), "laureats_2026-10-04_Bois-de-Boulogne_v1.json");
});
test("a failing backend keeps ops in memory and flags the store", async () => {
  const broken = { get: async () => { throw new Error("no idb"); }, set: async () => { throw new Error("no idb"); } };
  const s = makeStore(broken);
  await s.appendOp("m_1", { seq: 1, t: 0, half: 1, k: "H", v: "START" });
  assert.equal(s.ok, false);
  assert.equal((await s.ops("m_1")).length, 1);
});
```

- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement `db.js`, `exportV1.js`.
- [ ] **Step 4: Build the screens.**
  - `SetupScreen`: opponent, date, venue, Veo URL, kickoff offsets (mm:ss per half, may be filled later), zone mode (all / forward). "Commencer" saves the match and goes to `#live`. Lists stored matches with "Reprendre", "Exporter", "Revoir (passe 2)".
  - `LiveScreen`: buttons "Début MT1", "Fin MT1", "Début MT2", "Fin du match" (emit `H` ops; MT2 calls `clock.startHalf(2)`); `keydown` listener → `keyToOp` → append op with next `seq`, current `t`, `half` (`U` gets `v` = seq of the last op not undone, not `H`); `preventDefault` on mapped keys. Display (spec §3.3): state banner (gold `#b8862e` US / blue `#2a6aa8` THEM / grey DEAD) with label from codebook, zone strip 0–5 with current highlighted, last 6 ops (labels), clock, score from `deriveTimeline`, presses/min (5 min and match) turning red above `presses_target_per_min`, red dot when `store.ok === false`. Snapshot every `snapshot_every_ms`. Export reminder banner after "Fin MT1" and "Fin du match"; export = download `buildExport` JSON.
- [ ] **Step 5: Verify in the browser pane.** Add `.claude/launch.json` config `tagger` (`npm --prefix tagger run dev`, port 3100). Setup a match, start half 1, press `Q 3 4 5 X W E S Q` → banner shows "Notre ballon" in gold after `Q`; after `S` then `Q` the zone strip shows 4 (auto corner); score 0–0; export downloads a file whose `pass1.ops` has 10 ops. Reload the page → ops are still there.
- [ ] **Step 6:** `npm test && npm run build` → PASS, one `dist/index.html`. **Commit** `feat(tagger): live screen, autosave with in-memory fallback, v1 export`.

---

### Task 5: Review card queue

**Files:**
- Create: `tagger/src/core/cards.js`
- Test: `tagger/tests/cards.test.js`

**Interfaces:**
- Consumes: `deriveTimeline`, `CODEBOOK`.
- Produces: `buildCards(timeline) -> Card[]` with `Card = {id: "KIND:seq", kind, priority, half, t, seq}` sorted by priority then `(half, t)`; `withinBudget(cards, budgetMin = thresholds.review_budget_min) -> Card[]` (keeps the first `floor(budgetMin*60 / card_cost_s)` cards).

Card rules (spec §4.2, pinned):
- `SHOT:seq` — every shot. `FLAG:seq` — every flag. `STALE:seq` — every stale segment (seq of the segment).
- Loss — every `us` live segment whose next live segment is `them` (directly, or after a dead segment with `taken_by: "them"`), unless a `us` shot falls in `[to - shot_ends_loss_ms, to]` or the segment ends at a goal or half end. `t` = segment `to`; `seq` = seq of the segment that follows; zone at `t` 0–2 → `LOSS_OWN`, 3–5 → `LOSS_OPP`.
- `ENTRY_US_BOX` — a non-auto zone change to 5 from ≤ 4 while state is `us`. `ENTRY_US_Z4` — non-auto change to 4 from ≤ 3 while `us`. `ENTRY_THEM` — non-auto change while `them` to 1 from ≥ 2, or to 0 from ≥ 1.

- [ ] **Step 1: Failing tests**

```js
import cardsExpected from "../../shared/fixtures/mini_half.cards.json" with { type: "json" };
test("golden card queue", () => {
  assert.deepEqual(buildCards(deriveTimeline(ex.pass1.ops)).map((c) => c.id), cardsExpected);
});
test("budget keeps the highest-priority cards", () => {
  const cards = buildCards(deriveTimeline(ex.pass1.ops));
  assert.deepEqual(withinBudget(cards, 0.9).map((c) => c.id), ["SHOT:7", "SHOT:16", "FLAG:19"]);
});
```

- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(tagger): review card queue with priorities and budget`.

---

### Task 6: Video time, calibration and corrections (JS)

**Files:**
- Create: `tagger/src/core/videoTime.js`, `tagger/src/core/calibration.js`, `tagger/src/core/corrections.js`
- Test: `tagger/tests/video.test.js`

**Interfaces:**
- Produces: `videoMs(meta, half, t) -> ms | null` — half 1: `k1 + t`; half 2: `k2 + (t − 2 700 000)` or, without `k2`, `k1 + t`; `null` when `k1` is null. `liveMs(meta, half, v)` is its inverse.
- Produces: `isBusy(ops, t) -> boolean` (≥ `busy_min_state_ops` `S` ops with `|op.t − t| ≤ busy_window_ms/2`); `lagStats(samples: {kind, busy, lag}[]) -> {"S|busy": {median, n}, ...}`; `correctT(t, kind, busy, stats) -> t − (n ≥ min_calibration_n ? median : default_lag_ms)`.
- Produces: `applyCorrections(ops, corrections) -> Op[]` — for each `{window: [a, b], half, ops}` removes non-`H` ops of that half with `a ≤ t ≤ b`, inserts the correction ops (their `seq` ≥ 100000), returns sorted by `(half, t, seq)`.

- [ ] **Step 1: Failing tests**

```js
const meta = { veoKickoffOffsetMs: 779000, veoKickoffOffsetMs2: 4213000 };
test("video position per half", () => {
  assert.equal(videoMs(meta, 1, 12000), 791000);
  assert.equal(videoMs(meta, 2, 2_760_000), 4_273_000);
  assert.equal(videoMs({ veoKickoffOffsetMs: 779000, veoKickoffOffsetMs2: null }, 2, 2_760_000), 3_539_000);
  assert.equal(videoMs({ veoKickoffOffsetMs: null }, 1, 1000), null);
  assert.equal(liveMs(meta, 2, 4_273_000), 2_760_000);
});
test("lag correction uses the group median only with enough samples", () => {
  const s = lagStats([1500, 2500, 3000, 3500, 4000].map((lag) => ({ kind: "S", busy: true, lag })));
  assert.deepEqual(s["S|busy"], { median: 3000, n: 5 });
  assert.equal(correctT(10000, "S", true, s), 7000);
  assert.equal(correctT(10000, "Z", false, s), 8000);
});
test("corrections replace the window", () => {
  const ops = applyCorrections(ex.pass1.ops, [{ window: [81000, 85000], half: 1,
    ops: [{ seq: 100000, t: 83500, half: 1, k: "S", v: "THEM" }] }]);
  const tl = deriveTimeline(ops);
  assert.equal(tl.states.at(-1).from, 83500);
  assert.equal(tl.flags.length, 0);
});
```

- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(tagger): video time mapping, lag calibration, corrections`.

---

### Task 7: Review screen (pass 2)

**Files:**
- Create: `tagger/src/review/ReviewScreen.jsx` (+ small components in `tagger/src/review/` as needed)
- Modify: `tagger/src/App.jsx`, `tagger/src/setup/SetupScreen.jsx` ("Importer un export" file input → store)

**Interfaces:**
- Consumes: `buildCards`, `withinBudget`, `videoMs`, `liveMs`, `applyCorrections`, `deriveTimeline`, `buildExport`, `CODEBOOK`.
- Produces: `pass2` filled per spec §5: answers `{card, op, a, snap_t?, at}` with `snap_t` in **live clock** ms (`liveMs` of the video time when Enter was pressed); corrections; extras (cards); `minutes_spent` (time the review screen was open).

- [ ] **Step 1: Build the screen.**
  - "Choisir la vidéo (MP4 Veo)" file input → `<video src={URL.createObjectURL(file)}>`. Without a file, each card shows a link `veoUrl#t=MM:SS` (position `videoMs − clip_before_ms`) and Enter (snap) is disabled.
  - Queue: `withinBudget(buildCards(deriveTimeline(applyCorrections(ops, corrections))), budget)`; budget input (min, default 30); header shows `n cards · ~X min` and progress.
  - Card view: plays `[t − clip_before_ms, t + clip_after_ms]` (video positions), shows the card definition and each question's options numbered 1–n (labels from `option_labels`); number keys answer the current question then advance to the next question; `Enter` snaps; `←/→` ±1 s, `,`/`.` ±0.2 s, `Space` play/pause, `N` next, `P` previous, `K` skip. Answered cards show a check; skipped ones stay unanswered.
  - FLAG cards and STALE answered `FIX` open correction mode: window `[t − correction_window_ms/2, t + correction_window_ms/2]` (STALE: the segment), lists pass-1 ops in it, and records live keys pressed on the video (`keyToOp`, `t = liveMs(video.currentTime)`) into a correction; "Valider" saves it to `pass2.corrections`.
  - STALE answered `UNKNOWN` is stored as an answer only (the engine turns the segment into `unknown`).
  - Buttons "Carton jaune" / "Carton rouge" + team toggle → `pass2.extras` at the current live time.
  - "Exporter" downloads `buildExport(meta, ops, pass2)`.
- [ ] **Step 2: Verify in the browser pane** with `shared/fixtures/mini_half.export.json` imported and any local MP4 (or none): queue shows 9 cards in the golden order; answering `LOSS_OPP:22` with key `1` records `{cause: "PASS"}`; export contains it. Without a video, each card shows a Veo link and Enter does nothing.
- [ ] **Step 3:** `npm test && npm run build` → PASS. **Commit** `feat(tagger): review screen with cards, snapping, corrections`.

---

### Task 8: Engine – timeline and possessions from state (Python)

**Files:**
- Create: `src/analytics/states.py`, `src/ingestion/v1.py`
- Test: `tests/test_states.py`

**Interfaces:**
- Produces: `states.derive_timeline(ops: list[dict]) -> dict` — same rules and output as the JS (Task 2).
- Produces: `states.possessions_from_timeline(timeline: dict, match_id: str, unknown: list[tuple[int, float, float]] = ()) -> list[Possession]` (existing `Possession` dataclass).
- Produces: `v1.is_v1(raw) -> bool` (`schema_version` starts with `"1."`); `v1.effective_ops(raw) -> list[dict]` (corrections applied, same rule as JS `applyCorrections`); `v1.unknown_spans(raw, timeline) -> list[tuple]` (stale segments whose STALE card answer is `UNKNOWN`).

Possession rules (docstring of `states.py`, [STAFF] where the spec says so):
- live segments become possessions; a `dead` segment between two segments of the same team is absorbed (`stoppage_ms` += its length, `stoppages` gets the span); `unknown` spans end possessions and are not possessions.
- `start_type`: `kickoff` (after a KICKOFF dead), `set_piece` (after another restart), `recup` (directly after the opponent), `inferred` (after unknown, `start_exact=False`).
- `end_type` for a `us` possession: `perte` (directly to them), `opp_set_piece` (via dead, taken by them), `goal` (we scored), `half_end`; for `them`: `recup`, `set_piece`, `opp_goal`, `half_end`.
- `start_zone`/`end_zone`: legacy zone of the zone segment at the boundary (5 → 4, 0 → 1); `score_us/score_them` at start; `events/codes/event_ids` filled later by the adapter (Task 9).

- [ ] **Step 1: Failing tests**

```python
FIX = Path(__file__).resolve().parents[1] / "shared" / "fixtures"

def test_python_derivation_matches_golden_fixture():
    ex = json.loads((FIX / "mini_half.export.json").read_text())
    assert derive_timeline(ex["pass1"]["ops"]) == json.loads((FIX / "mini_half.timeline.json").read_text())

def test_possessions_from_state():
    ex = json.loads((FIX / "mini_half.export.json").read_text())
    ps = possessions_from_timeline(derive_timeline(ex["pass1"]["ops"]), "m_fixture")
    assert [(p.team, p.start_ms, p.end_ms, p.start_type, p.end_type) for p in ps] == [
        ("us", 2000, 21000, "kickoff", "perte"),
        ("them", 21000, 48000, "recup", "opp_goal"),
        ("us", 70000, 84000, "kickoff", "perte"),
        ("them", 84000, 200000, "recup", "half_end")]
    assert ps[1].stoppage_ms == 12000 and ps[1].duration_ms == 15000
    assert all(p.start_exact and p.end_exact for p in ps)

def test_unknown_span_splits_and_flags():
    ex = json.loads((FIX / "mini_half.export.json").read_text())
    ps = possessions_from_timeline(derive_timeline(ex["pass1"]["ops"]), "m_fixture", unknown=[(1, 100000, 200000)])
    assert ps[-1].end_ms == 100000 and ps[-1].end_type == "inferred" and not ps[-1].end_exact
```

Plus port the three edge-case tests of Task 2 (undo, ordering, goal while dead) as `test_undo_edge_cases`, `test_ordering_and_zero_length`, `test_goal_while_dead`.

- [ ] **Step 2:** `pytest tests/test_states.py -v` → FAIL. **Step 3:** implement. **Step 4:** PASS, full `pytest` green.
- [ ] **Step 5: Commit** `feat(engine): v1 timeline and possessions from state, parity with JS`.

---

### Task 9: Engine – legacy adapter and single entry point

**Files:**
- Create: `src/ingestion/normalize.py`; extend `src/ingestion/v1.py`
- Modify: `src/api/app.py` (`_analyse` uses `normalize_match`), `src/analytics/season.py` (`season_profile` uses `normalize_match`)
- Test: `tests/test_v1_ingestion.py`

**Interfaces:**
- Produces: `v1.legacy_events(raw: dict, timeline: dict) -> list[dict]` — legacy-shaped events (`id, timestamp_ms, half, code, zone, is_box, couloir, team, score_us, score_them, score_state`) sorted by time:
  - `RECUP` at each `them→us` direct change, `PERTE` at each `us→them` direct change (zone = zone at `t`, 5 → zone 4 `is_box: true`, 0 → zone 1);
  - set pieces at the end of each dead segment whose restart is not KICKOFF: THROW→`TOUCHE`, CORNER→`CORNER`, FK→`COUP_FRANC`, GK→`DEGAGEMENT`, PEN→`PENALTY`; `team` = `None` for us, `"them"`;
  - shots: ON→`TIR_C`, OFF→`TIR_HC`, GOAL→`BUT`, same team convention;
  - each ENTRY_US_* card: answered `how` THROUGH/PASS→`PASSE_PROF`, CARRY→`CONDUITE`, CROSS→`CENTRE`, SECOND_BALL→`SEQUENCE`, unanswered→`SEQUENCE`; `couloir` = answered lane or `None`;
  - `STOPPAGE_START`/`STOPPAGE_END` around dead segments ≥ `legacy_stoppage_min_ms`;
  - `CARTON_JAUNE`/`CARTON_ROUGE` from `pass2.extras`.
- Produces: `normalize.normalize_match(raw: dict, match_id: str) -> tuple[dict, list[Possession]]` — 0.x: `(raw, possessions_from_match(raw, match_id))` unchanged. 1.x: `match = {**raw, "events": legacy_events(...), "v1": {"timeline", "answers", "settings", "unknown"}}` and possessions from Task 8 with `events/codes/event_ids` filled from the legacy events inside each possession.

- [ ] **Step 1: Failing tests**

```python
def test_legacy_events_from_fixture():
    raw = load_fixture()
    m, ps = normalize_match(raw, "mini")
    codes = [e["code"] for e in m["events"]]
    assert codes.count("PERTE") == 2 and codes.count("RECUP") == 0   # both our possessions start from kickoffs
    assert "CORNER" in codes and "TIR_C" in codes and "BUT" in codes
    box = [e for e in m["events"] if e["code"] == "SEQUENCE"]
    assert [(e["timestamp_ms"], e["zone"], e["is_box"]) for e in box] == [(15000, 4, False), (18000, 4, True)]

def test_v0_path_is_untouched():
    raw = json.loads(Path("tests/fixtures/vanier_2026-09-26.json").read_text())
    m, ps = normalize_match(raw, "vanier")
    assert m is raw and ps == possessions_from_match(raw, "vanier")

def test_classic_report_runs_on_v1():
    m, ps = normalize_match(load_fixture(), "mini")
    assert classic_report(m, ps)["headline"]["shots"] == 1
```

- [ ] **Step 2–4:** FAIL → implement → PASS; full `pytest` green (existing API tests prove 0.x unchanged).
- [ ] **Step 5: Commit** `feat(engine): normalize_match entry point and v1 legacy adapter`.

---

### Task 10: Engine – proof metrics, calibration, API, season

**Files:**
- Create: `src/analytics/calibration.py`, `src/analytics/proof.py`
- Modify: `src/api/app.py` (`GET /matches/{id}/proof`), `src/analytics/season.py`
- Test: `tests/test_proof.py`

**Interfaces:**
- Produces: `calibration.lag_stats(ops, answers, cards) -> dict` and `calibration.correct_t(t, kind, busy, stats) -> float` (same rules as JS Task 6; `kind` of an op = `S`, `Z` or `SH`).
- Produces: `proof.proof_report(match: dict, possessions) -> dict` — `{"available": False}` for 0.x; for 1.x each metric is `{"value", "n", "clips": [{"half", "t", "url"}]}` where `t` = calibrated time and `url` = Veo link opening `proof_lead_ms` before it (`video.video_ms`). Keys: `possession` (us share of live us+them time, 4 decimals), `dead_ms_by_restart`, `unknown_ms`, `field_tilt_v1` (US time in zones 4–5 ÷ (that + THEM time in 0–1); `None` when `zoneMode == "forward"`), `field_tilt_classic`, `entries` (`us_z4`, `us_box`, `them_final`, `them_box`), `box_after_regain` (our box entries ≤ `regain_box_ms` after a `recup` start), `shots_per_box_entry`, `possessions_reaching_z4`, `losses_by_cause` (with `non_revu`), `entries_by_lane_type`, `calibration` (the stats), `reviewed` (`answered`/`total` cards).
- Produces: `GET /matches/{id}/proof`. Season: per `match.id` keep the export with the latest `exported_at`; each entry gets `schema` (`"0"`/`"1"`); `summary` averages only matches with the schema of the most recent match; add `summary_by_schema`.

- [ ] **Step 1: Failing tests**

```python
def test_proof_on_fixture():
    m, ps = normalize_match(load_fixture(), "mini")
    r = proof_report(m, ps)
    assert r["possession"]["value"] == 0.2012
    assert r["dead_ms_by_restart"] == {"KICKOFF": 24000, "CORNER": 12000}
    assert r["field_tilt_v1"]["value"] == 0.6
    assert {k: v["value"] for k, v in r["entries"].items()} == {"us_z4": 1, "us_box": 1, "them_final": 1, "them_box": 1}
    assert r["box_after_regain"]["value"] == 0
    assert r["shots_per_box_entry"]["value"] == 1.0
    assert r["possessions_reaching_z4"]["value"] == 0.5
    assert r["losses_by_cause"]["value"] == {"non_revu": 1}
    assert r["entries"]["us_box"]["clips"][0]["t"] == 16000   # 18000 − default lag 2000

def test_proof_unavailable_for_v0():
    raw = json.loads(Path("tests/fixtures/vanier_2026-09-26.json").read_text())
    assert proof_report(*normalize_match(raw, "v")) == {"available": False}

def test_season_keeps_latest_export_of_a_match():
    a = load_fixture(); b = {**load_fixture(), "exported_at": "2099-01-01T00:00:00Z"}
    b["pass2"] = {**b["pass2"], "answers": [{"card": "LOSS_OPP:22", "op": 22, "a": {"cause": "PASS"}, "at": "x"}]}
    s = season_from([("a", *normalize_match(a, "a")), ("b", *normalize_match(b, "b"))])
    assert [m["id"] for m in s["matches"]] == ["b"] and s["matches"][0]["ids"] == ["a", "b"]
```

Plus an API test in `tests/test_api.py`: `/matches/{id}/proof` returns 200 with `available: False` for the existing 0.x fixture.

- [ ] **Step 2–4:** FAIL → implement → PASS; full `pytest` green.
- [ ] **Step 5: Commit** `feat(engine): proof metrics with clips, lag calibration, /proof endpoint, season latest-export rule`.

---

### Task 11: Dashboard – "Faits vérifiés" panel

**Files:**
- Create: `dashboard/src/components/ProofPanel.jsx`
- Modify: `dashboard/src/api.js` (`fetchProof(id)`), `dashboard/src/tabs/Apercu.jsx` (panel first when `available`)
- Test: `dashboard/tests/proof.test.js` for a pure `proofRows(report) -> [{label, value, n, clips}]` in `dashboard/src/proof.js`

**Interfaces:**
- Consumes: `/matches/{id}/proof`.
- Produces: `proofRows(report)` — French labels, values formatted (`%` for shares, `s` for times), rows omitted when `value` is `null`; the tilt row shows "Field tilt (temps)" and "Field tilt (classique)" side by side.

- [ ] **Step 1: Failing test**

```js
test("proof rows skip nulls and keep clips", () => {
  const rows = proofRows({ available: true, possession: { value: 0.2012, n: 4, clips: [] },
    field_tilt_v1: { value: null, n: 0, clips: [] }, entries: { us_box: { value: 1, n: 1, clips: [{ half: 1, t: 16000, url: "u" }] } } });
  assert.deepEqual(rows.map((r) => r.label), ["Possession", "Entrées dans leur surface"]);
  assert.equal(rows[0].value, "20 %");
  assert.equal(rows[1].clips[0].url, "u");
});
```

- [ ] **Step 2–4:** FAIL → implement → PASS (`node --test dashboard/tests`).
- [ ] **Step 5: Build the panel.** Tile titled "Faits vérifiés" (DESIGN.md tokens): one row per `proofRows` entry; each value is a button opening a list of Veo links (`clips`); a muted line "x / y cartes revues · temps inconnu : n s". Verify in the browser pane on an exported v1 match placed in `FA_MATCH_DIR`; 0.x matches show no panel.
- [ ] **Step 6:** `npm --prefix dashboard run build` → OK. **Commit** `feat(dashboard): verified-facts panel with clip links`.

---

### Task 12: Tagging manual, docs, pilot kit

**Files:**
- Create: `tagger/scripts/manual.mjs`, `docs/tagging-manual-v1.md` (generated), `tagger/tests/manual.test.js`
- Modify: `CLAUDE.md` (v1 architecture, entry point `normalize_match`, codebook rule, [STAFF] list), `run.sh` (option to start the tagger dev server)

**Interfaces:**
- Produces: `renderManual(codebook) -> string` (French Markdown: keyboard table from `keys`+`labels`, each `definitions` entry, auto-zones, the card list with questions and `card_definitions`, thresholds in plain words, the pilot protocol and staff sign-off list from spec §9). `node tagger/scripts/manual.mjs > docs/tagging-manual-v1.md`.

- [ ] **Step 1: Failing test**

```js
test("the manual lists every key and every card", () => {
  const md = renderManual(CODEBOOK);
  for (const code of Object.keys(CODEBOOK.keys)) assert.ok(md.includes(code.replace("Key", "").replace("Digit", "")), code);
  for (const c of CODEBOOK.cards) assert.ok(md.includes(c.kind), c.kind);
  assert.ok(md.includes("12 appuis par minute"));
});
```

- [ ] **Step 2–4:** FAIL → implement → PASS; generate the manual.
- [ ] **Step 5:** Full verification: `pytest` green, `npm --prefix tagger test` green, `node --test dashboard/tests` green, both builds OK.
- [ ] **Step 6: Commit** `docs: v1 tagging manual generated from the codebook, CLAUDE.md v1 architecture`.

---

## After the build (user, not code)

1. Check that the club's Veo plan allows MP4 download (spec §4.1).
2. Run the pilot (spec §9) on one already-tagged half; read presses/min; time the review.
3. Get staff sign-off on the [STAFF] list; any change is a codebook edit + fixture update.

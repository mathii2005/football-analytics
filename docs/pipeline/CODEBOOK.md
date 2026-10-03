# Lauréats codebook — v1.0.0

> The single source of truth for **what is tagged, how it is defined, and how every number is computed**.
> The machine-readable copy is `shared/codebook.v1.json`. It must say exactly what this file says, and a test checks that the two agree.
> Companion document: [`PIPELINE.md`](PIPELINE.md) (the whole process, from match day to the dashboard).
>
> Status: v1.0.0. All definitions confirmed by the analyst on behalf of the staff on 2026-10-02. Any change goes through the versioning rules in §0.

---

## 0. How to read and change this codebook

- **Version** uses semver, `MAJOR.MINOR.PATCH`.
  - **PATCH**: wording or a typo. No data meaning changes.
  - **MINOR**: adds a key, card, question, answer value or metric. Old matches stay valid; the new fields read "not tagged" on them, never zero.
  - **MAJOR**: changes the meaning of anything that already exists (a definition, a threshold, a band boundary). This starts a new series: matches tagged under different MAJOR versions are never pooled without the mapping in §9, and every match is recomputed from its untouched log.
- **Every match file stores the codebook version it was tagged with** (`meta.codebook_version`), plus the SHA-256 of the JSON codebook (`meta.codebook_sha256`).
- **Changing a definition** means changing this file, the JSON, the engine test that pins it, and the changelog (§12), in that order. Then announce it.
- **Language.** Keys, codes and identifiers are English and UPPER_SNAKE. Labels shown in the interface are French.

---

## 1. Pitch geometry (applies to both teams)

All locations are **absolute** and seen from **our** attacking direction. "Band 5" is always *their* box, whichever team has the ball.

### 1.1 Bands (length)

| Band | Name (FR) | Where | How to judge it live |
|---|---|---|---|
| 0 | Notre surface | Inside our penalty area | Marked: the 18-yard box |
| 1 | Zone 1 | Our goal line → quarter line, outside our box | The quarter line is **not marked**: judge it as halfway between our goal line and the halfway line (about 26 m) |
| 2 | Zone 2 | Quarter line → halfway line | Halfway line is marked |
| 3 | Zone 3 | Halfway line → their quarter line | Same rule as band 1 |
| 4 | Zone 4 (zone rouge, outside the box) | Their quarter line → their goal line, **outside** their box, including the wide areas beside the box | |
| 5 | Leur surface (end zone) | Inside their penalty area | Marked |

- **Red zone** = bands 4 ∪ 5. **End zone** = band 5.
- On a standard 105 × 68 m pitch:
  - Band 1: x = 0–26.25 m, excluding our box.
  - Band 2: x = 26.25–52.5 m.
  - Band 3: x = 52.5–78.75 m.
  - Band 4: x = 78.75–105 m, excluding their box.
  - Box: 16.5 m deep, 40.32 m wide, centred.

### 1.2 Lanes (width), used in the review only, never live

Lanes are defined **by the pitch markings, extended along the whole length of the pitch**, so they can be judged on Veo footage.

| Lane | Code | Where | Width on a 68 m pitch |
|---|---|---|---|
| Left wide | `L` | Between the left touchline and the left side of the 18-yard box (extended) | 13.84 m |
| Left half-space (couloir intérieur gauche) | `HS_L` | Between the left side of the 18-yard box and the left side of the 6-yard box (extended) | 11.00 m |
| Centre | `C` | Between the two sides of the 6-yard box (extended) | 18.32 m |
| Right half-space | `HS_R` | Mirror of `HS_L` | 11.00 m |
| Right wide | `R` | Mirror of `L` | 13.84 m |

- Left and right are **from our attacking direction**, whichever team has the ball.
- If the lane can't be judged, the answer is `CANT_SEE`.

### 1.3 Grid used by xT

6 bands × 5 lanes = 30 cells. Bands 0 and 5 are only 40.32 m wide, so in those bands the lanes `L` and `R` don't exist. Those cells are merged into the neighbouring `HS` lane, which leaves 26 valid cells.

---

## 2. Teams, time and the clock

- **Team values:** `US` (Lauréats) and `THEM` (the opponent).
- **Live clock `t`** is in milliseconds. Half 1 starts at 0; half 2 starts at 2 700 000 (45:00) when `M` is pressed, whatever the real stoppage time was.
- **The clock is a manual stopwatch.**
  - Space starts and pauses it.
  - `[` / `]` move it by −10 s / +10 s; `{` / `}` move it by −1 min / +1 min.
  - Every pause, resume and nudge is written to the log, so it can be audited.
- **Rule:** pause only when the match clock really stops (before kick-off, at half time). Pausing during play shifts every later timestamp. That drift is caught by the Veo check (PIPELINE §5, step W5).
- **Veo position of a moment:**
  - Half 1: `veo_ms = veo_offset_h1 + t`.
  - Half 2: `veo_ms = veo_offset_h2 + (t − 2 700 000)`.
  - With no half-2 offset: `veo_offset_h1 + t` (continuous footage).
  - The offset is the Veo time of each half's kick-off. It is entered at setup or later, and can always be edited.
- **Clip link** = `veoUrl#t=MM:SS`, at `veo_ms − 5 000` (5 s lead), minutes allowed above 59.

---

## 3. Live keys (pass 1)

Target load: **9–10 presses/min, cap 12**. A 15-minute block above 14/min is marked low-fidelity (see §10).

### 3.1 Match keys

| Key | Code | FR label | Definition | ≈/min |
|---|---|---|---|---|
| `Q` | `S:US` | Notre ballon | A Lauréats player **gains control** of the ball (a regain, or the first touch after our restart). Not on a deflection, not when a pass is played. A 50/50 is only pressed once someone controls it. | 1.8 |
| `W` | `S:THEM` | Leur ballon | The opponent gains control. Same anchor. | 1.8 |
| `E` | `S:DEAD` | Ballon mort | Ball out of play, or the whistle. | 1.0 |
| `0`–`5` | `Z:n` | Zone 0–5 | Band of the ball (§1.1). Press it **with every change of possession** and **every time the ball is controlled in a new band** (in both directions). Not while the ball is in flight. | 3.5 |
| `A` | `R:THROW` | Touche | Throw-in. Pressed while the ball is dead, as soon as the restart is known; **then press (or click) the band where it is taken**. | |
| `S` | `R:CORNER` | Corner | | |
| `D` | `R:FK` | Coup franc | Free kick, **including offside** (indirect free kick to the defending team at the spot of the offence). Then press (or click) the band where it is taken. | |
| `F` | `R:GK` | Dégagement (6 m) | Goal kick | 1.0 total |
| `Shift+D` | `R:PEN` | Penalty | | |
| `Z` | `SH:OFF` | Tir non cadré / contré | Shot that misses or is blocked. It belongs to the team with the ball. | |
| `X` | `SH:ON` | Tir cadré | On target and not a goal (saved, or hits the woodwork and is saved). | |
| `C` | `SH:GOAL` | But | Goal. Updates the score automatically. | 0.3 total |
| `R` | `F` | À revoir | "Look at this on video": a chance without a shot, a key duel, an error, a set-piece routine, or a doubt. | 0.3 |
| `T` | `LOST` | J'ai perdu le fil | Opens an **untrusted window** (pressed again, or the next `Q`/`W`/`E`, closes it). The engine leaves that window out until the gap card resolves it. | <0.1 |

**Restart team** = the team of the next `Q` / `W` press.

**Band of the restart.** For throw-ins and free kicks, the tagger asks for the band right after the restart key (« Zone de la touche ? » / « Zone du coup franc ? », the pitch view pulses). Press the digit or click the band. Taking the restart without it is accepted but flagged. Corners, goal kicks, penalties and kick-offs use the automatic bands below.

**Clicking the pitch.** Every band can also be set by clicking it on the pitch view. A click is always the real (absolute) band: with Inverser on, the drawing is mirrored so you click what you see.

**Automatic bands** (save presses; written as `auto: true`):

| Restart | Taken by US | Taken by THEM |
|---|---|---|
| Kick-off | 2 | 3 |
| Corner | 4 | 1 |
| Goal kick | 0 | 5 |
| Penalty | 5 | 0 |

### 3.2 Comfort keys (carried over from the old tagger)

| Key | Action | Written to the log as |
|---|---|---|
| `Space` | Start / pause the clock | `CLOCK:START` / `CLOCK:PAUSE` |
| `[` `]` | Clock −10 s / +10 s (also buttons −10s/+10s) | `CLOCK:NUDGE` with `v = ±10000` |
| `{` `}` | Clock −1 min / +1 min (also buttons −1m/+1m) | `CLOCK:NUDGE` with `v = ±60000` |
| `M` | Half time: pause, switch to MT2, clock jumps to 45:00 | `H:END` (h1), then `H:START` (h2) at the next Space |
| `+` / `=` | Our score +1 (manual correction) | `SCORE:US+1` |
| `-` | Our score −1 | `SCORE:US-1` |
| `*` / `)` | Their score +1 | `SCORE:THEM+1` |
| `_` | Their score −1 | `SCORE:THEM-1` |
| `Backspace` or `Ctrl/Cmd+Z` | Cancel the last match press (never deletes anything: it adds a retraction) | `U` with `v = seq` of the press cancelled |
| `Ctrl/Cmd+S` | Export the match file now | — |
| `?` | Help overlay listing all keys and definitions | — |
| `Esc` | Close the overlay | — |
| Button **Inverser** | Flip: from MT2, the analyst presses bands as seen on screen and the tagger stores the **absolute** band (`n → 5 − n`). The tagger offers it automatically at `M`. | `FLIP:ON/OFF` |
| Button **Fin du match** | End of match + forced export | `H:END` (h2) |

Score keys only correct the displayed score. Goals for the engine come from `C` presses and are checked against the corrected score (integrity gate G2).

### 3.3 Things that are deliberately not live keys (and where they come from instead)

| Information | Source |
|---|---|
| Regain / loss | Derived from `Q` / `W` switches (§6.2) |
| Box entry, red-zone entry | Derived from band presses (§6.4) |
| Lane, half-space, between the lines | Review cards (§5) |
| Body part, assist, shot location | Shot card |
| Duels, players closing down | Review cards |
| Cards (yellow/red) | Button in the review (`EXTRA:CARD`), never moves possession |

**Possible later addition:** an `H` key (half-space reception), see PIPELINE §13. Only trialled if presses stay under 10/min for 3 matches. It is kept only if it agrees with the entry cards ≥ 80 % of the time.

---

## 4. Live log format (`events.jsonl`)

One JSON object per line. The file is **only ever appended to**: nothing is edited or deleted.

```json
{"seq": 57, "t": 1834200, "half": 1, "k": "Z", "v": 4, "auto": false, "wall": "2026-10-04T19:31:02.118Z", "cb": "1.0.0"}
```

| Field | Meaning |
|---|---|
| `seq` | Increasing integer, unique within the match |
| `t` | Live clock in ms (§2) |
| `half` | 1 or 2 |
| `k` | Kind: `S`, `Z`, `R`, `SH`, `F`, `LOST`, `U`, `H`, `CLOCK`, `SCORE`, `FLIP`, `PATCH` |
| `v` | Value (see §3) |
| `auto` | `true` when the tagger produced it (automatic band) |
| `wall` | Wall-clock time (for audits) |
| `cb` | Codebook version |

- **Retraction:** `{"k": "U", "v": 57}` cancels press 57. A `U` targeting an `H`, `U` or `CLOCK` press is ignored.
- **Patch (correction from the review):** `{"k": "PATCH", "v": {"replace": [a, b], "half": 1, "ops": [...]}}`. Between live times `a` and `b`, the listed ops replace the match ops of that half (`S`, `Z`, `R`, `SH`). The original presses stay in the file.
- **Ordering for the engine:**
  1. Resolve retractions.
  2. Apply patches.
  3. Sort by `(half, t, seq)`.

---

## 5. Review cards (pass 2, "the quiz")

- **Generation:** the engine reads the live log and produces one card per moment matching a trigger. Each card carries the `seq` of the press it came from (the join key).
- **Viewing:** each card opens Veo at `veo_ms − 5 000`.
- **Answering:**
  - Number keys `1`–`9` pick an answer; `0` = `CANT_SEE`.
  - `Enter` = next card; `←` = previous card; `K` = skip.
  - `V` = "move this moment" (a correction, see PIPELINE §4.6).
- **Defaults:** every question has `CANT_SEE`. An unanswered card stays `UNREVIEWED`, which is different from `CANT_SEE`.
- **Time budget:** 60 min hard stop, in three tiers.

### 5.1 Tier 1 — mandatory (first 30 min)

| Card | Trigger | Questions → values |
|---|---|---|
| **SHOT** (Tir) | every `SH` press, both teams | **loc**: `SIX` (6-yard box) / `CENTRAL_BOX` (in the box, lanes HS_L–C–HS_R, outside the 6-yard box) / `WIDE_BOX` (in the box, outside the 18-yard box's inner lanes) / `CENTRAL_OUT` (outside the box, lanes HS_L–C–HS_R) / `WIDE_OUT` · **body**: `FOOT` / `HEAD` / `OTHER` · **situation**: `OPEN` / `FAST_BREAK` (≤ 10 s after a regain) / `SET_PIECE` / `PENALTY` · **assist**: `THROUGH` / `CUTBACK` / `CROSS` / `HS_PASS` / `SET_PIECE_DELIVERY` / `REBOUND` / `SOLO` · **last_pass_lane**: `L` / `HS_L` / `C` / `HS_R` / `R` |
| **GOAL** (But) | every `SH:GOAL` press, both teams | Every SHOT question, plus **phase_check**: `TRANSITION` / `BUILD_UP` / `SETTLED` / `SET_PIECE` / `PENALTY` (a check against the computed phase) · **box_lane** (lane where the ball entered the box): `L` / `HS_L` / `C` / `HS_R` / `R` |
| **GAP** (Trou) | every `LOST` window, every low-fidelity block | Re-enter the possession states and bands from the clip, as a patch (§4) |
| **FLAG** (À revoir) | every `F` press | **type**: `CHANCE_NO_SHOT` / `KEY_DUEL` / `ERROR` / `SET_PIECE_ROUTINE` / `OTHER` · **lane**: `L` / `HS_L` / `C` / `HS_R` / `R` |

**`CHANCE_NO_SHOT`** = no shot was taken, and in band 5 or on the central edge of the box at least one of these happened:
- a 1v1 with the keeper;
- a free teammate within ~11 m of goal in lanes HS_L–C–HS_R;
- a cut-back across the 6-yard box that nobody reached.

### 5.2 Tier 2 — every week (20 min, in this order)

| Card | Trigger | Questions → values |
|---|---|---|
| **ENTRY** (Entrée) | Our band moving 3→4, or into 5 from ≤ 4, while state = US. If over budget: every entry into 5, plus a random 50 % of 3→4 (sampled by the engine, seed = match id) | **lane**: `L` / `HS_L` / `C` / `HS_R` / `R` · **method**: `PASS` / `CARRY` / `CROSS` / `SET_PIECE` / `LOOSE` · **between_lines**: "received between their midfield and defensive lines in a half-space?" `YES` / `NO` · **outcome_15s**: `SHOT` / `BOX_ENTRY` / `CORNER` / `LOST` / `RECYCLED` |
| **LOSS** (Perte) | Our open-play `Q→W` switch in bands 3–5 | **intent**: what were we trying? `PASS_INTO_HS` / `THROUGH` / `CROSS` / `DRIBBLE` / `SHORT_COMBINATION` / `SWITCH` / `CLEARANCE_LONG` / `OTHER` · **intent_lane**: `L` / `HS_L` / `C` / `HS_R` / `R` · **cause**: `INTERCEPTED` / `TACKLED` / `BAD_TOUCH` / `OUT` / `FOUL` · **closing_3s**: number of our players closing the ball within 3 s, `0` / `1` / `2` / `3PLUS` · **regain_5s**: pre-filled from the log, confirm `Y` / `N` |

### 5.3 Tier 3 — rotating theme (10 min; set pieces → duels → conceding, then repeat)

| Card | Trigger | Questions → values |
|---|---|---|
| **SET_PIECE** (CPA) | Every `R:CORNER` / `R:FK` in bands 4–5 (ours) or 0–1 (theirs) | **delivery**: `SHORT` / `NEAR` / `CENTRAL` / `FAR` / `EDGE` · **first_contact**: `US` / `THEM` / `NONE` |
| **DUEL** | Flags answered `KEY_DUEL` | **result**: `WON` / `LOST` / `NEUTRAL` · **recovery_run**: `Y` / `N` |
| **OPP_ENTRY** (Entrée adverse) | Their band moving into 0 | **lane**: `L` / `HS_L` / `C` / `HS_R` / `R` · **method**: `PASS` / `CARRY` / `CROSS` / `SET_PIECE` / `LOOSE` |

**Priority inside each tier:** chronological order. Tier 1 is always finished before Tier 2 starts.

**Answers file** (`reviewed.jsonl`, append-only):

```json
{"card": "ENTRY:212", "seq": 212, "q": {"lane": "HS_R", "method": "PASS", "between_lines": "YES", "outcome_15s": "SHOT"}, "at": "2026-10-05T14:02:11Z", "by": "analyst", "cb": "1.0.0"}
```

Re-answering a card appends a new line; the latest line wins.

---

## 6. Derived definitions (computed by the engine, never tagged)

### 6.1 Timeline

- The ordered ops (§4) give **state segments** (`US` / `THEM` / `DEAD` / `UNKNOWN`) and **band segments**.
- `UNKNOWN` covers `LOST` windows (until a GAP patch replaces them) and the time before the first `Q`/`W` after a kick-off.
- Equal consecutive states or bands are merged.

### 6.2 Possession, regain and loss

- **Possession (US):** a maximal stretch of `US` state. A `US → DEAD → US` sequence (we keep the restart) is the same possession, with the DEAD time subtracted.
- **Regain:** a `THEM → US` switch **with no DEAD in between** (open play). Its band = the band at that moment.
- **Loss:** a `US → THEM` switch with no DEAD in between.
- **High regain:** a regain in bands 3–5.
- **Possession %** = US time ÷ (US time + THEM time). DEAD and UNKNOWN time are excluded.

### 6.3 Phases (each second of possession gets exactly one phase; first matching rule wins)

1. **SET_PIECE**: within 20 s after the restart of a corner, free kick or penalty (either team), or a throw-in taken in bands 4–5 (ours) or 0–1 (theirs).
2. **TRANSITION**: within 10 s after an open-play regain.
3. **BUILD_UP**: the rest of possession while the ball is in bands 0–2 (bands 3–5 when the opponent has the ball, seen from their direction).
4. **SETTLED** (attaque placée): the rest of possession in bands 3–5 (bands 0–2 for the opponent).

A shot takes the phase of the second it was taken in.

### 6.4 Entries, red zone and box

- **Red-zone entry:** while state = US, the band goes from ≤ 3 to 4 or 5.
- **Box entry (end zone):** while state = US, the band becomes 5.
- **Attack on the 18:** a box entry followed by a shot by us within 15 s.
- Opponent mirror: their band going from ≥ 2 to 0 or 1 / becoming 0.

### 6.5 Chances

**Chance** = a shot, or a flag answered `CHANCE_NO_SHOT`.

### 6.6 Attempts (tentatives)

| Attempt type | Success | Failure |
|---|---|---|
| **Half-space attempt** | ENTRY with lane `HS_L` / `HS_R` | LOSS in bands 3–5 with intent_lane `HS_L` / `HS_R` |
| **Box attempt** | Box entry | LOSS in band 4 with intent `THROUGH`, `CROSS`, `DRIBBLE` or `PASS_INTO_HS` |
| **Progression attempt** | Red-zone entry | LOSS in band 3 with intent other than `CLEARANCE_LONG` |

Success rate = successes ÷ (successes + failures). Only cards that were answered count; coverage is shown.

### 6.7 Joining review answers to the timeline

- A card made from a press carries that press's `seq`.
- A card added freely in the review attaches to the nearest band-change op within ±5 s. With nothing in that window it is stored unjoined and left out of xT.

---

## 7. Models

### 7.1 xG (published table, never fitted on our matches)

- **Buckets:** `loc` (5 values) × `body` (FOOT, HEAD; OTHER is counted as HEAD) × `situation` (OPEN, FAST_BREAK, SET_PIECE) = 30 cells. Plus PENALTY = **0.76**.
- **Build procedure** (`tools/build_xg_table.py`, run once, output stored in the codebook JSON):
  1. Download the StatsBomb open data (github.com/statsbomb/open-data). Keep the men's competitions and every non-penalty shot.
  2. Map each shot to our buckets.
     - **loc**: from its x/y using §1 geometry. 6-yard box = `SIX`. Rest of the box: lanes HS–C–HS = `CENTRAL_BOX`, otherwise `WIDE_BOX`. Outside the box: the same split gives `CENTRAL_OUT` / `WIDE_OUT`.
     - **body**: Head → HEAD, Other → HEAD, otherwise FOOT.
     - **situation**: StatsBomb play pattern "From Counter", or a shot ≤ 10 s after a possession change → FAST_BREAK. Set-piece play patterns → SET_PIECE. Otherwise OPEN.
  3. Cell value = goals ÷ shots in that cell. A cell with fewer than 200 shots is merged with its `situation = OPEN` neighbour.
  4. Store the values, the shot count per cell, the source and the build date. The SHA-256 of the table goes into the codebook JSON.
- **Provisional values until the script has run** (order of magnitude only, flagged `xg_table: provisional` in every output):

| loc | FOOT · OPEN | FOOT · FAST_BREAK | FOOT · SET_PIECE | HEAD (all) |
|---|---|---|---|---|
| SIX | 0.35 | 0.40 | 0.30 | 0.20 |
| CENTRAL_BOX | 0.12 | 0.16 | 0.10 | 0.07 |
| WIDE_BOX | 0.05 | 0.06 | 0.05 | 0.03 |
| CENTRAL_OUT | 0.04 | 0.04 | 0.05 (direct FK) | 0.01 |
| WIDE_OUT | 0.02 | 0.02 | 0.03 | 0.01 |

- **Missing answers:** a shot with `loc` unknown takes the shot-weighted average of its band's cells (band 5 → the box cells, band 4 / 3 → the outside cells). The match is then labelled "xG partly estimated".
- **Label everywhere:** "xG (table publique, grossière, non ajustée sur nous)".

### 7.2 xT (public grid, coarsened)

- **Source:** Karun Singh's published expected-threat grid (2018). Use the 12 × 8 version commonly distributed as `xT_grid.json`; the 16 × 12 original is processed the same way.
- **Coarsening** (`tools/build_xt_grid.py`): for each of our 26 cells (§1.3), our value = the mean of the source cells whose centres fall inside it, computed on a 105 × 68 m pitch. Stored in the codebook JSON with its SHA-256.
- **Per match:**
  - Each band change during US possession is a move from cell A to cell B.
  - The lane of a cell comes from the joined ENTRY card. Without a lane, the band's lane-average value is used.
  - **Gain** = `max(0, xT[B] − xT[A])`, and it counts only if ≥ 0.01, so sideways or backward moves earn 0.
  - **xT gained** = the sum of gains. It is split by phase (§6.3) and by lane.
- **Label:** "progression dangereuse (xT, grille publique, grossière)".

---

## 8. Metrics catalogue

Conventions:
- **Poss** = our possession minutes. **OppPoss** = theirs.
- Every metric is returned as `{value, n, coverage, label, clips[]}`.
- **Min n**: below it the value is hidden, shown as "trop tôt" (too early), and only the clips are listed.
- **Direction**: which way is good; used by the improvement rule (§9.4).

### 8.1 Identité (score, create, don't concede)

| ID | FR label | Formula | Unit | Min n | Direction | Label |
|---|---|---|---|---|---|---|
| `goals_for` / `goals_against` | Buts pour / contre | count of `SH:GOAL` by team | per match | – | ↑ / ↓ | exact |
| `shots_for` / `shots_against` | Tirs pour / contre | count of `SH` | per match | – | ↑ / ↓ | exact |
| `chances_for` / `chances_against` | Occasions | shots + `CHANCE_NO_SHOT` | per match | – | ↑ / ↓ | exact + judged |
| `chance_share` | Part des occasions | for ÷ (for + against) | % | 3 matches | ↑ | trend |
| `xg_for` / `xg_against` / `xgd` | xG pour / contre / diff. | Σ table xG (§7.1) | xG per match | – | ↑ / ↓ / ↑ | published coarse |
| `conversion` | Réalisme | goals ÷ shots, with a Wilson 90 % interval | % | 30 shots | ↑ | coarse |

### 8.2 Phases (transition, build-up, set pieces)

| ID | FR label | Formula | Unit | Min n | Dir. |
|---|---|---|---|---|---|
| `xg_rate_<phase>` | xG par phase | xG of shots in the phase ÷ minutes of that phase × 10 | xG/10 min | 5 matches | ↑ |
| `transition_to_box` | Transitions → surface en 10 s | regains followed by a box entry within 10 s ÷ regains | % | 20 regains | ↑ |
| `transition_speed` | Vitesse de transition | median time from regain to the next shot or box entry (existing classic formula: excluded if a loss happens in between, or > 60 s, or a dead ball in between) | s | 20 | ↓ |
| `buildup_progression` | Construction → zone 4 | build-up possessions (starting in bands 0–2, not transition or set piece) that reach band 4 ÷ build-up possessions | % | 30 | ↑ |
| `setpiece_shot_rate` | CPA → tir en 20 s | our set pieces (corner / FK / pen / throw in 4–5) followed by our shot within 20 s with no loss in between ÷ our set pieces | % | 15 | ↑ |
| `setpiece_xg` | xG par CPA | xG of shots in SET_PIECE phase ÷ our set pieces | xG | 15 | ↑ |
| `first_contact_won` | Premier contact gagné | `first_contact = US` ÷ answered (US + THEM) | % | 15 | ↑ |
| `*_against` | (mirror) | the same for opponent possessions | | | ↓ |

### 8.3 Progression dangereuse (xT)

| ID | FR label | Formula | Unit | Min n | Dir. |
|---|---|---|---|---|---|
| `xt_gained` | Progression dangereuse | Σ gains (§7.2) ÷ Poss × 10 | xT/10 min | 5 matches | ↑ |
| `xt_by_phase`, `xt_by_lane` | … par phase / par couloir | split of `xt_gained` | xT | 5 matches | – |

### 8.4 Couloir intérieur (half-space)

| ID | FR label | Formula | Unit | Min n | Dir. |
|---|---|---|---|---|---|
| `hs_entry_share` | Entrées par le couloir intérieur | ENTRY with lane HS_L/HS_R ÷ ENTRY with a known lane | % | 20 entries | ↑ |
| `between_lines_rate` | Reçu entre les lignes | between_lines = YES ÷ answered ENTRY | % | 20 | ↑ |
| `hs_to_box` | Couloir intérieur → surface | HS entries with outcome SHOT or BOX_ENTRY ÷ HS entries | % | 15 | ↑ |
| `hs_assist_share` | Tirs servis du couloir intérieur | shots with last_pass_lane HS_* ÷ shots with a known lane | % | 20 shots | ↑ |
| `hs_attempt_success` | Réussite des tentatives intérieures | §6.6 | % | 20 attempts | ↑ |
| `xg_after_hs` vs `xg_after_other` | xG après entrée intérieure / autre | xG of our shots ≤ 15 s after the entry ÷ entries of that kind | xG per entry | 15 each | ↑ |

### 8.5 Zone rouge et attaque des 18 m

| ID | FR label | Formula | Unit | Min n | Dir. |
|---|---|---|---|---|---|
| `redzone_entries` | Entrées zone rouge | red-zone entries ÷ Poss × 10 | /10 min | 5 matches | ↑ |
| `box_entries` | Entrées dans la surface | box entries ÷ Poss × 10 | /10 min | 5 matches | ↑ |
| `red_to_box` | Zone rouge → surface | box entries ÷ red-zone entries | % | 30 | ↑ |
| `box_attack_eff` | Attaque des 18 m | box entries followed by a shot within 15 s ÷ box entries | % | 20 | ↑ |
| `box_attempt_success` | Réussite des tentatives de surface | §6.6 | % | 20 | ↑ |
| `possessions_reaching_redzone` | Possessions qui atteignent la zone rouge | our possessions with a red-zone entry ÷ our possessions | % | 5 matches | ↑ |
| `field_tilt_time` | Territoire (temps) | US time in bands 4–5 ÷ (US time in 4–5 + THEM time in 0–1) | % | – | ↑ |
| `field_tilt_classic` | Field tilt (classique) | the old staff formula (classic.py), kept for comparison | % | – | ↑ |

### 8.6 Intensité (grit)

| ID | FR label | Formula | Unit | Min n | Dir. |
|---|---|---|---|---|---|
| `counterpress_5s` | Contre-pressing 5 s | losses in bands 3–5 followed by our open-play regain within 5 s ÷ losses in bands 3–5 | % | 20 losses | ↑ |
| `high_regains` | Récupérations hautes | high regains ÷ OppPoss × 10 | /10 min | 5 matches | ↑ |
| `opp_possession_length` | Durée des possessions adverses | mean duration of THEM possessions | s | – | ↓ |
| `closing_3s_mean`, `closing_2plus_share` | Joueurs qui ferment en 3 s | mean of closing_3s (3PLUS = 3); share with ≥ 2 | players / % | 20 cards | ↑ |
| `duel_win` | Duels 50/50 gagnés | WON ÷ (WON + LOST) | % | 20 duels | ↑ |
| `resilience_late` | Fin de match | our shots ÷ all shots after 75:00 | % | 5 matches | ↑ |
| `resilience_after_conceding` | Réaction après un but encaissé | our shots ÷ all shots in the 10 min after we concede | % | 5 events | ↑ |

### 8.7 Classic metrics kept from the existing engine

Possession timeline, possession-flow Sankey, possession durations, regain curve, halves dumbbell, set-piece butterfly, game-state splits. Their definitions stay in the docstrings of `src/analytics/*.py`.

---

## 9. Year-over-year (2025 → 2026)

### 9.1 Mapping of the old codes

| Old code (tagger v0.x) | v1 equivalent | Compared |
|---|---|---|
| `RECUP` + zone 1–4 / BOX | regain + band 1–4 / band 0 | regain-band distribution, high regains per match |
| `PERTE` + zone 1–4 / BOX | loss + band 1–4 / band 5 (check the box meaning in the re-tag) | loss-band distribution |
| `TIR_C` / `TIR_HC` / `BUT` | `SH:ON` / `SH:OFF` / `SH:GOAL` | shots, on target, goals per match |
| `CORNER`, `COUP_FRANC`, `TOUCHE`, `DEGAGEMENT`, `PENALTY` | `R:*` | set-piece counts; shots ≤ 20 s |
| couloir `left` / `center` / `right` (dangerous actions only) | lanes collapsed to 3: L = L+HS_L, C, R = HS_R+R | lane share of shots only |
| `CARTON_*` | `EXTRA:CARD` | discipline |
| `PASSE_PROF`, `CONDUITE`, `CENTRE`, `SWITCH`, `SEQUENCE` | none | **not compared** (a deep pass is not a half-space reception) |
| goals against | match results | goals against per match (the only mapped conceding baseline) |

### 9.2 Re-tag baseline

- Re-tag **4 of last season's matches** on Veo: full pass 1 + Tier 1 + Tier 2.
- Pick 2 against top-third and 2 against bottom-third opponents, preferably teams we play again.
- This is the **only** baseline for: half-space, phases, xG/xGA, xT, per-possession rates, grit and attempts.
- If last season's footage is missing, the baseline is the first 5 v1 matches, labelled "baseline intra-saison".

### 9.3 Checking the mapping

- On one re-tagged match, compute every mapped metric from the old export and from the re-tag.
- If they differ by more than 15 % → that metric is "non comparable" and only the re-tag figure is used.
- Note the observed bias in the dashboard footnote.

### 9.4 Improvement rule (fixed before the season)

- **Baseline mean** μ = last season's mean (mapped metrics), or the re-tag / in-season baseline mean.
- **Threshold** d = 0.5 × σ, where σ = the standard deviation of last season's per-match values. For re-tag-only metrics, the pooled SD of v1 matches once n ≥ 5.
- **AMÉLIORÉ (improved):** the rolling mean of the last 5 matches ≥ μ + d (in the good direction), **and** at least 3 of those 5 matches beat μ, **and** both conditions held at 2 consecutive evaluations.
- **EN BAISSE (worse):** the mirror.
- **STABLE (flat):** otherwise.
- **TROP TÔT (too early):** fewer than 5 matches.
- Each status is also shown split by opponent tier and home/away.

---

## 10. Reliability and coverage checks

| Check | Method | Pass bar | If it fails |
|---|---|---|---|
| Review-answer reliability | Every 3rd match: re-answer 20 random cards blind, ≥ 7 days later. Same on the first re-tag | ≥ 85 % agreement per question (Cohen's κ reported) | Merge the answers into coarser values: lanes 5→3 (HS folded into its wide side); between_lines → dropped; phase_check → TRANSITION vs not; closing_3s → 0–1 vs 2+; assist → CROSS vs not; intent → 4 groups (inside, behind, wide, other). Label "simplifié" |
| Live band accuracy | 20 random band presses checked on the clip | ≥ 85 % exact, ≥ 95 % within ±1 | Band rates labelled "±1 zone"; red-zone rates use only moves into 5 |
| Live load | presses/min per 15-min block | average ≤ 12, no block > 14 | A block > 14 → GAP queue. Average > 12 for 3 matches → stop the band presses that aren't possession changes inside bands 1–3 |
| Possession clock | US % checked against 2 random 5-min Veo samples | within 5 points | Possession-based rates labelled "approx." |
| Coverage | answered ÷ eligible, per question, per match | ≥ 80 % normal | 50–80 % "partiel"; < 50 % rate hidden, count only |
| Context | meta: home/away, opponent tier (from last season's table), score timeline | required | Match left out of the tier splits, kept in totals |
| Version stamp | `cb` on every op, `codebook_version` on every match and every YoY line | mandatory | Mixed MAJOR versions are never pooled without §9.1 |

---

## 11. Integrity gates (engine)

| Gate | Rule | Effect |
|---|---|---|
| G1 | Schema valid; codebook version known; SHA-256 matches | **Blocks** the report |
| G2 | Goals from `C` presses = final score (after manual corrections) | **Blocks** |
| G3 | Veo offsets entered for both halves and the 3-moment check done | **Blocks** clip links (numbers still compute) |
| G4 | No negative durations; segments in order | **Blocks** |
| G5 | State time (US + THEM + DEAD + UNKNOWN) = half length ± 3 min | **Blocks** |
| Q1 | Reliability below the bar | Labels "simplifié" / "indicatif" |
| Q2 | Coverage below 80 % | Labels "partiel" |

A blocked report still lets the clip list be sent (once G3 passes).

---

## 12. Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-10-02 | Pre-release edits (before any v1 match): band of throw-ins and free kicks prompted after the restart key; offside = free kick; bands clickable on a pitch view. Definitions confirmed by the analyst. First version: two-pass model (live state + review quiz), 6 bands, 5 lanes from pitch markings, attempts via LOSS intent, published xG / xT, improvement rule, reliability merges. Old tagger comfort keys kept (Space clock, nudges, M, score keys, import, Veo offsets, flip); flag on `R`, lost thread on `T`. |

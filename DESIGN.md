---
name: Lauréats · Analyse de match
description: Analytical match dashboard for the Lauréats staff; a black brand band over a dense grid of question-titled chart tiles.
colors:
  gold: "#c79741"
  gold-deep: "#85601a"
  gold-tint: "#f4ecdc"
  gold-lift: "#d6a755"
  band: "#0a0a0a"
  band-2: "#1c1b19"
  band-rule: "#2e2c28"
  band-ink-2: "#b9b4aa"
  paper: "#ffffff"
  paper-2: "#f3f3f3"
  rule: "#e5e3de"
  ink: "#0a0a0a"
  ink-2: "#45433f"
  ink-3: "#6f6c66"
  data-us: "#b8862e"
  data-them: "#2a6aa8"
  data-mid: "#e8e6e1"
  gold-ramp-low: "#f7f1e3"
  gold-ramp-high: "#7a5512"
  blue-ramp-low: "#eaf1f8"
  blue-ramp-high: "#163f6b"
  diverging-us-end: "#8a6117"
  diverging-them-end: "#1f4f80"
  card-yellow: "#d4a017"
  card-red: "#c62828"
typography:
  display:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.025em"
  figure:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.01em"
    fontFeature: "tnum"
  tab:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.025em"
  tile-title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.25
  tile-note:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.375
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  data-row:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.33
    fontFeature: "tnum"
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0.05em"
  axis:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.2
rounded:
  sm: "2px"
  md: "4px"
  full: "9999px"
spacing:
  tile-gap: "12px"
  tile-pad: "12px"
  tile-pad-sm: "16px"
  page-x: "12px"
  page-x-sm: "20px"
  page-y: "16px"
  container: "1280px"
components:
  tile:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.tile-title}"
    rounded: "{rounded.sm}"
    padding: "16px"
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-primary-hover:
    backgroundColor: "{colors.gold-lift}"
    textColor: "{colors.ink}"
  link-action:
    textColor: "{colors.gold-deep}"
    typography: "{typography.data-row}"
  link-action-hover:
    textColor: "{colors.ink}"
  tab:
    textColor: "{colors.band-ink-2}"
    typography: "{typography.tab}"
    padding: "12px 16px"
  tab-active:
    textColor: "{colors.paper}"
  scoreboard-figure:
    backgroundColor: "{colors.band-2}"
    textColor: "{colors.gold}"
    typography: "{typography.figure}"
    padding: "10px 20px"
  select-band:
    backgroundColor: "{colors.band-2}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  chip-category:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  chip-context:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  filter-chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  filter-chip-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  tooltip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  notice:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Lauréats · Analyse de match

## Overview

**Creative North Star: "Le poste d'analyse"**

An analyst's workstation in the Tableau / Power BI / StatsBomb sense. Each view answers one question with the chart form the data calls for, and the views sit in a dense grid of white tiles on a light grey ground. The club is present as a frame, not as the content. A black band at the top carries the wordmark, the score, the match select, the tabs and a compact strip of five gold figures. Everything below the band is evidence: charts, pitches, tables, clip rows.

Data honesty comes before looks. The tagging is precise in time and coarse in space, so time views get the most investment and pitch views are drawn at the data's true resolution (4 zone bands, or a 4 × 3 couloir grid with the box nested in zone 4). Small samples are shown with their n and visibly weakened. Any smoothing is stated in the tile. Colour shows identity (us / them), magnitude (ramps) or direction (diverging, dumbbell), and never says whether something is good or bad: that is the staff's call. The interface is in French.

The build rejects gradients, glass, decorative shadows, invented logos, smoothed spatial blobs, shot maps and chart animation.

**Key Characteristics:**
- Black brand band with a compact five-figure gold strip; a grey ground with white tiles below.
- Two palettes: the brand palette for chrome, a validated data palette for marks.
- Every tile is titled with the question it answers, with a one-line note on how to read it.
- The chart form is chosen per question, from a fixed vocabulary.
- Pitches at true resolution only; small n hatched or faded; smoothing disclosed.
- One authored motion: the scoreboard figures flip into place.

## Colors

Two palettes that never trade jobs: the club's black / white / gold for the interface, and a validated gold-and-slate-blue data palette for everything plotted.

### Primary
- **Lauréats Gold** (`gold`): chrome gold. It appears on the black band as the wordmark, the score, the scoreboard figures, the active-tab underline and focus rings. On white it is used only as a solid fill under ink: the "Voir" / "Voir les clips" video buttons.
- **Deep Gold** (`gold-deep`): chrome gold for text on white. Used for action links ("Bibliothèque →", "clips", "nos CPA"), key-point numerals, notice icons and the "limite déduite" line in tooltips.
- **Gold Lift** (`gold-lift`) and **Gold Tint** (`gold-tint`): the button hover fill and the text selection.

### Secondary (data palette)
- **Data Gold** (`data-us`): Lauréats in every chart: the threat area, the radar fill, the bullet marker, the beeswarm dots, our density curve, our goal lines, the butterfly's left bars, the "higher in MT2" dumbbell.
- **Slate Blue** (`data-them`): the opponent, the season average (radar outline, bullet tick), losses in the Sankey, the "lower in MT2" dumbbell. It passed the validator against Data Gold on white, including colour-vision-deficiency separation.
- **Mid Grey** (`data-mid`): the diverging midpoint, the bullet's season-range bar and empty cells.

### Tertiary (ramps)
- **Gold ramp** (`gold-ramp-low` → `gold-ramp-high`, linear in RGB): sequential magnitude for our actions and recoveries (recovery pitch, recovery-value pitch, couloir lanes, zone × couloir grid).
- **Blue ramp** (`blue-ramp-low` → `blue-ramp-high`): sequential magnitude for losses.
- **Diverging** (`diverging-them-end` ← `data-mid` → `diverging-us-end`): signed balances such as recoveries minus losses per zone. Negative values go blue and positive values go gold, scaled to the largest absolute value.
- **Referee cards** (`card-yellow`, `card-red`): dashed event lines in the match story only.

### Neutral
- **Ink** (`ink`): text, pitch lines, the Sankey start nodes, funnel bars, the possession-share line, shots on target.
- **Ink 2 / Ink 3** (`ink-2`, `ink-3`): row labels, then notes, axis ticks and legends. Ink 3 is also the chart muting colour (reference lines, unresolved outcomes).
- **Paper** (`paper`): tile and tooltip surface. **Paper Shade** (`paper-2`): the page ground under the tiles, the empty pitch and notices.
- **Hairline** (`rule`): tile borders, table rules and chart gridlines.
- **Band set** (`band`, `band-2`, `band-rule`, `band-ink-2`): the black header, the scoreboard strip, its dividers and its secondary text.

### Named Rules
**The Chrome / Data Split Rule.** Brand gold (`gold`, `gold-deep`) belongs to the interface: buttons, links, tabs, figures. Marks in a chart use only `data-us`, `data-them`, `data-mid`, the ramps and the neutrals. A new chart imports from the data palette, never the chrome tokens.

**The Identity, Magnitude, Direction Rule.** Gold means "us", "more of ours" or "positive / higher". Blue means "them", "more losses" or "negative / lower". Neither colour means better or worse. Grey means unresolved, empty or reference.

**The Ink-on-Ramp Rule.** Labels printed on a ramp cell switch to white past 55 % of a sequential ramp. On the diverging ramp they switch to white below −0.4 and above +0.6, so both dark ends get white. Every cell prints its value; colour is never the only carrier.

## Typography

**Display Font:** Barlow Condensed (fallback Barlow, sans-serif)
**Body Font:** Barlow (fallback system-ui, sans-serif)

**Character:** Condensed capitals for the scoreboard, the tabs and the big numbers on pitches; a plain workhorse sans for everything read at length. Figures are tabular wherever numbers appear.

### Hierarchy
- **Display** (700, 1.875rem → 2.25rem from `sm`, line-height 1, caps): the match title in the band, "Lauréats 2–1 Vanier", with the score in gold.
- **Figure** (600, 1.875rem, tabular): scoreboard values, counter-press headline figures, and pitch cell values in SVG (18–30px condensed 600).
- **Tab** (600, 15px → 18px, caps): the band navigation.
- **Tile title** (600, 13px): the question the tile answers, in sentence case and phrased as a question.
- **Tile note** (400, 11px, Ink 3): how to read the chart, with n, method and window.
- **Data row** (12px, tabular): bullet, dumbbell, butterfly, state-dot and key-value rows.
- **Label** (500, 12px, 0.05em, caps): scoreboard labels, table headers and half labels.
- **Axis** (10px, Ink 3): chart ticks, reference-line labels and bullet range ends (9px).

### Named Rules
**The Question Title Rule.** A tile title is the question, not a topic ("Où perd-on le ballon ?", not "Pertes"). The note underneath says how to read the answer.

## Layout

The band spans the full width; content sits in a 1280px container with 12px side padding (20px from `sm`). Each tab is a 12-column tile grid from `lg`, with 12px gaps and tiles spanning 4, 5, 7 or 8 columns, mostly paired 8+4 / 7+5 / 4+4+4. Terrain switches to 2 columns at `md`. Below `lg` the tiles stack to one column. A tall tile may span two rows (the recovery-value pitch). The scoreboard strip is 2 columns on phones (an odd last figure spans both), 3 at `sm` and 5 at `lg`, with compact rows (10px vertical padding). The full possession table closes the Possession tab as a collapsible. The Clips tab is a single column of hairline-separated sections rather than tiles.

**The Density Rule.** Tiles are packed: 12px gutters, 12–16px padding, small type. Don't add whitespace to make a chart breathe; give it a wider span instead.

## Elevation & Depth

Flat. Tiles are separated from the grey ground by a 1px hairline border and tone, not by shadow. The only shadows are on floating readouts (chart and timeline tooltips), which disappear with the hover.

### Shadow Vocabulary
- **Tooltip** (`0 4px 14px–16px rgba(10,10,10,0.08–0.10)`; timeline `0 6px 20px rgba(10,10,10,0.10)`): floating readouts only.

### Named Rules
**The One Level Rule.** Nothing at rest has a shadow. A shadow means "floating over the data right now".

## Shapes

Near-square. Tiles, chips, tooltips, bars and bullet ranges have a 2px corner. Buttons, selects and notices have 4px. Only markers (bullet and dot-plot dots, dumbbell ends, beeswarm dots, goal discs) and filter chips are fully round. Pitches are drawn vertically with attack upward, on a 300 × 420 grid: 4 equal zone bands, the box inside zone 4, dashed zone dividers and Z1–Z4 labels in condensed caps. Small samples are hatched with white 45° stripes (6px pitch); inferred possession limits use a 135° paper-coloured hatch.

## Components

### Tile (the unit of the dashboard)
- **Anatomy:** a white surface with a hairline border and 2px corner, padded 12px (16px from `sm`). Then the question title (13px 600), an optional aside on the right (clip links), a one-line note in Ink 3 (11px) stating n, method, window or smoothing, and the chart 12px below.
- **Rule:** every chart lives in a tile; a tile holds one question.

### Chart vocabulary (form chosen per question)
- **Match story:** for "when were we on top?". Two stacked panels on a shared minute axis with a synced tooltip. The top panel is threat per 5 min, Gaussian-smoothed (σ = 2.5 min, stated on the panel), drawn as a Data Gold line with area and shots as ink dots on the baseline (filled = on target). The bottom panel is the rolling 5-minute possession share as an ink line around a 50 % reference, filled gold above and blue below. Event lines run through both panels: goals solid (gold ours, blue theirs), cards dashed in card colours, half-time dashed ink.
- **Radar vs own season range:** for "what kind of match was this?". Eight axes, each scaled from our lowest tagged match (0.15) to our highest (1). This match is filled Data Gold; the season average is a dashed Slate Blue outline. The tooltip gives raw values and the range. It is not a league percentile, and the legend says so.
- **Bullets:** for "how does each KPI sit in context?". Each row has a Mid Grey season range bar, a Slate Blue average tick, a Data Gold match dot and the value on the right. Shares share one fixed 0–100 % axis; counts and ratios run 0 → max × 1.1.
- **Band pitch:** for "where do we win / lose / dominate?". Four zone bands plus the box, filled from the gold ramp (recoveries), blue ramp (losses) or diverging ramp (balance). The value is printed per band, and the bands are clickable through to clips.
- **Zone × couloir grid:** for "where do dangerous actions arrive?". A 4 × 3 grid with three box cells, gold ramp, counts printed. Empty cells are left blank with a grey 0.
- **Couloir pitch:** three lanes shaded by share, with a big % and n per lane and an ink arrow whose width scales with the share. The type breakdown sits underneath.
- **Sankey:** for "how do possessions start and end?". Ink start nodes on the left. Outcomes are coloured gold for danger (goal / shot, box), blue for losses and grey for the rest. Links take the target colour at 28 % opacity.
- **Survival curve:** for "how fast do we win it back?". A step line of the share of losses not yet regained, 0–60 s. The overall line is thick Data Gold, with lines per loss zone and dashed references at 5 s and 10 s. n appears in the legend.
- **Beeswarm:** for "how direct are we after a recovery?". One Data Gold dot per transition, stacked in 1 s bins on a 0–60 s axis. Shaded bands mark Contre (0–5), Rapide (5–15) and Construit (15–60), with an ink median line.
- **KDE density with rug:** for "who keeps the ball longer?". Overlaid us / them densities on a log axis (1–120 s), dashed median lines, n and median in the legend, and a rug of one tick per possession. The smoothing is disclosed under the chart.
- **Dumbbell:** for "what changed at half-time?". MT1 is a hollow dot and MT2 a filled dot, each row on its own 0 → max scale. Colour shows direction only: gold higher, blue lower, grey unchanged.
- **Butterfly:** for "who won the restarts?". Ours to the left in Data Gold, theirs to the right in Slate Blue, on one shared scale with counts at the outer ends.
- **Dot plot:** possession by score state on 0–100 % with a 50 % line and n printed.
- **Funnel:** centred ink bars stepping lighter by stage, the goal stage in Data Gold, conversion rates between stages and clip links per stage.
- **Possession timeline:** one strip per half of reconstructed possessions, with shots and goal discs above and minute ticks below. Hover or focus dims the others to 40 %. Inferred limits are hatched.

### Scoreboard strip (signature)
Five figures per tab inside the band: a caps label in Band Grey, a gold condensed figure and a one-line balanced caption. When the tab or match changes, each figure flips up into place: 520ms, `cubic-bezier(0.16, 1, 0.3, 1)`, starting 40 % below with a 2px blur, staggered 45ms per figure. Reduced motion turns it off. This is the only authored motion; every chart sets animation off.

### Buttons and links
- **Primary (gold):** gold fill, ink text, 600 weight, 14px, with a Play icon. It always means "go to the video": "Voir les clips (n)" in the band, "Voir" on each clip row (icon only on phones, with a screen-reader label). Hover fills with Gold Lift. Focus is a 2px gold outline at 2px offset.
- **Action link:** Deep Gold text that turns ink on hover. Any countable stat or tile aside opens the clip library pre-filtered.

### Navigation
- **Tabs:** condensed caps, Band Grey when inactive, paper on hover and when active, with a 2px gold underline. Arrow keys move between tabs; the active tab lives in the URL hash.
- **Match select:** a Board Panel fill and band-rule border inside the band.

### Chips and filters
- **Category chip:** ink fill, paper text, 11px. **Context chip:** hairline border, Ink 2 text.
- **Filter chip (Clips):** round, hairline border; when on, it becomes an ink fill with paper text and a muted count.

### Tooltip
A paper surface with a hairline border and small corner. The value or minute leads in 600 weight; the context follows in Ink 2 / Ink 3.

### Notices
A Paper Shade block with a hairline border and 4px corner, a Deep Gold warning icon, a bold lead sentence, then the instruction.

## Do's and Don'ts

### Do:
- **Do** title every tile with the question it answers and state n, method, window and any smoothing in its note.
- **Do** pick the chart form for the question from the vocabulary above before adding a new one.
- **Do** draw pitch views at true resolution only: 4 zone bands, or the 4 × 3 couloir × zone grid with the box nested in zone 4.
- **Do** weaken small samples visibly: hatch pitch cells under n = 5 and mark their value with "*", and fade dots under n = 10, saying so in the note or legend.
- **Do** use the data palette (`data-us`, `data-them`, `data-mid`, gold / blue / diverging ramps) for marks and the brand palette for chrome.
- **Do** print the value on every ramp cell, switching to white ink per the Ink-on-Ramp Rule.
- **Do** compare against our own tagged matches (range, average), and label it that way.
- **Do** set every number in tabular figures, turn chart animation off, and write all interface text in French.

### Don't:
- **Don't** let colour, wording or ordering judge better or worse in the frontend; direction and identity only.
- **Don't** invent positions: no shot maps, no smoothed heat blobs, no coordinates the tagging doesn't record.
- **Don't** smooth silently; a smoothed curve names its kernel or window.
- **Don't** use chrome gold (`gold`, `gold-deep`) as a data mark, or data gold as interface chrome.
- **Don't** add an opponent threat line; opponent actions are barely tagged.
- **Don't** give resting elements a shadow, or add gradients, glass or background imagery.
- **Don't** add a second authored animation; the scoreboard flip is the motion.
- **Don't** invent or redraw a logo; use `dashboard/public/logo.png` when present and the gold wordmark otherwise.

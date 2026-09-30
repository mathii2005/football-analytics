---
name: Lauréats · Analyse de match
description: Match-analysis dashboard for the Lauréats staff, set as a stadium scoreboard band over a white evidence page.
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
  paper-2: "#f6f5f2"
  rule: "#e5e3de"
  ink: "#0a0a0a"
  ink-2: "#45433f"
  ink-3: "#6f6c66"
  us: "#0a0a0a"
  them: "#9a968e"
typography:
  display:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.025em"
  headline:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.01em"
    fontFeature: "tnum"
  title:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.025em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0.05em"
rounded:
  sm: "2px"
  md: "4px"
  full: "9999px"
spacing:
  gutter: "16px"
  gutter-sm: "24px"
  block: "20px"
  stack: "16px"
  section: "40px"
  page-y: "32px"
  container: "1152px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  button-primary-hover:
    backgroundColor: "{colors.gold-lift}"
    textColor: "{colors.ink}"
  link-action:
    textColor: "{colors.gold-deep}"
    typography: "{typography.body-sm}"
  link-action-hover:
    textColor: "{colors.ink}"
  tab:
    textColor: "{colors.band-ink-2}"
    typography: "{typography.title}"
    padding: "12px 16px"
  tab-active:
    textColor: "{colors.paper}"
  scoreboard-figure:
    backgroundColor: "{colors.band-2}"
    textColor: "{colors.gold}"
    typography: "{typography.headline}"
    padding: "16px 20px"
  select-band:
    backgroundColor: "{colors.band-2}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  tag-category:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  tag-context:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  notice:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Lauréats · Analyse de match

## Overview

**Creative North Star: "Le tableau d'affichage"**

The dashboard is a stadium scoreboard bolted over a coach's notebook. Every tab opens on a full-width black band carrying the wordmark, the score, the tabs and a row of four to six large gold figures; below it, on plain white, the evidence reads like a well-kept analyst's sheet: hairline rules, tabular figures, condensed capitals for headings, no containers. The band is loud and brief, the page is quiet and dense.

The club colours (gold, black, white) are binding, and gold is treated as a signal rather than a decoration: it marks the numbers that matter, the active tab, and the moments to act on (open the clips, watch in Veo). Everything that is "them" or "a loss" drops to warm grey. Uncertainty has its own visual: inferred possessions are hatched, never drawn as solid fact. The interface is French throughout.

Rejected by the build: the grid of equal KPI cards, gradients, glass, decorative shadows, invented logos.

**Key Characteristics:**
- Black scoreboard band at the top of every tab; white evidence page below.
- Gold carries meaning (good / act here), never losses, never decoration.
- Hairline rules separate blocks; there are no cards.
- Condensed caps for display and headings, a plain workhorse sans for reading, tabular figures everywhere numbers appear.
- One authored motion: the scoreboard figures flip into place.

## Colors

A three-colour club palette (gold, black, white) extended with warm greys; gold appears in two steps depending on the ground it sits on.

### Primary
- **Lauréats Gold** (`gold`): the brand gold. As text and line it sits on the black band: scoreboard figures, the score in the title, the wordmark, the active-tab underline, focus rings. On white it appears only as a solid fill under ink: the "Voir" clip buttons and our goal discs. On black it reaches about 8:1.
- **Deep Gold** (`gold-deep`): gold for text and marks on white (about 5:1): key-point numerals, "Tous les clips" link, the better half in the halves table, goal/shot bars in the outcome chart, notice icons, the "limite déduite" note, and the top of the attack-origins ramp.
- **Gold Tint** (`gold-tint`): text selection only.
- **Gold Lift** (`gold-lift`): hover and focus fill of gold buttons.

### Neutral
- **Scoreboard Black** (`band`) and **Board Panel** (`band-2`): the header band and the slightly lifted strip holding the scoreboard figures and the match select. `html` is also black so overscroll never flashes white above the band.
- **Band Rule** (`band-rule`): hairlines inside the band (between figures, select border, link underline at rest).
- **Band Grey** (`band-ink-2`): secondary text on black: figure labels and captions, inactive tabs, date and venue.
- **Paper** (`paper`) and **Paper Shade** (`paper-2`): the page ground, and the faint fill for notices and empty heat-map cells.
- **Rule** (`rule`): every hairline on white, table row separators, empty bar tracks, chart gridlines.
- **Ink** (`ink`), **Ink 2** (`ink-2`), **Ink 3** (`ink-3`): primary text; secondary text and chart labels; notes, table headers, axis ticks.

### Data roles
- **Us** (`us`, same black as ink): our possessions, recoveries, shots, couloir rate bars.
- **Them** (`them`): the opponent's possessions and goals, and our losses in the zone chart.

### Named Rules
**The Gold Means Good Rule.** Gold marks a number that matters, a positive, or a place to act. It never marks a loss or an opponent's event; those use Them grey or ink with weight. (The zone chart deliberately avoids gold; the outcome chart bolds the most frequent loss rather than colouring it.)

**The Two Golds Rule.** Bright gold text lives on black only. On white, gold text, numerals and thin marks use Deep Gold. Bright gold appears on white only as a solid fill carrying ink (the Voir button, the "B" goal disc), where the legible contrast is ink-on-gold.

## Typography

**Display Font:** Barlow Condensed (with Barlow, sans-serif), weights 500/600/700
**Body Font:** Barlow (with system-ui, sans-serif), weights 400/500/600
Both are self-hosted through `@fontsource`; nothing loads from a font CDN.

**Character:** Barlow Condensed gives the scoreboard its stadium-board capitals and packs big numbers into narrow columns; Barlow, from the same family, keeps reading text calm and legible at 14–16px.

### Hierarchy
- **Display** (700, 2.25rem rising to 3rem at 640px, line-height 1, caps, 0.025em): the match title "LAURÉATS 2–1 VANIER" in the band. The wordmark fallback uses the same face at 1.5rem, 700, caps, 0.12em tracking, in gold.
- **Headline** (600, 3rem, line-height 1, tabular): scoreboard figures. Smaller display numerals reuse the face: halves-table values (1.5rem), clip times, zone balances and section titles (1.25rem), key-point numerals (1.125rem).
- **Title** (600, 1.25rem, caps, 0.025em): section headings on white; tabs in the band (1rem, 1.125rem from 640px).
- **Body** (400, 16px, 1.5): default reading text; key points at 15px, snug leading. Clip titles at 500.
- **Body small** (400, 0.875rem): section notes (capped at 70ch), clip reasons, table cells, buttons (600).
- **Label** (500, 0.75rem, caps, 0.05em): data labels only: scoreboard figure labels, table headers, half headings ("1re mi-temps"), zone names. Chip text and tick labels drop to 11px without caps.

### Named Rules
**The Tabular Figures Rule.** Every number that can sit next to another number is set with tabular figures, in the band, in tables, in charts, in tooltips.

**The Caps Are Structure Rule.** Uppercase belongs to the display face (titles, tabs) and to data labels naming a value directly below or beside them. It is not used for decorative lead-ins above headings.

## Layout

One centred column (max 1152px) with a 16px gutter, 24px from 640px. The band spans the full viewport width; its contents align to the same column as the page.

- **Band:** wordmark and match select on one row; title, date/venue, Veo link and the gold clips button on the next (wrapping on phones); tabs on a hairline-free row with a 2px underline for the active tab, horizontally scrollable on narrow screens. The scoreboard strip below it is a grid of hairline-divided cells: 2 columns on phones, 3 from 640px, 5 from 1024px.
- **Page:** 32px top padding, sections stacked with 40px between them. Two-column arrangements appear only from 1024px: 1/3 + 2/3 on Aperçu (key points / timeline), halves on En profondeur and Terrain. Everything collapses to one column below.
- **Section rhythm:** 20px from the hairline to the title, 4px to the note, 16px to the content.
- **Rows:** clip rows are a three-column grid (time 3.75rem / content / action), 12px vertical padding; table rows 8–10px.

Breakpoints are Tailwind's defaults: 640, 768, 1024px.

## Elevation & Depth

Flat. Depth comes from tone, not shadow: black band over white page, the Board Panel strip slightly lifted inside the band, Paper Shade for notices. The only shadows are the soft ambient ones under the two floating tooltips (possession timeline and chart tooltip), because those genuinely float over data.

### Shadow Vocabulary
- **Tooltip** (`0 4px 16px rgba(10,10,10,0.08)` for chart tooltips, `0 6px 20px rgba(10,10,10,0.10)` for the timeline tooltip): floating readouts only.

### Named Rules
**The One Level Rule.** Nothing rests on a shadow. A shadow means "this is floating above the data right now" and disappears with it.

## Shapes

Near-square. Buttons, the select, notices and tooltips use a 4px corner; chips, legend swatches, heat-map cells and bar ends use 2–3px; only markers (shot dots, goal "B" discs) and the couloir rate tracks are fully round. Blocks are separated by 1px hairlines (`rule` on white, `band-rule` on black) rather than enclosed. Inferred data uses a 135° hatch (3px gap, 2px stripe) cut from the paper colour.

## Components

### Buttons
Few and purposeful; the gold button always means "go to the video".
- **Shape:** gently squared (4px).
- **Primary (gold):** gold fill, ink text, 600 weight, 14px, with a lucide Play icon; 6–8px × 12px padding. "Voir les clips (n)" in the band, "Voir" on each clip row (icon only on phones, with a screen-reader label).
- **Hover / Focus:** fill shifts to Gold Lift; global focus ring is a 2px gold outline at 2px offset.
- **Text action:** "Tous les clips (n) →" in Deep Gold, turning ink on hover.
- **Band link:** "Match sur Veo" in paper with a band-rule underline that turns gold on hover, plus an external-link icon.

### Chips
- **Category:** ink fill, paper text, 11px, 2px corner.
- **Context:** hairline border, Ink 2 text, same size. Both sit under the clip reason.

### Inputs / Fields
- **Match select:** Board Panel fill, band-rule border, paper text, 4px corner, inside the band next to a "MATCH" label (hidden on phones).

### Navigation
- **Tabs:** Barlow Condensed caps, 600. Inactive in Band Grey, hover to paper; active in paper with a 2px gold underline. Arrow keys move between tabs; the active tab is stored in the URL hash.

### Scoreboard (signature)
The row of four to six figures inside the band: caps label in Band Grey, 3rem gold figure, one-line caption in Band Grey (balanced wrapping). Figures change per tab. When the tab or match changes, each figure flips up into place (520ms, `cubic-bezier(0.16, 1, 0.3, 1)`, from 40% below with a 2px blur, staggered 45ms per figure); reduced-motion turns it off. This is the only authored motion in the system.

### Section
A hairline on top, condensed caps title, optional aside on the right (e.g. the "Tous les clips" link), optional grey note, then content. This replaces cards everywhere.

### Clip row
Time in display numerals with "MT1 · 0–0" beneath, title and reason, chips, and the gold Voir button on the right; rows divided by hairlines. When no video is linked, the button becomes a grey VideoOff icon.

### Possession timeline
Per-half strip of possession blocks (Us black, Them grey, inferred hatched) with shot dots and "B" goal discs above, minute ticks below. Hover or focus dims the others to 40% and shows a floating tooltip; the full table of possessions sits in a collapsible below on En profondeur.

### Data displays
- **Halves table:** MT1 and MT2 values mirrored around the stat name; the better half of a clear swing turns Deep Gold.
- **Zone chart:** losses grow left in Them grey, recoveries grow right in ink, signed balance at the edge; no gold.
- **Attack origins:** a single-hue ramp from white to Deep Gold, count always printed, text flips to white on dark cells.
- **Charts (Recharts):** ink bars; gold marks only goal windows and goal/shot outcomes (Deep Gold on white, per the Two Golds Rule); rule-coloured gridlines; no animation.

### Notices
Paper Shade block, hairline border, 4px corner, a Deep Gold AlertTriangle icon, a bold lead sentence then the instruction.

## Do's and Don'ts

### Do:
- **Do** open every tab on the black band with the scoreboard row; put the evidence on white below.
- **Do** use bright Lauréats Gold only on black and Deep Gold for any gold text or mark on white.
- **Do** separate blocks with 1px hairlines and a condensed caps title (the Section pattern).
- **Do** set every number in tabular figures, and hatch anything inferred.
- **Do** use lucide-react icons at 12–18px, marked `aria-hidden` when a label is present.
- **Do** write all interface text in French with the tagger's vocabulary.
- **Do** show the user's logo from `dashboard/public/logo.png` when present, and fall back to the gold "LAURÉATS" wordmark otherwise.

### Don't:
- **Don't** colour a loss, a concession or an opponent event in gold; use Them grey, or ink with weight.
- **Don't** wrap sections in cards or give resting elements a shadow.
- **Don't** add gradients, glass or background imagery.
- **Don't** add a second authored animation; the scoreboard flip is the motion.
- **Don't** invent or redraw a logo.

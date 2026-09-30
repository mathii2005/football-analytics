# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Head coach, on a laptop** – reviews a match at a desk, usually the day after, to decide what to work on in training and what to show players.
- **Coaches, on a phone** – check the key numbers and open clips on the go, e.g. before a training session.
- **The analyst (developer)** – tags matches live, checks tagging quality and prepares the review.

Players are not direct users (clips are not shown to them from this app for now).

## Product Purpose

Match analysis for the Lauréats soccer team (college level, RSEQ, Quebec). A match tagged live in the Lauréats tagger is processed automatically – no per-match dashboard to build – into possessions, match metrics and a short list of Veo clips worth reviewing. Success: after a match, the export is dropped in, and a coach can go from a finding ("we lost the ball 37 times in zone 3") to the exact video moments in one click, with no manual work from the analyst.

## Positioning

Built on the team's own definitions (what counts as a loss, a cheap loss, a high recovery…) applied the same way every match, and every number leads to the Veo moment – clips are chosen by game context, not dumped.

## Operating Context

- Tagging: one analyst, live, ~150–250 events per match, our team's actions mostly; tags lag the action by a few seconds (clips open 8 s early).
- Video: Veo; links open `…/#t=MM:SS` with separate kickoff offsets per half.
- The staff already used per-match HTML dashboards (tabs Aperçu / En profondeur / Vue complète / Terrain, handwritten match summary). This app replaces them with an automated version: five tabs (Aperçu, Possession, Attaque, Terrain, Clips Veo) that keep every old view and add the possession-engine layer.
- Six matches tagged so far this season; samples per match are small.

## Capabilities and Constraints

- Language: **French** for all interface text and generated summaries. Football vocabulary follows the tagger: récupération, perte, zone 1–4 / surface, couloir gauche / axe / droit, mi-temps (MT1 / MT2).
- Football definitions belong to the staff/analyst (see `CLAUDE.md`); the interface never implies precision the tagging doesn't have (possession boundaries can be inferred; opponent actions are mostly not tagged; no player attribution yet).
- Data comes from the FastAPI service (`src/api/app.py`); the dashboard contains no football logic.
- Undecided: player-level views (no player data yet, consent needed), deployment/hosting and authentication.

## Brand Commitments

- Lauréats team colours: **gold `#c79741`, black and white**. Binding.
- Tone: professional (a club's staff tool, not a fan or TV product).
- Name: "Lauréats". The user will supply a logo and shirt photos; until then the logo slot falls back to the wordmark. Never invent a logo.

## Evidence on Hand

- Real tagged matches in `../laureats-tagger/exports/` (Vanier 2026-09-26 2–1, Montmorency 2026-09-18 3–2, Trois-Rivières 2026-09-11 2–0, Vanier 2026-08-23 3–0, UdeS 2026-08-07 1–2).
- Current staff dashboards for reference: `../laureats-tagger/dashboard_vanier2.html`, `dashboard_montmorency.html`.
- No logo file or shirt photos yet (the user will add them, e.g. `dashboard/public/logo.png`), no testimonials or player data – don't invent them.

## Product Principles

1. From number to video in one click: every finding that can be tied to a moment links to it.
2. Dense and technical: every stat the tagging can honestly support, in coaching language, organised so each tab still leads with its key figures (user decision, 2026-09-30).
3. Honest about uncertainty: small samples and inferred data are labelled, never hidden.
4. Automatic by default: nothing a coach sees should require the analyst to rebuild it per match.
5. Works as well on a phone before training as on a laptop at the desk.

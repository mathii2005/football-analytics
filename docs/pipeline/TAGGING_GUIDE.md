# Tagging guide — the exact order

For retagging this season's matches and every new match. The definitions are the codebook's (CODEBOOK §3, §5); this guide only fixes **the order of the presses** and the **anchor moment** of each one.

## Why this guide exists

On Ahuntsic, 31 of the 52 reviewed live entries were marked « pas une entrée ». Most of them were not tagging errors:

- **24 of the 31 were zone 3 → 4 entries** rejected because only box entries were thought to count. **An entry is any move of our ball into the red zone: zone 3 → 4, or into the box (5).** Both create an « Entrée » card; the card header says which one (« Zone 3 → 4 » or « Zone 4 → 5 »).
- **7 were box entries that did not happen**, mostly crosses or long balls into the box that nobody of ours controlled.

So two rules: answer zone-4 entries like box entries, and **press what has happened, never what is about to happen.**

## The clock and Veo

- **Veo's on-screen match clock is not our clock.** It carries first-half stoppage time over: the second half can start at 47:00 on Veo, while our tagger always starts it at 45:00 (`M`). **Never sync the tagger clock to Veo's on-screen clock** in the second half; on Ahuntsic this put every second-half time 2 minutes ahead.
- **When the Veo video skips or you jump ahead in it, never reset the tagger clock.** Keep the clock running, press **`T`** (« J'ai perdu le fil ») where the skip starts and again when play comes back on screen. The skipped stretch is marked unknown (no possession credited to anyone, a gap card in the review) and every later time stays aligned with the video. On Ahuntsic the video skipped from 105:51 to 109:00; the clock was reset instead, and every later tag sat 3:01 too early until it was fixed by hand.
- **The match sheet's Veo kick-offs are video times** (the position in the recording, e.g. 23:14 and 83:36), not Veo's match clock. If a half's clips land off by a constant amount, change that half's kick-off in the match sheet rather than the tags.

## The two anchors

1. **Possession (`Q` / `W`) = a controlled touch.** A player of that team has the ball under control: a touch that keeps the ball (controls it, carries it, or plays a deliberate pass). Not a deflection, not a block, not a header that only clears, not a 50/50 still in the air.
2. **Zone (`0`–`5`) = where the team in possession controls the ball.** A player receives the ball in that band, or carries it over the line. **A ball in flight changes nothing**: long balls, crosses, clearances and shots are pressed (or not) only where they land under control.

## The order, situation by situation

| Situation | Press, in this order | Do not press |
|---|---|---|
| **We win the ball** | `Q` at the first controlled touch → then the zone of that touch | Nothing on a deflection or a block. A 50/50: wait for the control |
| **They win the ball** | `W` at their first controlled touch → then the zone of that touch | Our bad pass that they touch but don't control, and that comes back to us: nothing |
| **We move the ball into a new band** | The new zone when one of our players **controls** it there (receives, or carries over the line) | The zone where the pass is aimed |
| **Box entry (5)** | `5` only when one of our players **touches the ball inside their box** (receives, carries in, or shoots from inside) | A cross into the box that the keeper catches or a defender clears first: that is `W` (then `5`, it is still their box), not our entry |
| **Long ball / cross that goes out** | `E` when it crosses the line | No zone for where it was aimed |
| **Shot** | **The zone where the shot is struck** (a shot counts as a touch, even a first-time header after a long ball) → `Z` / `X` / `C` at the strike | Shooting without the zone: the shot's team comes from the zone, so a header in their box after a long ball from zone 2 would be counted as theirs |
| **After a shot** | Out: `E`. Keeper holds it: `W` (their keeper has the ball, the zone stays 5). Rebound we win: `Q` | |
| **Goal** | `C` only (dead ball and kick-off are automatic) | `E` |
| **Ball out / whistle** | `E` → restart key (`A` touche, `S` corner, `D` coup franc / hors-jeu, `F` 6 m, `Shift+D` penalty) → zone of the restart for `A` and `D` (prompted) → `Q`/`W` at the first touch of the restart | |
| **Something to look at later** | `R` (flag), any time after the moment | It never changes possession |
| **You lost the thread** | `T`, and again `T` (or the next `Q`/`W`/`E`) when you are back | Guessing |

**If a shot still ends up on the wrong team**, open it in the journal and switch « Équipe » (Lauréats / Adversaire); the choice is kept even if you move its time. The journal also lets you change the half of a line (a half can run past 45:00).

**Within the same instant, possession comes before the zone.** The engine counts an entry for the team that has the ball when the zone is pressed: `Q` then `4` is our entry, `4` then `Q` is not.

## Quick self-check during the match

- If you are about to press a zone, ask: *does one of their players or ours have the ball at their feet there?* If not, wait.
- If you are about to press `Q`/`W`, ask: *did they keep it?* If the ball is still bouncing between players, wait.
- Pressing late by a second is fine (the review moves moments with `V`). Pressing a zone the ball never reached is not: it creates a ghost entry.

## The review cards (pass 2)

Every card shows the definition of each answer under the active question. Summary:

| Card | When | Questions |
|---|---|---|
| **Tir / But** | every shot, both teams | lieu (6 m · surface axe · surface côté · hors surface axe · hors surface côté) · surface de contact · situation (jeu · contre ≤ 10 s · CPA ≤ 20 s · penalty) · passe décisive (profondeur · retrait · centre · intérieur · ballon de CPA · rebond · solo · récupération directe · aucune) · couloir du passeur · **our shots: tireur, passeur (search)** · goals add phase and the lane where the ball entered the box |
| **À revoir** | every `R` | type (occasion sans tir · duel clé · erreur · combinaison CPA · autre) · couloir |
| **Entrée** | our band 3 → 4 (red zone) **or** into 5 (box): both are entries | couloir · méthode (passe · conduite · centre · CPA · ballon libre) · reçu entre les lignes · issue en 15 s · **joueur qui entre** |
| **Perte** | our loss in bands 3–5 | que tentait-on · couloir visé · cause · joueurs qui ferment en 3 s · récupéré en 5 s (prérempli) · **joueur qui perd · premier presseur** |
| **CPA** (theme) | corner / free kick in the attacking zones | livraison · premier contact · **our set pieces: tireur** |
| **Duel** (theme) | flags answered « duel clé » | résultat · course de repli · **notre joueur** |
| **Entrée adverse** (theme) | their band into 0 | couloir · méthode |

Every card except Trou has « erreur de tag » (key `N`).

**Player questions:** type a number or part of a name, `Entrée` picks the first match. « Aucun » where it makes sense, `Je ne vois pas` otherwise. The squad list is entered once on the start screen (« Effectif »), kept on this computer and copied into each match file. It never goes into the public repository.

**Description mode (next 3 matches):** every card also asks « Décris ce qui s'est passé ». Write it in your own words (who, what, where, how it ended); `⌘/Ctrl + Entrée` saves and opens the next card. After 3 matches the descriptions are read to add the missing answer options and remove the unused ones, then the mode is switched off (checkbox « Mode description » in the review header).

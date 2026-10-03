// Pure navigation logic: which clip-library filter a stat opens, and when
// the preset is dropped. No football definitions here - categories and
// zones come from the API. Tested in dashboard/tests/links.test.js.
import { pct } from "./format.js";

// funnel stage -> library categories (counts match the funnel numbers)
export const FUNNEL_CLIPS = { "Entrées surface": ["box_entry"], Tirs: ["shot"], "Cadrés": ["shot_on_target"], Buts: ["goal_for"] };

// a counter-press zone row shows "n pertes": open those n losses
export const counterPressPreset = (zone) => ({ cats: ["loss"], zone });

// text between two funnel stages
export function funnelStep(prevN, n) {
  if (!prevN) return "–";
  if (n > prevN) return "des tirs arrivent sans entrée surface taguée";
  return pct(n / prevN);
}

// preset lifecycle: set by openClips, dropped by any plain tab move or match change
export function nextPreset(current, action) {
  if (action.type === "open") return { ...action.preset, key: action.key };
  return null;
}

// this match's season profile, found through any of its export files; null
// when the season is unavailable or the match has no profile
export function profileFor(season, matchId) {
  return season?.matches?.find((m) => (m.ids ?? [m.id]).includes(matchId))?.metrics ?? null;
}

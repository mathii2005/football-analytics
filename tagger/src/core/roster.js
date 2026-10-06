// The squad (our players and their numbers). It stays on this computer
// (localStorage) and is copied into each match file at export; it never goes
// to the public repository. Review cards answer "who?" with a jersey number.
const KEY = "laureats.roster";

const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// "10 Léo Tremblay", "7, Samuel Côté", "4 - Marc-André Roy": number first, one per line.
// Lines without a leading number are ignored; a number seen twice keeps its first name.
export function parseRoster(text) {
  const seen = new Map();
  for (const line of (text || "").split(/\r?\n/)) {
    const m = line.trim().match(/^(\d{1,3})\s*[,;:\-–.]?\s*(.+)$/);
    if (m && !seen.has(m[1])) seen.set(m[1], { num: m[1], name: m[2].trim() });
  }
  return [...seen.values()].sort((a, b) => Number(a.num) - Number(b.num));
}

export const rosterText = (roster) => roster.map((p) => `${p.num} ${p.name}`).join("\n");

// exact number first, then numbers starting with the query, then names (accents ignored)
export function searchRoster(roster, query) {
  const q = fold((query || "").trim());
  if (!q) return roster;
  const exact = roster.filter((p) => p.num === q);
  const byNum = roster.filter((p) => p.num !== q && p.num.startsWith(q));
  const byName = roster.filter((p) => !p.num.startsWith(q) && fold(p.name).includes(q));
  return [...exact, ...byNum, ...byName];
}

export function playerLabel(roster, num) {
  const p = roster.find((x) => x.num === String(num));
  return p ? `#${p.num} ${p.name}` : `#${num}`;
}

export function loadRoster() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function saveRoster(roster) {
  try { localStorage.setItem(KEY, JSON.stringify(roster)); } catch { /* private window */ }
}

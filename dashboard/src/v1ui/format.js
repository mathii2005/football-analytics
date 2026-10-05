// Formatting of v1 metrics (values come from /matches/{id}/metrics; no football
// logic here). The unit decides the format.
import { pct, dec } from "../format.js";

export function fmtValue(m) {
  if (!m || m.value == null || typeof m.value === "object") return "–";
  const v = m.value, u = m.unit || "";
  if (u === "%") return pct(v);
  if (u === "s") return `${dec(v)} s`;
  if (u.startsWith("xG") || u.startsWith("xT")) return v.toFixed(2);
  if (u.startsWith("/10")) return dec(v);
  if (u === "players / %") return dec(v);
  return Number.isInteger(v) ? String(v) : dec(v);
}

export function subline(m) {
  if (!m) return "";
  const bits = [`n = ${m.n}`];
  if (m.coverage != null) bits.push(`revu ${pct(m.coverage)}`);
  if (m.status && m.status !== "ok") bits.push(m.status);
  return bits.join(" · ");
}

export const STATUS = {
  "AMÉLIORÉ": { icon: "▲", cls: "bg-[#e3f1e8] text-[#1d5a37]", label: "Amélioré" },
  "EN BAISSE": { icon: "▼", cls: "bg-[#f6e3df] text-[#7c2a1d]", label: "En baisse" },
  "STABLE": { icon: "=", cls: "bg-paper-2 text-ink-2", label: "Stable" },
  "TROP TÔT": { icon: "…", cls: "bg-paper-2 text-ink-3", label: "Trop tôt" },
};

export const GROUP_FR = { identite: "Identité", phases: "Phases", xt: "Progression dangereuse", couloir_interieur: "Couloir intérieur",
  zone_rouge: "Zone rouge et 18 m", intensite: "Intensité" };

export const LANE_FR = { L: "Couloir gauche", HS_L: "Intérieur gauche", C: "Axe", HS_R: "Intérieur droit", R: "Couloir droit", "?": "Couloir inconnu" };
export const PHASE_FR = { TRANSITION: "Transition", BUILD_UP: "Construction", SETTLED: "Attaque placée", SET_PIECE: "CPA", "?": "Phase inconnue" };
export const CAUSE_FR = { INTERCEPTED: "Passe interceptée", TACKLED: "Taclé", BAD_TOUCH: "Mauvais contrôle", OUT: "Sortie", FOUL: "Faute" };
export const INTENT_FR = { PASS_INTO_HS: "Passe dans l'intérieur", THROUGH: "Passe en profondeur", CROSS: "Centre", DRIBBLE: "Dribble",
  SHORT_COMBINATION: "Combinaison courte", SWITCH: "Changement de jeu", CLEARANCE_LONG: "Dégagement long", OTHER: "Autre" };
export const METHOD_FR = { PASS: "Passe", CARRY: "Conduite", CROSS: "Centre", SET_PIECE: "CPA", LOOSE: "Ballon libre" };

export function toCsv(m) {
  const rows = [["métrique", "valeur", "n", "couverture", "statut"], [m.label_fr, m.value ?? "", m.n, m.coverage ?? "", m.status]];
  rows.push([], ["mi-temps", "temps (ms)", "moment", "lien Veo"]);
  for (const c of m.clips?.all || []) rows.push([c.half, c.t, c.what, c.url || ""]);
  return rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
}

// Lineup and substitutions (match sheet): starters, then who came on / off at
// what match time. The engine turns them into minutes played per player.
import { CODEBOOK } from "./codebook.js";
import { parseMmSs, fmtMmSs } from "../ui/util.js";

const H2 = CODEBOOK.clock.half2_start_ms;

export function subFromForm({ in: inn, out, half, at }) {
  if (!String(inn || "").trim() || !String(out || "").trim()) return { error: "Indique qui entre et qui sort" };
  const t = parseMmSs(at);
  if (t === null) return { error: "Temps au format mm:ss" };
  if (Number(half) === 2 && t < H2) return { error: "En 2e mi-temps, le temps commence à 45:00" };
  return { in: String(inn).trim(), out: String(out).trim(), half: Number(half), t };
}

export function checkLineup(lineup) {
  const problems = [];
  const starters = lineup?.starters || [];
  if (starters.length !== 11) problems.push(`${starters.length} titulaires (11 attendus)`);
  const on = new Set(starters);
  for (const s of [...(lineup?.subs || [])].sort((a, b) => a.half - b.half || a.t - b.t)) {
    if (!on.has(s.out)) problems.push(`#${s.out} sort sans être sur le terrain (${fmtMmSs(s.t)})`);
    if (on.has(s.in)) problems.push(`#${s.in} entre alors qu'il est déjà sur le terrain (${fmtMmSs(s.t)})`);
    on.delete(s.out); on.add(s.in);
  }
  return problems;
}

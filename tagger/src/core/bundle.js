// Export / import of a match as one JSON file (PIPELINE §3.3).
import { CB_VERSION } from "./codebook.js";

export function buildBundle(meta, events, reviewed, now = new Date()) {
  return { schema_version: "1.0", tagger_version: "two-pass@1.0.0", codebook_version: CB_VERSION,
           exported_at: now.toISOString(), meta, events, reviewed };
}

export function bundleFileName(meta) {
  const opp = (meta.opponent || "adversaire").trim().replace(/\s+/g, "-");
  return `laureats_${meta.date || "sans-date"}_${opp}_v1.json`;
}

export function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { kind: "error", error: "Fichier JSON illisible" }; }
  if (data && String(data.schema_version || "").startsWith("1.") && Array.isArray(data.events) && data.meta)
    return { kind: "v1", meta: data.meta, events: data.events, reviewed: data.reviewed || [] };
  if (data && Array.isArray(data.events) && data.match) return { kind: "v0", raw: data };
  return { kind: "error", error: "Format non reconnu" };
}

// ---- merging two exports of the same match, half by half ----
import { retractedSet } from "./session.js";

const PRESS = new Set(["S", "Z", "R", "SH", "F", "LOST"]);

// Match presses kept (not cancelled, not automatic) per half.
export function halfStats(b) {
  const gone = retractedSet(b.events);
  const out = { 1: 0, 2: 0 };
  for (const o of b.events) if (PRESS.has(o.k) && !o.auto && !gone.has(o.seq)) out[o.half] = (out[o.half] || 0) + 1;
  return out;
}

// For each half, the export with more presses (ties: the first one).
export function defaultPick(a, b) {
  const sa = halfStats(a), sb = halfStats(b);
  return { 1: sb[1] > sa[1] ? "b" : "a", 2: sb[2] > sa[2] ? "b" : "a" };
}

// Keep each half from the export picked for it. B's lines are renumbered after
// A's, with their links (U targets, src, edit_of, review card ids) remapped.
export function mergeExports(a, b, pick) {
  const fromA = a.events.filter((o) => pick[o.half] === "a");
  let next = a.events.reduce((m, o) => Math.max(m, o.seq), 0) + 1;
  const map = new Map();
  const fromBRaw = b.events.filter((o) => pick[o.half] === "b").sort((x, y) => x.seq - y.seq);
  for (const o of fromBRaw) map.set(o.seq, next++);
  const re = (s) => (map.has(s) ? map.get(s) : s);
  const fromB = fromBRaw.map((o) => ({ ...o, seq: map.get(o.seq),
    ...(o.k === "U" ? { v: re(o.v) } : {}), ...(o.src !== undefined ? { src: re(o.src) } : {}),
    ...(o.edit_of !== undefined ? { edit_of: re(o.edit_of) } : {}) }));

  const keptA = new Set(fromA.map((o) => o.seq));
  const blockHalf = (card) => /^GAP:block:(\d)/.exec(card)?.[1];
  const revA = (a.reviewed || []).filter((r) => (r.seq != null && keptA.has(r.seq)) || pick[blockHalf(r.card)] === "a");
  const revB = (b.reviewed || []).filter((r) => (r.seq != null && map.has(r.seq)) || pick[blockHalf(r.card)] === "b")
    .map((r) => (r.seq != null && map.has(r.seq) ? { ...r, seq: map.get(r.seq), card: r.card.replace(/:(\d+)$/, `:${map.get(r.seq)}`) } : r));

  const va = a.meta.veo || {}, vb = b.meta.veo || {};
  const off = (h) => { const k = `offset_h${h}_ms`; const first = pick[h] === "b" ? vb : va, other = pick[h] === "b" ? va : vb; return first[k] ?? other[k] ?? null; };
  const meta = { ...a.meta, veo: { ...va, url: va.url || vb.url || "", offset_h1_ms: off(1), offset_h2_ms: off(2), checked: false },
    history: [...(a.meta.history || []), { at: new Date().toISOString(), field: "merge", from: { a: halfStats(a), b: halfStats(b) }, to: pick }] };
  const events = [...fromA, ...fromB].sort((x, y) => x.seq - y.seq);
  return { meta, events, reviewed: [...revA, ...revB] };
}

// The codebook (shared/codebook.v1.json) drives every key, label and rule.
import cb from "../../../shared/codebook.v1.json" with { type: "json" };

export const CODEBOOK = cb;
export const CB_VERSION = cb.version;
export const MATCH_KINDS = new Set(["S", "Z", "R", "SH", "F", "LOST"]);

// "S:US" -> {k: "S", v: "US"}, "Z:3" -> {k: "Z", v: 3}, "F" -> {k: "F", v: null}
export function parseCode(code) {
  const [k, raw] = code.split(":");
  if (raw === undefined) return { k, v: null };
  return { k, v: k === "Z" ? Number(raw) : raw };
}

export const MATCH_KEYS = Object.fromEntries(cb.keys.match.map((m) => [m.key, { ...parseCode(m.code), label: m.label_fr, definition: m.definition }]));

const LABELS = Object.fromEntries(cb.keys.match.map((m) => [m.code, m.label_fr]));
export function opLabel(o) {
  if (o.k === "R" && o.v === "KICKOFF") return "Engagement";
  const code = o.v === null || o.v === undefined ? o.k : `${o.k}:${o.v}`;
  return LABELS[code] ?? code;
}

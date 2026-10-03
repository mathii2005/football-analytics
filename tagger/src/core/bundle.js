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

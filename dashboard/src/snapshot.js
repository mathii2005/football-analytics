// Staff export: the whole dashboard of one match frozen in one HTML page.
// tools/export_snapshot.py embeds every API answer the pages need in
// <script id="snapshot-data" type="application/json">; api.js then reads from
// it instead of calling /api, and editing / the analyst page are switched off.
function canonical(path) {
  const [base, query] = path.split("?");
  if (!query) return base;
  const params = new URLSearchParams(query);
  return `${base}?${[...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&")}`;
}

export function lookup(snapshot, path) {
  const want = canonical(path);
  for (const [p, value] of Object.entries(snapshot.paths || {})) if (canonical(p) === want) return value;
  throw new Error("pas dans cet export");
}

function read() {
  if (typeof document === "undefined") return null;
  const el = document.getElementById("snapshot-data");
  if (!el) return null;
  try { return JSON.parse(el.textContent); } catch { return null; }
}

export const SNAPSHOT = read();

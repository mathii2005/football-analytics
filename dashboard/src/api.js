// Thin client for the analytics API. Every number shown in the dashboard
// comes from here - no football logic in the frontend.

async function get(path) {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${path})`);
  return res.json();
}

export const fetchMatches = () => get("/matches");

export async function fetchMatch(id) {
  const m = encodeURIComponent(id);
  const [report, possessions, losses, quality, clips, phases, timeline, season] = await Promise.all([
    get(`/matches/${m}/report`),
    get(`/matches/${m}/possessions`),
    get(`/matches/${m}/losses`),
    get(`/matches/${m}/quality`),
    get(`/matches/${m}/clips`),
    get(`/matches/${m}/phases`),
    get(`/matches/${m}/timeline`),
    // the season baseline is optional: if it fails only the radar and
    // bullets say "indisponible", the match page still loads
    get("/season").catch(() => null),
  ]);
  // v1 matches (two-pass tagger): the metric catalogue and the v1 season
  const v1 = await get(`/matches/${m}/metrics`).catch(() => ({ available: false }));
  const [seasonV1, recap] = v1.available
    ? await Promise.all([get("/season/v1").catch(() => null), get(`/matches/${m}/recap`).catch(() => null)])
    : [null, null];
  return { report, possessions, losses, quality, clips, phases, timeline, season, v1, seasonV1, recap };
}

// v1 filters: one half of a match, or the season against one tier / at one venue
export const fetchMetrics = (id, half) => get(`/matches/${encodeURIComponent(id)}/metrics${half ? `?half=${half}` : ""}`);
export const fetchSeasonV1 = ({ tier, venue } = {}) => {
  const q = new URLSearchParams(Object.entries({ tier, venue }).filter(([, v]) => v));
  return get(`/season/v1${q.toString() ? `?${q}` : ""}`);
};

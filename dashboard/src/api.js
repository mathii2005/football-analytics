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
  return { report, possessions, losses, quality, clips, phases, timeline, season };
}

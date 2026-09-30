// Thin client for the analytics API. Every number shown in the dashboard
// comes from here - no football logic in the frontend.

async function get(path) {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json();
}

export const fetchMatches = () => get("/matches");

export async function fetchMatch(id) {
  const m = encodeURIComponent(id);
  const [summary, possessions, losses, quality] = await Promise.all([
    get(`/matches/${m}/summary`),
    get(`/matches/${m}/possessions`),
    get(`/matches/${m}/losses`),
    get(`/matches/${m}/quality`),
  ]);
  return { summary, possessions, losses, quality };
}

// Thin client for the analytics API. Every number shown in the dashboard
// comes from here - no football logic in the frontend.

import { stripVeo } from "./veo.js";

async function get(path) {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${path})`);
  return stripVeo(await res.json());
}

export const fetchMatches = () => get("/matches");

export async function fetchMatch(id) {
  const m = encodeURIComponent(id);
  const v1 = await get(`/matches/${m}/metrics`);
  // optional parts: if one fails, the pages that need it hide their tiles
  const [seasonV1, recap, details, possessions] = await Promise.all([
    get("/season/v1").catch(() => null),
    get(`/matches/${m}/recap`).catch(() => null),
    get(`/matches/${m}/details`).catch(() => null),
    get(`/matches/${m}/possessions`).catch(() => null),
  ]);
  return { v1, seasonV1, recap, details, possessions };
}

// v1 filters: one half of a match, or the season against one tier / at one venue
export const fetchMetrics = (id, half) => get(`/matches/${encodeURIComponent(id)}/metrics${half ? `?half=${half}` : ""}`);
export const fetchSeasonV1 = ({ tier, venue } = {}) => {
  const q = new URLSearchParams(Object.entries({ tier, venue }).filter(([, v]) => v));
  return get(`/season/v1${q.toString() ? `?${q}` : ""}`);
};

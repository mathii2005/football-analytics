// Thin client for the analytics API. Every number shown in the dashboard
// comes from here - no football logic in the frontend.

import { stripVeo } from "./veo.js";
import { SNAPSHOT, lookup } from "./snapshot.js";

async function get(path) {
  if (SNAPSHOT) return stripVeo(lookup(SNAPSHOT, path));     // staff export: no server
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${path})`);
  return stripVeo(await res.json());
}

export const fetchMatches = () => get("/matches");

export async function fetchMatch(id) {
  const m = encodeURIComponent(id);
  const v1 = await get(`/matches/${m}/metrics`);
  // optional parts: if one fails, the pages that need it hide their tiles
  const [seasonV1, recap, details, possessions, texts] = await Promise.all([
    get("/season/v1").catch(() => null),
    get(`/matches/${m}/recap`).catch(() => null),
    get(`/matches/${m}/details`).catch(() => null),
    get(`/matches/${m}/possessions`).catch(() => null),
    get(`/matches/${m}/texts`).catch(() => null),
  ]);
  return { v1, seasonV1, recap, details, possessions, texts };
}

// v1 filters: one half of a match, or the season against one tier / at one venue
export const fetchMetrics = (id, half) => get(`/matches/${encodeURIComponent(id)}/metrics${half ? `?half=${half}` : ""}`);
export const fetchSeasonV1 = ({ tier, venue } = {}) => {
  const q = new URLSearchParams(Object.entries({ tier, venue }).filter(([, v]) => v));
  return get(`/season/v1${q.toString() ? `?${q}` : ""}`);
};

// the sentences of the dashboard: the analyst's own version of one (empty = back to the generated one)
export async function saveText(id, key, text) {
  if (SNAPSHOT) throw new Error("Lecture seule");
  const res = await fetch(`/api/matches/${encodeURIComponent(id)}/texts/${encodeURIComponent(key)}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return get(`/matches/${encodeURIComponent(id)}/texts`);
}

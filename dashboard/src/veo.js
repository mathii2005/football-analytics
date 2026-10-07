// Veo links on / off. Off from 2026-10-06 to 2026-10-07 while the second-half
// offsets of Ahuntsic were unknown; back on once both kick-offs are entered
// (MT1 23:14, MT2 83:36). Switch to false if a match's clips land off.
export const SHOW_VEO = true;

const LINK_KEYS = new Set(["url", "video_url", "veo_url"]);

// a copy of an API payload without its Veo links (unchanged when links are on)
export function stripVeo(data, show = SHOW_VEO) {
  if (show) return data;
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).filter(([k]) => !LINK_KEYS.has(k)).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return walk(data);
}

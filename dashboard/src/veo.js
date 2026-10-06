// Veo links on / off. Off since 2026-10-06: the second half of Ahuntsic was not
// tagged in sync with Veo, so links would land on the wrong moment. Turn back
// on once the Veo offsets are set in the tagger.
export const SHOW_VEO = false;

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

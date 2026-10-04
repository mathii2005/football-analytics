// Veo positions (CODEBOOK §2): same formula as the engine (src/analytics/video.py),
// with the codebook's clip lead (5 s).
import { CODEBOOK } from "./codebook.js";

const HALF2 = CODEBOOK.clock.half2_start_ms;

export function videoMs(veo, half, t) {
  if (half === 2 && veo?.offset_h2_ms != null) return veo.offset_h2_ms + (t - HALF2);
  if (veo?.offset_h1_ms == null) return null;
  return veo.offset_h1_ms + t;
}

export function liveFromVideo(veo, half, v) {
  if (half === 2 && veo?.offset_h2_ms != null) return v - veo.offset_h2_ms + HALF2;
  if (veo?.offset_h1_ms == null) return null;
  return v - veo.offset_h1_ms;
}

export function veoLink(veo, half, t, leadMs = CODEBOOK.clock.clip_lead_ms) {
  if (!veo?.url) return null;
  const pos = videoMs(veo, half, t);
  if (pos == null) return null;
  const s = Math.max(0, Math.floor((pos - leadMs) / 1000));
  return `${veo.url.split("#")[0]}#t=${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

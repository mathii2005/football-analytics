// Data palette (validated with the dataviz validator on #fff: all checks pass).
// Chrome keeps the brand black / white / #c79741; these are for marks only.
export const US = "#b8862e";        // Lauréats
export const THEM = "#2a6aa8";      // opponent
export const MID = "#e8e6e1";       // diverging midpoint / empty
export const INK = "#0a0a0a";
export const GRID = "#e5e3de";
export const MUTED = "#6f6c66";

const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const rgb = (a) => `rgb(${a.join(",")})`;

// sequential ramps from near-white to a deep step of the hue (t in 0..1)
export const goldRamp = (t) => rgb(lerp(hex("#f7f1e3"), hex("#7a5512"), Math.max(0, Math.min(1, t))));
export const blueRamp = (t) => rgb(lerp(hex("#eaf1f8"), hex("#163f6b"), Math.max(0, Math.min(1, t))));
// diverging: -1 (blue) .. 0 (mid) .. +1 (gold)
export const diverging = (t) => (t >= 0 ? rgb(lerp(hex(MID), hex("#8a6117"), Math.min(1, t)))
  : rgb(lerp(hex(MID), hex("#1f4f80"), Math.min(1, -t))));
export const inkOn = (t) => (t > 0.55 ? "#fff" : INK);   // label colour on a ramp cell

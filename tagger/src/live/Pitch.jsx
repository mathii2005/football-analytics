import { CODEBOOK } from "../core/codebook.js";

// Clickable pitch: the six bands of the codebook (CODEBOOK §1.1) drawn on a
// 105 x 68 m pitch, our goal on the left. With Inverser on, the drawing is
// mirrored so the analyst clicks what they see; the band sent is always the
// absolute one.
const P = CODEBOOK.geometry.pitch_reference_m;
const BOX_Y = [(P.width - P.box_width) / 2, (P.width + P.box_width) / 2];
const SIX_Y = [(P.width - P.six_width) / 2, (P.width + P.six_width) / 2];
const AREAS = [
  { band: 1, x: [0, 26.25], y: [0, P.width] },
  { band: 2, x: [26.25, 52.5], y: [0, P.width] },
  { band: 3, x: [52.5, 78.75], y: [0, P.width] },
  { band: 4, x: [78.75, 105], y: [0, P.width] },
  { band: 0, x: [0, P.box_depth], y: BOX_Y },                 // boxes drawn last, on top
  { band: 5, x: [P.length - P.box_depth, P.length], y: BOX_Y },
];
const NAMES = Object.fromEntries(CODEBOOK.geometry.bands.map((b) => [b.id, b.name_fr]));
const PAD = 3;

export default function Pitch({ band, flip, ask, onBand }) {
  const mx = (x) => (flip ? P.length - x : x);
  const rect = (a) => {
    const x1 = Math.min(mx(a.x[0]), mx(a.x[1]));
    return { x: x1, y: a.y[0], width: a.x[1] - a.x[0], height: a.y[1] - a.y[0] };
  };
  const line = { stroke: "#ffffff", strokeOpacity: 0.85, strokeWidth: 0.35, fill: "none" };
  const L = P.length, W = P.width;

  return (
    <div>
      <div className="mb-1 flex h-7 items-center justify-between text-xs text-ink-3">
        <span>{flip ? "Attaque ←  (zones inversées)" : "Notre but"}</span>
        {ask && <span className="rounded bg-us px-3 py-1 text-sm font-semibold text-paper shadow">{ask}</span>}
        <span>{flip ? "Notre but" : "→ Attaque"}</span>
      </div>
      <svg viewBox={`${-PAD} ${-PAD} ${L + 2 * PAD} ${W + 2 * PAD}`} className={`mx-auto block h-[34vh] max-w-full rounded ${ask ? "ring-4 ring-us animate-pulse" : ""}`} role="img" aria-label="Terrain, cliquer une zone">
        <rect x={-PAD} y={-PAD} width={L + 2 * PAD} height={W + 2 * PAD} fill="#356b42" />
        {AREAS.map((a) => (
          <rect key={a.band} {...rect(a)} onClick={() => onBand(a.band)}
            className="cursor-pointer transition-opacity hover:opacity-80"
            fill={band === a.band ? "#b8862e" : a.band === 0 || a.band === 5 ? "#3f7a4d" : a.band % 2 ? "#3a7348" : "#356b42"}
            fillOpacity={band === a.band ? 0.95 : 1} />
        ))}
        {/* markings */}
        <rect x={0} y={0} width={L} height={W} {...line} />
        <line x1={L / 2} y1={0} x2={L / 2} y2={W} {...line} />
        <circle cx={L / 2} cy={W / 2} r={9.15} {...line} />
        {[0, L - P.box_depth].map((x) => <rect key={`b${x}`} x={x} y={BOX_Y[0]} width={P.box_depth} height={P.box_width} {...line} />)}
        {[0, L - 5.5].map((x) => <rect key={`s${x}`} x={x} y={SIX_Y[0]} width={5.5} height={P.six_width} {...line} />)}
        {[26.25, 78.75].map((x) => <line key={`q${x}`} x1={x} y1={0} x2={x} y2={W} {...line} strokeDasharray="1.2 1.2" strokeOpacity={0.5} />)}
        {/* labels (never mirrored) */}
        {AREAS.map((a) => {
          const cx = mx((a.x[0] + a.x[1]) / 2);
          const cy = a.band === 0 || a.band === 5 ? W / 2 : a.band % 2 ? 9 : W - 9;
          return (
            <g key={`t${a.band}`} pointerEvents="none">
              <text x={cx} y={cy} textAnchor="middle" fontSize="6" fontWeight="700" fill="#ffffff">{a.band}</text>
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize="2.3" fill="#ffffff" fillOpacity="0.85">{NAMES[a.band]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

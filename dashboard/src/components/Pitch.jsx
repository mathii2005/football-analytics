// Vertical pitch (attack upward) used by the Terrain views. Zones 1–4 are
// equal quarters from our goal (bottom) to theirs (top); the box sits inside
// zone 4. Children draw inside the same 300 × 420 coordinate system.
export const W = 300;
export const H = 420;
export const ZONE_Y = { 4: [0, 105], 3: [105, 210], 2: [210, 315], 1: [315, 420] };
export const BOX = { x: 60, y: 0, w: 180, h: 66 };
export const COL_X = { left: [0, 100], center: [100, 200], right: [200, 300] };

export default function Pitch({ children, label }) {
  const line = "var(--ink)";
  return (
    <svg viewBox={`-14 -6 ${W + 28} ${H + 12}`} className="h-auto w-full max-w-[22rem]" role="img" aria-label={label}>
      <rect x={0} y={0} width={W} height={H} fill="var(--paper-2)" />
      {children}
      <g fill="none" stroke={line} strokeWidth={1.2} opacity={0.75} pointerEvents="none">
        <rect x={0} y={0} width={W} height={H} />
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} />
        <circle cx={W / 2} cy={H / 2} r={34} />
        <rect x={BOX.x} y={0} width={BOX.w} height={BOX.h} />
        <rect x={110} y={0} width={80} height={22} />
        <rect x={BOX.x} y={H - BOX.h} width={BOX.w} height={BOX.h} />
        <rect x={110} y={H - 22} width={80} height={22} />
      </g>
      <g stroke={line} strokeWidth={0.8} strokeDasharray="3 4" opacity={0.35} pointerEvents="none">
        <line x1={0} y1={105} x2={W} y2={105} /><line x1={0} y1={315} x2={W} y2={315} />
      </g>
      <g fontSize={10} fill="var(--ink-3)" fontFamily="Barlow Condensed" letterSpacing="0.05em">
        <text x={-10} y={55} textAnchor="middle" transform="rotate(-90 -10 55)">Z4</text>
        <text x={-10} y={160} textAnchor="middle" transform="rotate(-90 -10 160)">Z3</text>
        <text x={-10} y={265} textAnchor="middle" transform="rotate(-90 -10 265)">Z2</text>
        <text x={-10} y={370} textAnchor="middle" transform="rotate(-90 -10 370)">Z1</text>
        <text x={W + 10} y={H / 2} textAnchor="middle" transform={`rotate(90 ${W + 10} ${H / 2})`}>SENS DE L'ATTAQUE ↑</text>
      </g>
    </svg>
  );
}

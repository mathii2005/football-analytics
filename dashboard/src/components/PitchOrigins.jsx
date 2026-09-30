import Pitch, { ZONE_Y, BOX, COL_X } from "./Pitch.jsx";

// Where our dangerous actions happened: couloir (column) × arrival zone
// (row), one-hue gold ramp, count printed. Box actions are drawn as three
// cells inside the penalty area, nested in zone 4.
const COLS = ["left", "center", "right"];

function fill(n, max) {
  if (!n) return "transparent";
  const t = 0.15 + 0.85 * (n / max);
  return `rgba(133,96,26,${t})`;
}

export default function PitchOrigins({ grid }) {
  const max = Math.max(1, ...COLS.flatMap((c) => Object.values(grid[c])));
  const cell = (x0, x1, y0, y1, n, key) => (
    <g key={key}>
      <rect x={x0 + 2} y={y0 + 2} width={x1 - x0 - 4} height={y1 - y0 - 4} rx={2} fill={fill(n, max)} />
      {n > 0 && <text x={(x0 + x1) / 2} y={(y0 + y1) / 2 + 6} textAnchor="middle" fontFamily="Barlow Condensed" fontWeight={600}
        fontSize={18} fill={n / max > 0.55 ? "#fff" : "var(--ink)"}>{n}</text>}
    </g>
  );
  const boxW = BOX.w / 3;
  return (
    <Pitch label="Origine des attaques par couloir et par zone">
      {["4", "3", "2", "1"].flatMap((z) => COLS.map((c) => {
        const [y0, y1] = ZONE_Y[z];
        return cell(COL_X[c][0], COL_X[c][1], z === "4" ? BOX.h : y0, y1, grid[c][z], `${c}${z}`);
      }))}
      {COLS.map((c, i) => cell(BOX.x + i * boxW, BOX.x + (i + 1) * boxW, 0, BOX.h, grid[c].BOX, `${c}BOX`))}
    </Pitch>
  );
}

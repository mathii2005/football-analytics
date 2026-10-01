import Pitch, { ZONE_Y, BOX, COL_X } from "../components/Pitch.jsx";
import { goldRamp, inkOn } from "./palette.js";

// Where our dangerous actions arrive: couloir (column) x zone (row), the
// box nested in zone 4. Single-hue ramp, count printed, empty cells left blank.
const COLS = ["left", "center", "right"];

export default function ZoneGridPitch({ grid }) {
  const max = Math.max(1, ...COLS.flatMap((c) => Object.values(grid[c])));
  const cell = (x0, x1, y0, y1, n, key) => {
    const t = n / max;
    return (
      <g key={key}>
        <rect x={x0 + 1.5} y={y0 + 1.5} width={x1 - x0 - 3} height={y1 - y0 - 3} rx={1.5} fill={n ? goldRamp(0.12 + 0.88 * t) : "transparent"}><title>{`${n} actions`}</title></rect>
        {n > 0 && <text pointerEvents="none" x={(x0 + x1) / 2} y={(y0 + y1) / 2 + 6} textAnchor="middle" fontFamily="Barlow Condensed" fontWeight={600} fontSize={18} fill={inkOn(0.12 + 0.88 * t)}>{n}</text>}
      </g>
    );
  };
  const bw = BOX.w / 3;
  return (
    <Pitch label="Arrivée des actions dangereuses par couloir et zone">
      {["4", "3", "2", "1"].flatMap((z) => COLS.map((c) => cell(COL_X[c][0], COL_X[c][1], z === "4" ? BOX.h : ZONE_Y[z][0], ZONE_Y[z][1], grid[c][z], `${c}${z}`)))}
      {COLS.map((c, i) => cell(BOX.x + i * bw, BOX.x + (i + 1) * bw, 0, BOX.h, grid[c].BOX, `${c}B`))}
    </Pitch>
  );
}

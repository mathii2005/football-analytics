import Pitch, { W, ZONE_Y, BOX } from "./Pitch.jsx";
import { signed } from "../format.js";

// Territorial balance on the pitch: each zone tinted by recoveries − losses
// (gold where we win the ball more, grey where we give it away), with the
// counts printed. The box row is drawn inside the penalty area.
function tint(balance, max) {
  const t = Math.min(1, Math.abs(balance) / max);
  return balance > 0 ? `rgba(133,96,26,${0.12 + 0.55 * t})` : balance < 0 ? `rgba(154,150,142,${0.15 + 0.6 * t})` : "transparent";
}

export default function PitchBalance({ zones }) {
  const by = Object.fromEntries(zones.map((z) => [z.zone, z]));
  const max = Math.max(1, ...zones.map((z) => Math.abs(z.balance)));
  return (
    <Pitch label="Bilan territorial par zone">
      {["4", "3", "2", "1"].map((k) => {
        const [y0, y1] = ZONE_Y[k], z = by[k];
        return (
          <g key={k}>
            <rect x={0} y={y0} width={W} height={y1 - y0} fill={tint(z.balance, max)} />
            <text x={W / 2} y={(y0 + y1) / 2 + (k === "4" ? 18 : 6)} textAnchor="middle" fontFamily="Barlow Condensed" fontWeight={600} fontSize={28} fill="var(--ink)">{signed(z.balance)}</text>
            <text x={W / 2} y={(y0 + y1) / 2 + (k === "4" ? 34 : 22)} textAnchor="middle" fontSize={10} fill="var(--ink-2)">{z.recups} récup · {z.losses} pertes</text>
          </g>
        );
      })}
      {by.BOX && (by.BOX.recups + by.BOX.losses > 0) && (
        <text x={BOX.x + BOX.w / 2} y={BOX.h / 2 + 4} textAnchor="middle" fontSize={11} fill="var(--ink)">Surface {signed(by.BOX.balance)}</text>
      )}
    </Pitch>
  );
}

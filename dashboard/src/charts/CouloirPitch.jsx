import Pitch, { H, COL_X } from "../components/Pitch.jsx";
import { goldRamp, inkOn, INK } from "./palette.js";
import { ACTION_TYPES, ACTION_LABELS, COULOIR_LABELS } from "../format.js";

// Couloir usage on the pitch: each lane shaded by its share of our
// dangerous actions, the share in big type, and an attacking arrow whose
// width is proportional to the share. Type breakdown under each lane.
const COLS = ["left", "center", "right"];

function Arrow({ cx, share }) {
  const w = 8 + 44 * share, head = w + 18;
  const yTop = 70, yBase = 360, yNeck = yTop + 34;
  const pts = [[cx - w / 2, yBase], [cx - w / 2, yNeck], [cx - head / 2, yNeck], [cx, yTop], [cx + head / 2, yNeck], [cx + w / 2, yNeck], [cx + w / 2, yBase]];
  return <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={INK} fillOpacity={0.14 + 0.5 * share} pointerEvents="none" />;
}

export default function CouloirPitch({ rows, onCouloir }) {
  const max = Math.max(0.01, ...rows.map((r) => r.share ?? 0));
  return (
    <div>
      <Pitch label="Utilisation des couloirs">
        {COLS.map((c) => {
          const r = rows.find((x) => x.couloir === c), [x0, x1] = COL_X[c];
          const t = (r?.share ?? 0) / max;
          return (
            <g key={c}>
              <rect x={x0} y={0} width={x1 - x0} height={H} fill={goldRamp(t * 0.85)} fillOpacity={0.9}
                {...(onCouloir ? { role: "button", tabIndex: 0, className: "cursor-pointer hover:opacity-80", onClick: () => onCouloir(c) } : {})}>
                <title>{`${COULOIR_LABELS[c]} : ${Math.round((r?.share ?? 0) * 100)} % (${r?.n ?? 0} actions)`}</title>
              </rect>
              <Arrow cx={(x0 + x1) / 2} share={r?.share ?? 0} />
              <text pointerEvents="none" x={(x0 + x1) / 2} y={292} textAnchor="middle" fontFamily="Barlow Condensed" fontWeight={700} fontSize={30} fill={inkOn(t * 0.85)}>
                {Math.round((r?.share ?? 0) * 100)}%</text>
              <text pointerEvents="none" x={(x0 + x1) / 2} y={310} textAnchor="middle" fontSize={10} fill={inkOn(t * 0.85)}>{r?.n ?? 0} actions</text>
            </g>
          );
        })}
      </Pitch>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        {COLS.map((c) => {
          const r = rows.find((x) => x.couloir === c);
          return (
            <div key={c} className="text-center">
              <div className="font-semibold text-ink">{COULOIR_LABELS[c]}</div>
              {ACTION_TYPES.filter((t) => r?.by_type[t]).map((t) => <div key={t} className="text-ink-3">{ACTION_LABELS[t]} {r.by_type[t]}</div>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

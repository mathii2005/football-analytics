import { goldRamp, inkOn } from "../charts/palette.js";

// Where do we enter the red zone? Our entries by lane (columns, our attacking
// direction left to right) and depth (zone 4 / their box), gold ramp, counts.
const LANES = [["L", "Gauche"], ["HS_L", "Int. gauche"], ["C", "Axe"], ["HS_R", "Int. droit"], ["R", "Droite"]];
export default function LaneGrid({ grid }) {
  const rows = [["5", "Surface"], ["4", "Zone 4"]];
  const vals = rows.flatMap(([b]) => LANES.map(([l]) => grid?.[`${l}:${b}`] || 0));
  const max = Math.max(...vals, 1);
  if (!vals.some(Boolean)) return null;
  return (
    <div>
      <div className="grid grid-cols-[4.5rem_repeat(5,1fr)] gap-[2px] text-[11px]">
        <span />
        {LANES.map(([, n]) => <span key={n} className="pb-1 text-center text-ink-3">{n}</span>)}
        {rows.map(([b, name]) => [
          <span key={`l${b}`} className="flex items-center text-ink-3">{name}</span>,
          ...LANES.map(([l]) => {
            const v = grid?.[`${l}:${b}`] || 0, t = v / max;
            return <span key={`${l}${b}`} className="flex h-12 items-center justify-center rounded-sm text-sm font-semibold tabular"
              style={{ background: v ? goldRamp(0.15 + 0.85 * t) : "var(--paper-2)", color: v ? inkOn(0.15 + 0.85 * t) : "var(--ink-3)" }} title={`${name}, ${l} : ${v}`}>{v}</span>;
          }),
        ])}
      </div>
      <p className="mt-1 text-right text-[11px] text-ink-3">sens de l'attaque →</p>
    </div>
  );
}

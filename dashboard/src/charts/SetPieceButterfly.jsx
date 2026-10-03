import { US, THEM } from "./palette.js";

// Restarts won: ours to the left (gold), theirs to the right (blue), same scale.
export default function SetPieceButterfly({ counts }) {
  const rows = counts.filter((r) => r.us + r.them > 0);
  const max = Math.max(1, ...rows.flatMap((r) => [r.us, r.them]));
  return (
    <div>
      <div className="mb-1 grid grid-cols-[1fr_7rem_1fr] text-[10px] uppercase tracking-wider text-ink-3">
        <span className="text-right">Lauréats</span><span /><span>Adversaire</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.code} className="grid grid-cols-[1fr_7rem_1fr] items-center gap-2 text-[12px]">
            <div className="flex items-center gap-1.5">
              <span className="w-6 shrink-0 text-right text-ink tabular">{r.us}</span>
              <div className="flex flex-1 justify-end"><div className="h-3.5 shrink-0 rounded-l-sm" style={{ width: `${(r.us / max) * 100}%`, background: US }} /></div>
            </div>
            <span className="text-center text-ink-2">{r.label}</span>
            <div className="flex items-center gap-1.5">
              <div className="flex flex-1"><div className="h-3.5 shrink-0 rounded-r-sm" style={{ width: `${(r.them / max) * 100}%`, background: THEM }} /></div>
              <span className="w-6 shrink-0 text-ink tabular">{r.them}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

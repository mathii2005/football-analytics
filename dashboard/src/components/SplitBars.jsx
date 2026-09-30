import { pct } from "../format.js";

// Possession share per row on a 0–100 % track with the 50 % line.
// Solid bar = strict (exact possessions); tick = inclusive (with inferred phases).
export default function SplitBars({ rows }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3 text-sm"
          title={`${r.label} : ${pct(r.strict)} (${pct(r.inclusive)} avec les phases déduites)`}>
          <span className="truncate text-ink-2">{r.label}</span>
          <div className="relative h-3.5 rounded-sm bg-them/30">
            {r.strict != null && <div className="h-3.5 rounded-l-sm bg-ink" style={{ width: `${r.strict * 100}%` }} />}
            {r.inclusive != null && <span className="absolute top-[-3px] h-5 w-0.5 bg-gold-deep" style={{ left: `${r.inclusive * 100}%` }} />}
            <span className="absolute inset-y-[-4px] left-1/2 w-px bg-paper" />
          </div>
          <span className="text-right text-ink tabular">{pct(r.strict)}</span>
        </li>
      ))}
    </ul>
  );
}

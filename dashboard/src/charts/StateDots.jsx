import { US } from "./palette.js";
import { STATE_LABELS, pct } from "../format.js";

// Possession share by score state at the start of the possession; dot on a
// 0-100 % axis with the 50 % line, n printed (small n = read with care).
export default function StateDots({ states }) {
  const rows = states.filter((s) => s.n_us + s.n_them > 0);
  return (
    <ul className="space-y-3">
      {rows.map((s) => (
        <li key={s.state} className="grid grid-cols-[6rem_1fr_5.5rem] items-center gap-2 text-[12px]">
          <span className="text-ink-2">{STATE_LABELS[s.state]}</span>
          <div className="relative h-4">
            <div className="absolute inset-x-0 top-1/2 h-px bg-rule" />
            <div className="absolute top-0 h-4 w-px bg-ink-3" style={{ left: "50%" }} />
            {s.strict != null && <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-paper" style={{ left: `${s.strict * 100}%`, background: US }} />}
          </div>
          <span className="text-right text-ink tabular">{pct(s.strict)} <span className="text-ink-3">· {s.n_us + s.n_them} poss.</span></span>
        </li>
      ))}
    </ul>
  );
}

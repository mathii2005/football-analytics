import { Play } from "lucide-react";
import { US, INK } from "./palette.js";
import { funnelStep } from "../links.js";

// Shot funnel drawn as a funnel: each stage a centred bar whose width is its
// count, conversion from the previous stage between them, clips per stage.
export default function Funnel({ stages, onSelect }) {
  const max = Math.max(1, stages[0]?.n ?? 1);
  return (
    <ol className="space-y-1">
      {stages.map((s, i) => (
        <li key={s.stage}>
          {i > 0 && <div className="text-center text-[10px] text-ink-3 tabular">{funnelStep(stages[i - 1].n, s.n)}</div>}
          <div className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-2 text-[12px]">
            <span className="text-ink-2">{s.stage}</span>
            <div className="flex justify-center">
              <div className="flex h-7 items-center justify-center rounded-sm text-sm font-semibold text-white tabular"
                style={{ width: `${Math.max(6, (s.n / max) * 100)}%`, background: s.stage === "Buts" ? US : INK, opacity: s.stage === "Buts" ? 1 : 1 - i * 0.12 }}>{s.n}</div>
            </div>
            {onSelect && s.n > 0 && s.stage !== "Actions dangereuses"
              ? <button type="button" onClick={() => onSelect(s.stage)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold-deep hover:text-ink"><Play size={10} aria-hidden="true" /> clips</button>
              : <span />}
          </div>
        </li>
      ))}
    </ol>
  );
}

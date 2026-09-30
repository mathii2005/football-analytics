import { ChevronDown, Play } from "lucide-react";
import { pct } from "../format.js";

// Dangerous actions -> box entries -> shots -> on target -> goals, with the
// conversion from each stage to the next. Not every shot follows a tagged box
// entry, so a step above 100 % is shown as "—" rather than a fake rate.
export default function ShotFunnel({ stages, onSelect }) {
  const max = Math.max(1, stages[0]?.n ?? 1);
  return (
    <ol className="space-y-1.5">
      {stages.map((s, i) => (
        <li key={s.stage}>
          {i > 0 && (
            <div className="flex items-center gap-1 pl-[8.5rem] text-[11px] text-ink-3 tabular">
              <ChevronDown size={11} aria-hidden="true" />
              {stages[i - 1].n && s.n <= stages[i - 1].n ? pct(s.n / stages[i - 1].n) : "des tirs arrivent sans entrée surface taguée"}
            </div>
          )}
          <div className="grid grid-cols-[8rem_1fr] items-center gap-2 text-sm">
            <span className="text-ink-2">{s.stage}</span>
            <div className="flex items-center gap-2">
              <div className={`h-6 rounded-sm ${s.stage === "Buts" ? "bg-gold-deep" : "bg-ink"}`} style={{ width: `${Math.max(2, (s.n / max) * 100)}%` }} />
              <span className="display text-lg font-semibold text-ink tabular">{s.n}</span>
              {onSelect && s.n > 0 && s.stage !== "Actions dangereuses" && (
                <button type="button" onClick={() => onSelect(s.stage)} className="inline-flex items-center gap-1 text-xs font-semibold text-gold-deep hover:text-ink">
                  <Play size={11} aria-hidden="true" /> clips</button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

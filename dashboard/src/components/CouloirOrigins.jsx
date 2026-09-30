import { ACTION_TYPES, ACTION_LABELS, COULOIR_LABELS, pct } from "../format.js";
import ActionLegend, { ACTION_COLORS } from "./ActionLegend.jsx";

// Which couloir our attacks start from: stacked columns by action type,
// share of all couloir-tagged actions on top.
export default function CouloirOrigins({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div>
      <div className="grid grid-cols-3 items-end gap-4" style={{ height: 200 }}>
        {rows.map((r) => (
          <div key={r.couloir} className="flex h-full flex-col items-center justify-end">
            <span className="display text-xl font-semibold text-ink tabular">{pct(r.share)}</span>
            <span className="mb-1 text-xs text-ink-3 tabular">{r.n} actions</span>
            <div className="flex w-12 flex-col-reverse gap-0.5" style={{ height: `${(r.n / max) * 140}px` }}
              title={ACTION_TYPES.map((t) => `${ACTION_LABELS[t]} ${r.by_type[t]}`).join(" · ")}>
              {ACTION_TYPES.map((t) => r.by_type[t] > 0 && (
                <div key={t} className="w-full first:rounded-b-sm last:rounded-t-sm" style={{ flex: r.by_type[t], background: ACTION_COLORS[t] }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-4 text-center text-sm font-medium text-ink">
        {rows.map((r) => <span key={r.couloir}>{COULOIR_LABELS[r.couloir]}</span>)}
      </div>
      <div className="mt-3"><ActionLegend /></div>
    </div>
  );
}

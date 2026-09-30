import { ACTION_TYPES, ACTION_LABELS, ZONE_LABELS } from "../format.js";
import ActionLegend, { ACTION_COLORS } from "./ActionLegend.jsx";

// Where our dangerous actions arrive, zone by zone (box on top), by type.
export default function ArrivalZones({ rows }) {
  const order = ["BOX", "4", "3", "2", "1"];
  const total = (r) => ACTION_TYPES.reduce((s, t) => s + r.by_type[t], 0);
  const max = Math.max(1, ...rows.map(total));
  return (
    <div>
      <ul className="space-y-2">
        {order.map((z) => {
          const r = rows.find((x) => x.zone === z);
          const n = total(r);
          return (
            <li key={z} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-3 text-sm"
              title={ACTION_TYPES.map((t) => `${ACTION_LABELS[t]} ${r.by_type[t]}`).join(" · ")}>
              <span className="text-ink-2">{ZONE_LABELS[z]}</span>
              <div className="flex h-3.5 gap-0.5" style={{ width: `${(n / max) * 100}%` }}>
                {ACTION_TYPES.map((t) => r.by_type[t] > 0 && <div key={t} className="h-3.5 first:rounded-l-sm last:rounded-r-sm" style={{ flex: r.by_type[t], background: ACTION_COLORS[t] }} />)}
              </div>
              <span className="text-right text-ink tabular">{n}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3"><ActionLegend /></div>
    </div>
  );
}

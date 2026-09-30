// Simple labelled horizontal bars (one series), value printed at the tip.
// rows: [{label, value, display?, highlight?}]; max defaults to the largest value.
export default function HBars({ rows, max, format = (v) => v, labelWidth = "7rem" }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid items-center gap-3 text-sm" style={{ gridTemplateColumns: `${labelWidth} 1fr 3.5rem` }}
          title={`${r.label} : ${r.display ?? format(r.value)}`}>
          <span className="truncate text-ink-2">{r.label}</span>
          <div className="h-3 rounded-r-sm bg-paper-2">
            <div className={`h-3 rounded-r-sm ${r.highlight ? "bg-gold-deep" : "bg-ink"}`}
              style={{ width: `${Math.max(0, Math.min(1, (r.value ?? 0) / top)) * 100}%` }} />
          </div>
          <span className="text-right text-ink tabular">{r.display ?? format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

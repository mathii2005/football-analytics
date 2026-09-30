// Simple labelled horizontal bars (one series), value printed at the tip.
// rows: [{label, value, display?, highlight?, onSelect?}]; a row with onSelect
// is a button that opens the matching clips.
import { Play } from "lucide-react";

function Row({ r, onSelect, labelWidth, children }) {
  const cls = "grid w-full items-center gap-3 text-left text-sm";
  const style = { gridTemplateColumns: `${labelWidth} 1fr 4rem` };
  return onSelect
    ? <button type="button" onClick={onSelect} className={`${cls} rounded-sm hover:bg-paper-2`} style={style}
        title={`${r.label} : voir les clips`}>{children}</button>
    : <div className={cls} style={style} title={r.label}>{children}</div>;
}

export default function HBars({ rows, max, format = (v) => v, labelWidth = "7rem" }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label}>
         <Row r={r} onSelect={r.onSelect} labelWidth={labelWidth}>
          <span className="truncate text-ink-2">{r.label}</span>
          <div className="h-3 rounded-r-sm bg-paper-2">
            <div className={`h-3 rounded-r-sm ${r.highlight ? "bg-gold-deep" : "bg-ink"}`}
              style={{ width: `${Math.max(0, Math.min(1, (r.value ?? 0) / top)) * 100}%` }} />
          </div>
          <span className="flex items-center justify-end gap-1.5 text-right text-ink tabular">{r.display ?? format(r.value)}
            {r.onSelect && <Play size={11} className="text-gold-deep" aria-hidden="true" />}</span>
         </Row>
        </li>
      ))}
    </ul>
  );
}

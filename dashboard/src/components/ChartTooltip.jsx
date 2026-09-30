// Value leads, label follows; keyed with a short line in the series color.
export default function ChartTooltip({ active, payload, label, format, color }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg">
      <div className="flex items-center gap-2">
        <span className="inline-block h-0.5 w-3" style={{ background: color }} />
        <span className="text-sm font-semibold text-ink tabular">{format(row)}</span>
      </div>
      <div className="mt-0.5 text-muted">{row.label ?? label}</div>
    </div>
  );
}

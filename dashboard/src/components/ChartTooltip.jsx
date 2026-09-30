// Value leads, label follows; keyed with a short line in the mark's color.
export default function ChartTooltip({ active, payload, format, label: fallback }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded border border-rule bg-paper px-3 py-2 text-xs shadow-[0_4px_16px_rgba(10,10,10,0.08)]">
      <div className="flex items-center gap-2">
        <span className="inline-block h-0.5 w-3" style={{ background: payload[0].color || payload[0].fill }} />
        <span className="text-sm font-semibold text-ink tabular">{format(row)}</span>
      </div>
      <div className="mt-0.5 text-ink-3">{row.label ?? fallback}</div>
    </div>
  );
}

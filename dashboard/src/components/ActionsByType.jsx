// Dangerous actions by type, split into those that reached the box (gold)
// and the rest (ink).
export default function ActionsByType({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.box + r.non_box));
  return (
    <div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.code} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3 text-sm"
            title={`${r.label} : ${r.non_box + r.box} (dont ${r.box} dans la surface)`}>
            <span className="text-ink-2">{r.label}</span>
            <div className="flex h-3.5 gap-0.5">
              <div className="h-3.5 rounded-l-sm bg-ink" style={{ width: `${(r.non_box / max) * 100}%` }} />
              {r.box > 0 && <div className="h-3.5 rounded-r-sm bg-gold-deep" style={{ width: `${(r.box / max) * 100}%` }} />}
            </div>
            <span className="text-right text-ink tabular">{r.box + r.non_box}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-ink" />Hors surface</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-gold-deep" />Dans la surface</span>
      </div>
    </div>
  );
}

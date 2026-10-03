// Generated, factual key points (src/analytics/report.py), most important first.
export default function KeyPoints({ points }) {
  if (!points.length) return <p className="text-sm text-ink-3">Rien de marquant selon les seuils actuels.</p>;
  return (
    <ol className="space-y-3">
      {points.map((p, i) => (
        <li key={p} className="grid grid-cols-[1.5rem_1fr] gap-2 text-[15px] leading-snug text-ink">
          <span className="display pt-px text-lg font-semibold leading-none text-gold-deep tabular">{i + 1}</span>
          <span>{p}</span>
        </li>
      ))}
    </ol>
  );
}

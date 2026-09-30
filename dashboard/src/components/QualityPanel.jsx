// Automatic tagging checks (src/analytics/quality.py): where to look on video.
const REASONS = { inferred: "untagged change", kickoff: "after their goal", restart: "after dead ball" };
export default function QualityPanel({ quality }) {
  if (quality.ok) {
    return <p className="text-sm text-muted">✓ No issues found</p>;
  }
  return (
    <div className="space-y-4 text-sm">
      <ul className="space-y-1.5">
        {quality.warnings.map((w) => (
          <li key={w} className="flex gap-2 text-ink">
            <span aria-hidden className="text-warn">⚠</span>
            <span><span className="sr-only">Warning: </span>{w}</span>
          </li>
        ))}
      </ul>
      {quality.long_gaps.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted">Long silences to check on video</div>
          <ul className="mt-1 flex flex-wrap gap-2 tabular">
            {quality.long_gaps.map((g) => (
              <li key={`${g.possession_id}-${g.from}`} className="rounded-md border border-line px-2 py-0.5 text-xs text-ink">
                H{g.half} {g.from}–{g.to}
              </li>
            ))}
          </ul>
        </div>
      )}
      {quality.inferred_transitions.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted">Untagged transitions (inferred after)</div>
          <ul className="mt-1 flex flex-wrap gap-2 tabular">
            {quality.inferred_transitions.map((t) => (
              <li key={t.possession_id} className="rounded-md border border-line px-2 py-0.5 text-xs text-ink">
                H{t.half} {t.after} · {REASONS[t.reason] ?? t.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

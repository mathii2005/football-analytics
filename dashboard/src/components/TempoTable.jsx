import { dec } from "../format.js";

// Old staff table: build-up vs finishing, per half.
export default function TempoTable({ rows }) {
  return (
    <table className="w-full text-sm tabular">
      <thead><tr className="text-left text-xs uppercase tracking-wider text-ink-3">
        <th className="pb-2 font-medium">Mi-temps</th><th className="pb-2 text-right font-medium">Actions</th>
        <th className="pb-2 text-right font-medium">Tirs</th><th className="pb-2 text-right font-medium">Act. / tir</th>
        <th className="pb-2 text-right font-medium">Pertes</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.half} className="border-t border-rule">
            <td className="py-2 text-ink">MT{r.half}</td><td className="py-2 text-right text-ink">{r.actions}</td>
            <td className="py-2 text-right text-ink">{r.shots}</td>
            <td className="py-2 text-right text-ink">{r.actions_per_shot == null ? "–" : `${dec(r.actions_per_shot)}:1`}</td>
            <td className="py-2 text-right text-ink">{r.losses}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

import { clock, seconds, OUTCOME_LABELS } from "../format.js";

// Table view of every possession - the timeline's accessible twin.
export default function PossessionTable({ possessions }) {
  return (
    <details>
      <summary className="cursor-pointer text-sm font-medium text-ink">All possessions ({possessions.length})</summary>
      <div className="mt-3 max-h-96 overflow-auto">
        <table className="w-full text-xs tabular">
          <thead className="sticky top-0 bg-card text-left text-muted">
            <tr>
              {["#", "Half", "Team", "Start", "End", "Live", "Start type", "End type", "Outcome", "Events"].map((h) => (
                <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {possessions.map((p) => (
              <tr key={p.possession_id} className="border-t border-line text-ink">
                <td className="py-1.5 pr-3">{p.possession_id}</td>
                <td className="pr-3">{p.half}</td>
                <td className="pr-3">{p.team === "us" ? "Us" : "Them"}</td>
                <td className="pr-3">{p.start_exact ? "" : "~"}{clock(p.start_ms)}</td>
                <td className="pr-3">{p.end_exact ? "" : "~"}{clock(p.end_ms)}</td>
                <td className="pr-3">{seconds(p.duration_ms)}</td>
                <td className="pr-3">{p.start_type}</td>
                <td className="pr-3">{p.end_type}</td>
                <td className="pr-3">{p.outcome ? OUTCOME_LABELS[p.outcome] : ""}</td>
                <td className="text-muted">{p.codes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

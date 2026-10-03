import { clock, secs, OUTCOME_LABELS, START_LABELS, END_LABELS } from "../format.js";

// Table view of every possession - the timeline's accessible twin.
export default function PossessionTable({ possessions }) {
  return (
    <details className="group border-y border-rule">
      <summary className="cursor-pointer list-none py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
        Toutes les possessions ({possessions.length})
      </summary>
      <div className="max-h-96 overflow-auto pb-3">
        <table className="w-full text-xs tabular">
          <thead className="sticky top-0 bg-paper text-left text-ink-3">
            <tr>{["#", "MT", "Équipe", "Début", "Fin", "Durée", "Départ", "Fin de poss.", "Issue"].map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {possessions.map((p) => (
              <tr key={p.possession_id} className="border-t border-rule text-ink">
                <td className="py-1.5 pr-3">{p.possession_id}</td>
                <td className="pr-3">{p.half}</td>
                <td className="pr-3">{p.team === "us" ? "Lauréats" : "Adversaire"}</td>
                <td className="pr-3">{p.start_exact ? "" : "~"}{clock(p.start_ms)}</td>
                <td className="pr-3">{p.end_exact ? "" : "~"}{clock(p.end_ms)}</td>
                <td className="pr-3">{secs(p.duration_ms)}</td>
                <td className="pr-3">{START_LABELS[p.start_type]}</td>
                <td className="pr-3">{END_LABELS[p.end_type]}</td>
                <td className="pr-3">{p.outcome ? OUTCOME_LABELS[p.outcome] : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

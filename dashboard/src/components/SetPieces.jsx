// Set pieces, ours vs theirs, and how many goals came from them.
export default function SetPieces({ sp }) {
  const rows = sp.counts.filter((r) => r.us + r.them > 0);
  return (
    <div>
      <table className="w-full text-sm tabular">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-ink-3">
            <th className="pb-2 font-medium">Type</th>
            <th className="pb-2 text-right font-medium">Lauréats</th>
            <th className="pb-2 text-right font-medium">Adversaire</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-t border-rule">
              <td className="py-2 text-ink">{r.label}</td>
              <td className="py-2 text-right font-semibold text-ink">{r.us}</td>
              <td className="py-2 text-right text-ink-2">{r.them}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-sm text-ink-2">
        Sur coup de pied arrêté : <span className="font-semibold text-ink">{sp.goals_from_set_pieces}</span>{" "}
        {sp.goals_from_set_pieces > 1 ? "buts marqués" : "but marqué"},{" "}
        <span className="font-semibold text-ink">{sp.conceded_from_set_pieces}</span>{" "}
        {sp.conceded_from_set_pieces > 1 ? "encaissés" : "encaissé"}.
      </p>
    </div>
  );
}

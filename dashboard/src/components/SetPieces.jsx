import { plural } from "../format.js";

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
        Issus d'un de nos coups de pied arrêtés (≤ 20 s avant, sans perte) :{" "}
        <span className="font-semibold text-ink">{plural(sp.shots_from_set_piece, "tir")}</span>, dont{" "}
        <span className="font-semibold text-ink">{plural(sp.goals_from_set_piece, "but")}</span>.
        Encaissés sur coup de pied arrêté adverse : <span className="font-semibold text-ink">{sp.conceded_from_set_pieces}</span>.
      </p>
      <p className="mt-1 text-sm text-ink-2">Corners : <span className="font-semibold text-ink tabular">{sp.corner_asymmetry.us}</span> obtenus contre <span className="font-semibold text-ink tabular">{sp.corner_asymmetry.them}</span> concédés.</p>
    </div>
  );
}

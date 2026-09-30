import { Play } from "lucide-react";
import { ZONE_LABELS, pct, secs, plural } from "../format.js";

// After each of our losses: how fast we win the ball back, by loss zone.
export default function CounterPress({ cp, onZone }) {
  const figs = [
    { label: "Repris en ≤ 5 s", value: pct(cp.within_5s) },
    { label: "Repris en ≤ 10 s", value: pct(cp.within_10s) },
    { label: "Temps médian de reprise", value: secs(cp.median_regain_ms) },
  ];
  return (
    <div>
      <dl className="grid grid-cols-3 gap-4">
        {figs.map((f) => (
          <div key={f.label}>
            <dt className="text-xs text-ink-3">{f.label}</dt>
            <dd className="display text-3xl font-semibold text-ink tabular">{f.value}</dd>
          </div>
        ))}
      </dl>
      <table className="mt-4 w-full text-sm tabular">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-ink-3">
            <th className="pb-2 font-medium">Zone de perte</th><th className="pb-2 text-right font-medium">Pertes</th>
            <th className="pb-2 text-right font-medium">≤ 5 s</th><th className="pb-2 text-right font-medium">≤ 10 s</th>
            <th className="pb-2 text-right font-medium">Médiane</th>
          </tr>
        </thead>
        <tbody>
          {cp.by_zone.filter((z) => z.n).map((z) => (
            <tr key={z.zone} className="border-t border-rule">
              <td className="py-2 text-ink">
                {onZone ? <button type="button" onClick={() => onZone(z.zone)} className="inline-flex items-center gap-1.5 hover:text-gold-deep"
                  title="Voir les clips de contre-pressing de cette zone">{ZONE_LABELS[z.zone]} <Play size={11} className="text-gold-deep" aria-hidden="true" /></button>
                  : ZONE_LABELS[z.zone]}
              </td>
              <td className="py-2 text-right text-ink">{z.n}</td>
              <td className="py-2 text-right text-ink">{pct(z.within_5s)}</td>
              <td className="py-2 text-right text-ink">{pct(z.within_10s)}</td>
              <td className="py-2 text-right text-ink-2">{secs(z.median_regain_ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-3">{plural(cp.n_losses - cp.n_timed, "perte")} sans reprise nette (but adverse, fin de mi-temps ou transition non taguée), comptées comme non reprises.</p>
    </div>
  );
}

import { pct, COULOIR_LABELS } from "../format.js";

// Share of possessions through each couloir that reached the box / ended in a shot.
function Rate({ value }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="hidden h-1.5 w-16 rounded-full bg-rule sm:block">
        <div className="h-1.5 rounded-full bg-ink" style={{ width: `${(value ?? 0) * 100}%` }} />
      </div>
      <span className="w-10 text-right text-ink tabular">{pct(value)}</span>
    </div>
  );
}

export default function CouloirTable({ couloirs }) {
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-ink-3">
            <th className="pb-2 font-medium">Couloir</th>
            <th className="pb-2 text-right font-medium">Poss.</th>
            <th className="pb-2 text-right font-medium">Surface</th>
            <th className="pb-2 text-right font-medium">Tir</th>
          </tr>
        </thead>
        <tbody>
          {["left", "center", "right"].map((k) => (
            <tr key={k} className="border-t border-rule">
              <td className="py-2 text-ink">{COULOIR_LABELS[k]}</td>
              <td className="py-2 text-right text-ink tabular">{couloirs[k].possessions}</td>
              <td className="py-2"><Rate value={couloirs[k].box_rate} /></td>
              <td className="py-2"><Rate value={couloirs[k].shot_rate} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-3">Petits échantillons par match : à lire sur plusieurs matchs.</p>
    </div>
  );
}

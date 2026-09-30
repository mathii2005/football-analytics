import { pct } from "../format.js";

// First half vs second half, mirrored around the stat name; the better half
// of a clear swing is marked in gold.
const ROWS = [
  { key: "possession_strict", label: "Possession", fmt: pct, better: "high", swing: 0.1 },
  { key: "shots", label: "Tirs", better: "high", swing: 3 },
  { key: "shots_on_target", label: "Tirs cadrés", better: "high", swing: 2 },
  { key: "dangerous_actions", label: "Actions dangereuses", better: "high", swing: 4 },
  { key: "threat", label: "Menace (score)", better: "high", swing: 10 },
  { key: "losses", label: "Pertes", better: "low", swing: 6 },
  { key: "losses_opp_half", label: "Pertes dans leur moitié", better: "low", swing: 6 },
];

function Cell({ value, marked, align }) {
  return (
    <td className={`py-2.5 ${align} display text-2xl font-semibold tabular ${marked ? "text-gold-deep" : "text-ink"}`}>
      {value}
    </td>
  );
}

export default function HalvesTable({ halves }) {
  if (halves.length < 2) return <p className="text-sm text-ink-3">Une seule mi-temps taguée.</p>;
  const [a, b] = halves;
  const goals = (h) => `${h.goals_us}–${h.goals_them}`;
  return (
    <table className="w-full">
      <thead>
        <tr className="text-xs uppercase tracking-wider text-ink-3">
          <th className="pb-2 text-left font-medium">MT1</th><th className="pb-2 font-medium" />
          <th className="pb-2 text-right font-medium">MT2</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-t border-rule">
          <Cell value={goals(a)} align="text-left" /><td className="text-center text-sm text-ink-2">Score de la mi-temps</td>
          <Cell value={goals(b)} align="text-right" />
        </tr>
        {ROWS.map((r) => {
          const va = a[r.key], vb = b[r.key];
          const diff = (vb ?? 0) - (va ?? 0);
          const clear = Math.abs(diff) >= r.swing;
          const bBetter = r.better === "high" ? diff > 0 : diff < 0;
          const f = r.fmt ?? ((v) => v);
          return (
            <tr key={r.key} className="border-t border-rule">
              <Cell value={f(va)} marked={clear && !bBetter} align="text-left" />
              <td className="px-2 text-center text-sm text-ink-2">{r.label}</td>
              <Cell value={f(vb)} marked={clear && bBetter} align="text-right" />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

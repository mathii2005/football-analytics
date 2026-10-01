import { US, THEM, MUTED } from "./palette.js";
import { pct, dec } from "../format.js";

// What changed at half-time: one row per metric, hollow dot = MT1, filled
// dot = MT2, each row on its own scale (0 .. max of the two). Line colour =
// direction for us (gold = better in MT2, blue = worse); lowerIsBetter rows flip.
const ROWS = [
  ["possession_strict", "Possession", pct, false],
  ["shots", "Tirs", (v) => v, false],
  ["shots_on_target", "Tirs cadrés", (v) => v, false],
  ["dangerous_actions", "Actions dangereuses", (v) => v, false],
  ["threat", "Menace (score)", (v) => v, false],
  ["losses", "Pertes", (v) => v, true],
  ["losses_opp_half", "Pertes dans leur moitié", (v) => v, true],
];

export default function HalvesDumbbell({ halves, tempo }) {
  if (halves.length < 2) return <p className="text-sm text-ink-3">Une seule mi-temps taguée.</p>;
  const [a, b] = halves;
  const rows = [...ROWS, ["aps", "Actions par tir", (v) => (v == null ? "–" : dec(v)), true]];
  const val = (h, k, i) => (k === "aps" ? tempo[i]?.actions_per_shot : h[k]);
  return (
    <div>
      <div className="mb-1 grid grid-cols-[9rem_1fr_6rem] text-[10px] uppercase tracking-wider text-ink-3"><span /><span /><span className="text-right">MT1 → MT2</span></div>
      <ul className="space-y-2">
        {rows.map(([k, label, fmt, lower]) => {
          const v1 = val(a, k, 0), v2 = val(b, k, 1);
          if (v1 == null && v2 == null) return null;
          const max = Math.max(v1 ?? 0, v2 ?? 0) * 1.1 || 1;
          const x1 = ((v1 ?? 0) / max) * 100, x2 = ((v2 ?? 0) / max) * 100;
          const better = lower ? v2 < v1 : v2 > v1;
          const color = v1 === v2 ? MUTED : better ? US : THEM;
          return (
            <li key={k} className="grid grid-cols-[9rem_1fr_6rem] items-center gap-2 text-[12px]" title={`${label} : MT1 ${fmt(v1)} → MT2 ${fmt(v2)}`}>
              <span className="text-ink-2">{label}</span>
              <div className="relative h-4">
                <div className="absolute inset-x-0 top-1/2 h-px bg-rule" />
                <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded" style={{ left: `${Math.min(x1, x2)}%`, width: `${Math.abs(x2 - x1)}%`, background: color, opacity: 0.6 }} />
                <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-paper" style={{ left: `${x1}%`, borderColor: color }} />
                <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${x2}%`, background: color }} />
              </div>
              <span className="text-right text-ink tabular">{fmt(v1)} → <span className="font-semibold">{fmt(v2)}</span></span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 text-[11px] text-ink-3">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-ink-3" />MT1</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-ink-3" />MT2</span>
        <span>or : mieux en 2e mi-temps · bleu : moins bien</span>
      </p>
    </div>
  );
}

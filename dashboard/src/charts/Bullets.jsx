import { US, THEM, MID } from "./palette.js";
import { pct, dec } from "../format.js";

// Bullet chart per KPI: grey bar = range of our matches (min..max), blue
// tick = season average, gold dot = this match. lowerIsBetter flips the
// note only (colours never judge good/bad here).
const ROWS = [
  ["possession", "Possession", pct],
  ["field_tilt", "Field tilt", pct],
  ["high_recup_share", "Récupérations hautes", pct],
  ["regain_10s", "Ballons repris ≤ 10 s", pct],
  ["shots", "Tirs", (v) => (v == null ? "–" : Math.round(v))],
  ["shots_per_possession", "Tirs par possession", (v) => dec(v)],
  ["losses_opp_half_share", "Pertes dans leur moitié", pct],
  ["not_cheap_loss", "Possessions sans perte rapide", pct],
];

export default function Bullets({ profile, summary }) {
  return (
    <ul className="space-y-2.5">
      {ROWS.map(([k, label, fmt]) => {
        const s = summary[k], v = profile?.[k];
        if (!s || v == null) return null;
        const lo = Math.min(s.min, v), hi = Math.max(s.max, v);
        const pad = (hi - lo) * 0.08 || 0.05;
        const x = (val) => ((val - (lo - pad)) / (hi - lo + 2 * pad)) * 100;
        return (
          <li key={k} className="grid grid-cols-[9.5rem_1fr_3.2rem] items-center gap-2 text-[12px]"
            title={`${label} : ${fmt(v)} (moyenne ${fmt(s.mean)}, nos matchs ${fmt(s.min)}–${fmt(s.max)})`}>
            <span className="truncate text-ink-2">{label}</span>
            <div className="relative h-4">
              <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-sm" style={{ left: `${x(s.min)}%`, width: `${x(s.max) - x(s.min)}%`, background: MID }} />
              <div className="absolute top-0 h-4 w-0.5" style={{ left: `${x(s.mean)}%`, background: THEM }} />
              <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-paper" style={{ left: `${x(v)}%`, background: US }} />
            </div>
            <span className="text-right font-semibold text-ink tabular">{fmt(v)}</span>
          </li>
        );
      })}
      <li className="flex flex-wrap gap-x-4 pt-1 text-[11px] text-ink-3">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: US }} />Ce match</span>
        <span><span className="mr-1 inline-block h-3 w-0.5 align-middle" style={{ background: THEM }} />Moyenne</span>
        <span><span className="mr-1 inline-block h-2 w-4 rounded-sm align-middle" style={{ background: MID }} />Écart de nos matchs</span>
      </li>
    </ul>
  );
}

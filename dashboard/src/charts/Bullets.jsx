import { US, THEM, MID } from "./palette.js";
import { pct, dec } from "../format.js";

// Bullet chart per KPI: grey bar = range of our matches (min..max), blue
// tick = season average, gold dot = this match. Colours never judge good/bad.
const ROWS = [
  ["possession", "Possession", pct],
  ["field_tilt", "Field tilt", pct],
  ["high_recup_share", "Récupérations hautes", pct],
  ["regain_10s", "Ballons repris ≤ 10 s", pct],
  ["shots", "Tirs", (v) => (v == null ? "–" : Math.round(v))],
  ["shots_per_possession", "Tirs par possession", (v) => dec(v)],
  ["losses_opp_half_share", "Pertes dans leur moitié", pct],
  ["not_cheap_loss", "Sans perte rapide", pct],
];

export default function Bullets({ profile, summary }) {
  return (
    <ul className="space-y-4">
      {ROWS.map(([k, label, fmt]) => {
        const s = summary[k], v = profile?.[k];
        if (!s || v == null) return null;
        // shares on a fixed 0-100 % axis, counts and ratios on 0 .. max x 1.1,
        // so the width of the season range means something
        const top = fmt === pct ? 1 : Math.max(s.max, v) * 1.1 || 1;
        const x = (val) => (val / top) * 100;
        return (
          <li key={k} className="grid grid-cols-[9.5rem_1fr_3.2rem] items-center gap-2 text-[12px]"
            title={`${label} : ${fmt(v)} (moyenne ${fmt(s.mean)}, nos matchs ${fmt(s.min)}–${fmt(s.max)})`}>
            <span className="truncate text-ink-2">{label}</span>
            <div className="relative h-4">
              <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-sm" style={{ left: `${x(s.min)}%`, width: `${x(s.max) - x(s.min)}%`, background: MID }} />
              <div className="absolute top-0 h-4 w-0.5" style={{ left: `${x(s.mean)}%`, background: THEM }} />
              <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-paper" style={{ left: `${x(v)}%`, background: US }} />
              <span className="absolute -bottom-3 -translate-x-1/2 text-[9px] text-ink-3 tabular" style={{ left: `${x(s.min)}%` }}>{fmt(s.min)}</span>
              {x(s.max) - x(s.min) > 14 && <span className="absolute -bottom-3 -translate-x-1/2 text-[9px] text-ink-3 tabular" style={{ left: `${x(s.max)}%` }}>{fmt(s.max)}</span>}
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

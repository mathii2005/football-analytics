import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { US, THEM, GRID, MUTED } from "./palette.js";
import { pct, dec } from "../format.js";

// Team profile: this match vs our season average on 8 axes. Each axis is
// scaled from our lowest to our highest tagged match (0.15 .. 1), so the
// shape reads "where in our own range was this match" - no better/worse
// judgement and not a league percentile.
const AXES = [
  ["possession", "Possession", pct],
  ["field_tilt", "Field tilt", pct],
  ["high_recup_share", "Récup hautes", pct],
  ["regain_10s", "Repris ≤ 10 s", pct],
  ["shots_per_possession", "Tirs / poss.", (v) => dec(v)],
  ["box_entries_per_possession", "Entrées surf. / poss.", (v) => dec(v)],
  ["verticality", "Verticalité", pct],
  ["not_cheap_loss", "Pas de perte rapide", pct],
];

function scale(v, s) {
  if (v == null || !s) return 0;
  if (s.max === s.min) return 0.575;
  return 0.15 + 0.85 * (v - s.min) / (s.max - s.min);
}

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-sm border border-rule bg-paper px-2.5 py-1.5 text-[11px] shadow-[0_4px_14px_rgba(10,10,10,0.1)]">
      <div className="font-semibold text-ink">{d.label}</div>
      <div style={{ color: US }}>Ce match : {d.fmt(d.raw)}</div>
      <div style={{ color: THEM }}>Moyenne : {d.fmt(d.rawAvg)}</div>
      <div className="text-ink-3">Nos matchs : {d.fmt(d.min)} – {d.fmt(d.max)}</div>
    </div>
  );
}

export default function TeamRadar({ profile, summary, n }) {
  const data = AXES.map(([k, label, fmt]) => {
    const s = summary[k];
    return { label, fmt, raw: profile?.[k], rawAvg: s?.mean, min: s?.min, max: s?.max,
      match: scale(profile?.[k], s), avg: scale(s?.mean, s) };
  });
  return (
    <div>
      <ResponsiveContainer width="100%" height={290}>
        <RadarChart data={data} outerRadius="72%" margin={{ top: 4, right: 24, bottom: 4, left: 24 }}>
          <PolarGrid stroke={GRID} />
          <PolarAngleAxis dataKey="label" tick={{ fill: MUTED, fontSize: 10 }} />
          <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
          <Radar dataKey="avg" stroke={THEM} strokeWidth={1.5} strokeDasharray="4 3" fill={THEM} fillOpacity={0.06} isAnimationActive={false} />
          <Radar dataKey="match" stroke={US} strokeWidth={2} fill={US} fillOpacity={0.3} dot={{ r: 2.5, fill: US }} isAnimationActive={false} />
          <Tooltip content={<Tip />} />
        </RadarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 text-[11px] text-ink-3">
        <span><span className="mr-1 inline-block h-2 w-3 align-middle" style={{ background: US, opacity: 0.6 }} />Ce match</span>
        <span><span className="mr-1 inline-block h-0.5 w-3 border-t-2 border-dashed align-middle" style={{ borderColor: THEM }} />Moyenne de nos {n} matchs</span>
        <span>Échelle par axe : de la valeur la plus basse (centre) à la plus haute de nos matchs.</span>
      </div>
    </div>
  );
}

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useThemeColors from "../useThemeColors.js";
import { ZONE_LABELS, pct } from "../format.js";

// What our recoveries turn into, by the zone where we won the ball. Zones
// with fewer than MIN_N recoveries are drawn faded: too few to read.
const MIN_N = 5;
export default function RecoveryValue({ rows }) {
  const c = useThemeColors();
  const data = rows.map((r) => ({ ...r, label: `${ZONE_LABELS[r.zone]} (${r.n})${r.n > 0 && r.n < MIN_N ? " *" : ""}`,
    box: r.box_rate ?? 0, shot: r.shot_rate ?? 0, quick: r.quick_loss_rate ?? 0 }));
  return (
    <div>
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ left: -16, right: 4, top: 8, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke={c.rule} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: c.rule }} tick={{ fill: c["ink-2"], fontSize: 11 }} />
        <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tickCount={3} tickLine={false} axisLine={false} tick={{ fill: c["ink-3"], fontSize: 11 }} />
        <Tooltip cursor={{ fill: c.rule, opacity: 0.5 }} formatter={(v, k) => [pct(v), { box: "Atteint la surface", shot: "Finit par un tir", quick: "Reperdu en < 5 s" }[k]]} />
        <Legend formatter={(k) => ({ box: "Atteint la surface", shot: "Finit par un tir", quick: "Reperdu en < 5 s" }[k])} wrapperStyle={{ fontSize: 12 }} iconType="square" />
        <Bar dataKey="box" fill={c.ink} maxBarSize={16} radius={[3, 3, 0, 0]} isAnimationActive={false} >{data.map((d) => <Cell key={d.zone} fillOpacity={d.n < MIN_N ? 0.3 : 1} />)}</Bar>
        <Bar dataKey="shot" fill={c["gold-deep"]} maxBarSize={16} radius={[3, 3, 0, 0]} isAnimationActive={false} >{data.map((d) => <Cell key={d.zone} fillOpacity={d.n < MIN_N ? 0.3 : 1} />)}</Bar>
        <Bar dataKey="quick" fill={c.them} maxBarSize={16} radius={[3, 3, 0, 0]} isAnimationActive={false} >{data.map((d) => <Cell key={d.zone} fillOpacity={d.n < MIN_N ? 0.3 : 1} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
    <p className="mt-1 text-xs text-ink-3">* moins de {MIN_N} récupérations : barres estompées, trop peu pour conclure.</p>
    </div>
  );
}

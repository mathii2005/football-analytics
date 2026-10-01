import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { US, THEM, GRID, MUTED, INK } from "./palette.js";

// Counter-press as a survival curve: share of our losses not yet won back
// t seconds after the loss. Steeper early drop = better counter-press.
const SERIES = [
  { key: "overall", label: "Toutes les pertes", color: US, width: 3 },
  { key: "own", label: "Perdu dans notre moitié", color: INK, width: 1.5 },
  { key: "3", label: "Perdu en zone 3", color: THEM, width: 1.5 },
  { key: "4", label: "Perdu en zone 4 / surface", color: MUTED, width: 1.5, dash: "4 3" },
];

export default function RegainCurve({ curve }) {
  if (!curve.t.length) return <p className="text-sm text-ink-3">Aucune perte taguée.</p>;
  const data = curve.t.map((t, i) => ({ t, overall: curve.overall[i],
    own: curve.by_zone.own[i] ?? null, 3: curve.by_zone["3"][i] ?? null, 4: curve.by_zone["4"][i] ?? null }));
  const shown = SERIES.filter((s) => s.key === "overall" || curve.n[s.key] > 0);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: -14, right: 10, top: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="t" type="number" domain={[0, 60]} ticks={[0, 5, 10, 20, 30, 45, 60]} tickFormatter={(v) => `${v} s`}
          tick={{ fill: MUTED, fontSize: 10 }} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => `${v * 100}%`} tick={{ fill: MUTED, fontSize: 10 }} tickLine={false} axisLine={false} />
        <ReferenceLine x={5} stroke={MUTED} strokeDasharray="3 3" label={{ value: "5 s", position: "insideTopRight", fontSize: 10, fill: MUTED }} />
        <ReferenceLine x={10} stroke={MUTED} strokeDasharray="3 3" label={{ value: "10 s", position: "insideTopRight", fontSize: 10, fill: MUTED }} />
        <Tooltip formatter={(v, k) => [`${Math.round(v * 100)} % pas encore repris`, SERIES.find((s) => s.key === k)?.label]} labelFormatter={(t) => `${t} s après la perte`} />
        <Legend formatter={(k) => { const s = SERIES.find((x) => x.key === k); return `${s.label} (${curve.n[k]})`; }} wrapperStyle={{ fontSize: 11 }} />
        {shown.map((s) => <Line key={s.key} dataKey={s.key} type="stepAfter" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} dot={false} isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

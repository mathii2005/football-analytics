import { CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { US, GRID, MUTED, INK } from "./palette.js";

// Every recovery -> next dangerous action (old staff definition) as one dot.
// Dots stack in 1-second bins (beeswarm); bands show counter / fast / built.
export default function TransitionSwarm({ deltas, median }) {
  if (!deltas.length) return <p className="text-sm text-ink-3">Aucune transition propre.</p>;
  const counts = {};
  const pts = [...deltas].sort((a, b) => a - b).map((d) => {
    const bin = Math.round(d);
    counts[bin] = (counts[bin] ?? 0) + 1;
    return { x: d, y: counts[bin] };
  });
  const maxY = Math.max(3, ...pts.map((p) => p.y));
  return (
    <ResponsiveContainer width="100%" height={170}>
      <ScatterChart margin={{ left: 8, right: 14, top: 22, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} horizontal={false} />
        <ReferenceArea x1={0} x2={5} fill={US} fillOpacity={0.12} label={{ value: "Contre", position: "top", fontSize: 10, fill: INK }} />
        <ReferenceArea x1={5} x2={15} fill={US} fillOpacity={0.06} label={{ value: "Rapide", position: "top", fontSize: 10, fill: INK }} />
        <ReferenceArea x1={15} x2={60} fill={MUTED} fillOpacity={0.05} label={{ value: "Construit (15–60 s)", position: "top", fontSize: 10, fill: INK }} />
        <XAxis dataKey="x" type="number" domain={[0, 60]} ticks={[0, 5, 15, 30, 45, 60]} tickFormatter={(v) => `${v} s`} tick={{ fill: MUTED, fontSize: 10 }} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis dataKey="y" type="number" domain={[0, maxY + 1.5]} hide />
        {median != null && <ReferenceLine x={median} stroke={INK} strokeWidth={1.5} label={{ value: `médiane ${median} s`, position: "insideTopRight", fontSize: 10, fill: INK, dy: 18 }} />}
        <Tooltip cursor={false} formatter={(v, k) => (k === "x" ? [`${v} s`, "Récup → action"] : [null, null])} />
        <Scatter data={pts} fill={US} stroke="#fff" strokeWidth={1} isAnimationActive={false} shape={(p) => <circle cx={p.cx} cy={p.cy} r={5.5} fill={US} stroke="#fff" strokeWidth={1.2} />} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

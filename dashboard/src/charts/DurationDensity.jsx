import { Area, AreaChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { US, THEM, GRID, MUTED } from "./palette.js";

// Who keeps the ball longer: smoothed distribution (Gaussian kernel on a
// log-seconds axis, presentation only) of timed possession durations.
const XS = Array.from({ length: 60 }, (_, i) => 10 ** (Math.log10(1) + (i / 59) * (Math.log10(150) - Math.log10(1))));

function density(ms) {
  const xs = ms.map((m) => Math.log10(Math.max(1, m / 1000)));
  if (!xs.length) return XS.map(() => 0);
  const bw = 0.18;
  return XS.map((s) => {
    const lx = Math.log10(s);
    return xs.reduce((acc, x) => acc + Math.exp(-((lx - x) ** 2) / (2 * bw * bw)), 0) / (xs.length * bw * Math.sqrt(2 * Math.PI));
  });
}
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) / 100) / 10; };

export default function DurationDensity({ us, them }) {
  const du = density(us), dt = density(them);
  const data = XS.map((s, i) => ({ s: Math.round(s * 10) / 10, us: du[i], them: dt[i] }));
  const mu = median(us), mt = median(them);
  const nearest = (v) => data.reduce((b, d) => (Math.abs(d.s - v) < Math.abs(b.s - v) ? d : b), data[0]).s;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ left: -30, right: 10, top: 10, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="s" scale="log" type="number" domain={[1, 150]} ticks={[1, 3, 5, 10, 20, 40, 80, 150]} tickFormatter={(v) => `${v} s`}
          tick={{ fill: MUTED, fontSize: 10 }} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis hide />
        <Tooltip formatter={(v, k) => [v.toFixed(2), k === "us" ? "Lauréats" : "Adversaire"]} labelFormatter={(s) => `${s} s`} />
        <Legend formatter={(k) => (k === "us" ? `Lauréats (n=${us.length}, médiane ${mu ?? "–"} s)` : `Adversaire (n=${them.length}, médiane ${mt ?? "–"} s)`)} wrapperStyle={{ fontSize: 11 }} />
        <Area dataKey="them" type="monotone" stroke={THEM} strokeWidth={2} fill={THEM} fillOpacity={0.12} isAnimationActive={false} />
        <Area dataKey="us" type="monotone" stroke={US} strokeWidth={2} fill={US} fillOpacity={0.18} isAnimationActive={false} />
        {mu != null && <ReferenceLine x={nearest(mu)} stroke={US} strokeDasharray="3 3" />}
        {mt != null && <ReferenceLine x={nearest(mt)} stroke={THEM} strokeDasharray="3 3" />}
      </AreaChart>
    </ResponsiveContainer>
  );
}

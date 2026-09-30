import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useThemeColors from "../useThemeColors.js";

// How long possessions last (live time), ours vs theirs, same bins.
export default function DurationHistogram({ us, them }) {
  const c = useThemeColors();
  const data = us.histogram.map((b, i) => ({ bin: b.bin, us: b.n, them: them.histogram[i].n }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: -24, right: 4, top: 8, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke={c.rule} />
        <XAxis dataKey="bin" tickLine={false} axisLine={{ stroke: c.rule }} tick={{ fill: c["ink-2"], fontSize: 12 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: c["ink-3"], fontSize: 11 }} />
        <Tooltip cursor={{ fill: c.rule, opacity: 0.5 }} formatter={(v, k) => [v, k === "us" ? "Lauréats" : "Adversaire"]} />
        <Legend formatter={(k) => (k === "us" ? "Lauréats" : "Adversaire")} wrapperStyle={{ fontSize: 12 }} iconType="square" />
        <Bar dataKey="us" fill={c.ink} maxBarSize={22} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="them" fill={c.them} maxBarSize={22} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

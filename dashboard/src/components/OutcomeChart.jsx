import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useThemeColors from "../useThemeColors.js";
import ChartTooltip from "./ChartTooltip.jsx";
import { OUTCOME_LABELS, pct } from "../format.js";

// How each of our possessions ended (one outcome each, best first).
// The most frequent loss type is set in bold (gold is reserved for positives).
export default function OutcomeChart({ outcomes, rates }) {
  const c = useThemeColors();
  const data = Object.keys(OUTCOME_LABELS).map((k) => ({ key: k, label: OUTCOME_LABELS[k], count: outcomes[k] ?? 0, rate: rates[k] }));
  const lossKeys = ["cheap_loss", "loss_opp_half", "loss_own_half"];
  const topLoss = data.filter((d) => lossKeys.includes(d.key)).sort((a, b) => b.count - a.count)[0]?.key;
  return (
    <ResponsiveContainer width="100%" height={data.length * 32 + 8}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 72, top: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={176} tickLine={false} axisLine={false}
          tick={({ x, y, payload }) => {
            const top = data[payload.index]?.key === topLoss;
            return <text x={x} y={y} dy={4} textAnchor="end" fontSize={13} fontWeight={top ? 700 : 400} fill={top ? c.ink : c["ink-2"]}>{payload.value}</text>;
          }} />
        <Tooltip cursor={{ fill: c.rule, opacity: 0.5 }} content={<ChartTooltip format={(r) => `${r.count} · ${pct(r.rate)}`} />} />
        <Bar dataKey="count" barSize={16} radius={[0, 3, 3, 0]} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.key} fill={d.key === "goal" || d.key === "shot" ? c["gold-deep"] : c.ink} />)}
          <LabelList dataKey="count" content={({ x, y, width, height, index }) => (
            <text x={x + width + 8} y={y + height / 2} dy={4} fontSize={13} fill={c["ink-2"]} style={{ fontVariantNumeric: "tabular-nums" }}>
              {data[index].count ? `${data[index].count} · ${pct(data[index].rate)}` : ""}
            </text>
          )} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

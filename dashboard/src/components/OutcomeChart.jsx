import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useThemeColors from "../useThemeColors.js";
import ChartTooltip from "./ChartTooltip.jsx";
import { OUTCOME_LABELS, pct } from "../format.js";

// How each of our possessions ended - one series, fixed outcome order.
export default function OutcomeChart({ outcomes, rates }) {
  const c = useThemeColors();
  const data = Object.keys(OUTCOME_LABELS).map((k) => ({
    key: k, label: OUTCOME_LABELS[k], count: outcomes[k] ?? 0, rate: rates[k],
  }));
  return (
    <ResponsiveContainer width="100%" height={data.length * 34 + 10}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 64, top: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={170} tickLine={false} axisLine={false}
          tick={{ fill: c["text-secondary"], fontSize: 12 }} />
        <Tooltip cursor={{ fill: c.line, opacity: 0.4 }}
          content={<ChartTooltip color={c.us} format={(r) => `${r.count} · ${pct(r.rate)}`} />} />
        <Bar dataKey="count" fill={c.us} barSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="count" position="right"
            formatter={(v) => v}
            content={({ x, y, width, height, index }) => (
              <text x={x + width + 8} y={y + height / 2} dy={4} fontSize={12} fill={c["text-secondary"]}>
                {data[index].count ? `${data[index].count} · ${pct(data[index].rate)}` : ""}
              </text>
            )} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

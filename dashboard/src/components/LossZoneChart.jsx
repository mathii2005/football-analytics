import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useThemeColors from "../useThemeColors.js";
import ChartTooltip from "./ChartTooltip.jsx";
import { ZONE_LABELS } from "../format.js";

// Where on the pitch we lose the ball (PERTE zone), own end -> their box.
export default function LossZoneChart({ byZone }) {
  const c = useThemeColors();
  const data = ["1", "2", "3", "4", "BOX"].map((z) => ({ zone: z, label: ZONE_LABELS[z], count: byZone[z] ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: -20, right: 8, top: 20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.line} />
        <XAxis dataKey="zone" tickLine={false} axisLine={{ stroke: c.line }}
          tick={{ fill: c["text-secondary"], fontSize: 12 }}
          tickFormatter={(z) => (z === "BOX" ? "Box" : `Z${z}`)} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: c["text-muted"], fontSize: 11 }} />
        <Tooltip cursor={{ fill: c.line, opacity: 0.4 }}
          content={<ChartTooltip color={c.us} format={(r) => `${r.count} losses`} />} />
        <Bar dataKey="count" fill={c.us} barSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          <LabelList dataKey="count" position="top" fill={c["text-secondary"]} fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

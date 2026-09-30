import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import useThemeColors from "../useThemeColors.js";
import ChartTooltip from "./ChartTooltip.jsx";

// Threat score per 5 minutes (staff's existing weights), one small chart per
// half on a shared scale. Windows with a goal for us are gold.
function HalfChart({ bins, max, c }) {
  const data = bins.map((b) => ({ ...b, label: `${b.minute}'–${b.minute + 5}'` }));
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} margin={{ left: -28, right: 4, top: 8, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={c.rule} />
        <XAxis dataKey="minute" tickLine={false} axisLine={{ stroke: c.rule }} interval={1}
          tick={{ fill: c["ink-3"], fontSize: 11 }} tickFormatter={(m) => `${m}'`} />
        <YAxis domain={[0, max]} tickCount={3} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: c["ink-3"], fontSize: 11 }} />
        <Tooltip cursor={{ fill: c.rule, opacity: 0.5 }}
          content={<ChartTooltip format={(r) => `${r.threat} pts${r.goals_us ? ` · ${r.goals_us} but` : ""}${r.goals_them ? ` · ${r.goals_them} but adv.` : ""}`} />} />
        <Bar dataKey="threat" maxBarSize={20} radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.minute} fill={d.goals_us ? c["gold-deep"] : c.ink} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function ThreatChart({ threat }) {
  const c = useThemeColors();
  const max = Math.max(4, ...threat.map((b) => b.threat));
  const halves = [...new Set(threat.map((b) => b.half))];
  return (
    <div>
      <div className="grid gap-6 md:grid-cols-2">
        {halves.map((h) => (
          <div key={h} className="min-w-0">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-3">{h === 1 ? "1re mi-temps" : "2e mi-temps"}</div>
            <HalfChart bins={threat.filter((b) => b.half === h)} max={max} c={c} />
          </div>
        ))}
      </div>
      <p className="mt-2 flex items-center gap-2 text-xs text-ink-3">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gold-deep" /> fenêtre avec un but des Lauréats
      </p>
    </div>
  );
}

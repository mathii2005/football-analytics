import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useThemeColors from "../useThemeColors.js";

// Momentum ("intensité offensive"): threat per 5 minutes on one continuous
// axis across both halves. Windows with our goal are gold. Markers above
// each bar: goals (B, gold = ours, grey = theirs) and cards (J / R).
function Markers({ x, y, width, index, data, c }) {
  const d = data[index];
  const items = [
    ...Array(d.goals_us).fill({ kind: "B", fill: c.gold, ink: c.ink }),
    ...Array(d.goals_them).fill({ kind: "B", fill: c.them, ink: "#fff" }),
    ...d.cards.map((k) => ({ kind: k.code === "CARTON_ROUGE" ? "R" : "J", fill: k.code === "CARTON_ROUGE" ? "#b3261e" : "#e8c547",
      ink: k.code === "CARTON_ROUGE" ? "#fff" : c.ink, square: true, them: k.team === "them" })),
  ];
  const cx = x + width / 2;
  return (
    <g>
      {items.map((it, i) => {
        const cy = y - 10 - i * 15;
        return it.square
          ? <g key={i}><rect x={cx - 5} y={cy - 6} width={10} height={12} rx={1.5} fill={it.fill} stroke={it.them ? c.ink : "none"} strokeWidth={it.them ? 1 : 0} />
              <text x={cx} y={cy + 3} textAnchor="middle" fontSize={8} fontWeight={700} fill={it.ink}>{it.kind}</text></g>
          : <g key={i}><circle cx={cx} cy={cy} r={6} fill={it.fill} stroke="#fff" strokeWidth={1.5} />
              <text x={cx} y={cy + 3} textAnchor="middle" fontSize={7} fontWeight={700} fill={it.ink}>{it.kind}</text></g>;
      })}
    </g>
  );
}

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded border border-rule bg-paper px-3 py-2 text-xs shadow-[0_4px_16px_rgba(10,10,10,0.08)]">
      <div className="text-sm font-semibold text-ink tabular">{d.threat} pts</div>
      <div className="text-ink-3">{d.minute}'–{d.minute + 5}' · MT{d.half}</div>
      {d.goals_us > 0 && <div className="text-ink-2">{d.goals_us} but Lauréats</div>}
      {d.goals_them > 0 && <div className="text-ink-2">{d.goals_them} but adverse</div>}
      {d.cards.map((k, i) => <div key={i} className="text-ink-2">{k.code === "CARTON_ROUGE" ? "Rouge" : "Jaune"} {k.team === "them" ? "adverse" : "Lauréats"} ({Math.floor(k.minute)}')</div>)}
    </div>
  );
}

export default function Momentum({ threat, cards }) {
  const c = useThemeColors();
  const data = threat.map((b) => ({
    ...b, k: `${b.half}-${b.minute}`,
    cards: cards.filter((k) => k.half === b.half && k.minute >= b.minute && k.minute < b.minute + 5),
  }));
  const max = Math.max(4, ...data.map((d) => d.threat));
  const firstH2 = data.find((d) => d.half === 2)?.k;
  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ left: -24, right: 8, top: 40, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={c.rule} />
          <XAxis dataKey="k" tickLine={false} axisLine={{ stroke: c.rule }} interval={1}
            tick={{ fill: c["ink-3"], fontSize: 11 }} tickFormatter={(k) => `${k.split("-")[1]}'`} />
          <YAxis domain={[0, max]} tickCount={3} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: c["ink-3"], fontSize: 11 }} />
          {firstH2 && <ReferenceLine x={firstH2} stroke={c["ink-3"]} strokeDasharray="0" label={{ value: "MT2", position: "insideTopLeft", fill: c["ink-3"], fontSize: 10 }} />}
          <Tooltip cursor={{ fill: c.rule, opacity: 0.5 }} content={<Tip />} />
          <Bar dataKey="threat" maxBarSize={18} radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.k} fill={d.goals_us ? c["gold-deep"] : c.ink} />)}
            <LabelList dataKey="threat" content={(props) => <Markers {...props} data={data} c={c} />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-gold-deep" />fenêtre avec un but Lauréats</span>
        <span>B = but (or : nous, gris : eux) · J / R = carton (bordé : adverse)</span>
        <span>Action 1 pt (+2 dans la surface), tir non cadré 3, cadré 4, but 6 : un indicateur de danger, pas un xG.</span>
      </div>
    </div>
  );
}

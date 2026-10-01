import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { US, THEM, GRID, MUTED, INK } from "./palette.js";

// Match story: two panels on one minute axis (synced tooltip).
// Top: our threat as a rolling "per 5 minutes" line (Gaussian-smoothed,
// line + area), our shots as ticks on the baseline. Bottom: our share of live possession in a rolling
// 5-minute window, filled gold above 50 % and blue below.
// Event lines run through both: goals (gold = us, blue = them), cards, half-time.
function xKey(m) { return `${m.half}-${m.minute}`; }

function EventLines({ events, axisTop }) {
  return events.filter((e) => e.kind !== "shot").map((e, i) => {
    const color = e.kind === "goal" ? (e.team === "us" ? US : THEM) : e.kind === "card" ? (e.code === "CARTON_ROUGE" ? "#c62828" : "#d4a017") : INK;
    const label = !axisTop ? undefined : e.kind === "goal" ? { value: e.team === "us" ? "But" : "But adv.", position: "top", fill: color, fontSize: 10 }
      : e.kind === "half" ? { value: "MT2", position: "top", fill: MUTED, fontSize: 10 } : undefined;
    return <ReferenceLine key={i} x={xKey(e)} stroke={color} strokeWidth={e.kind === "goal" ? 2 : 1}
      strokeDasharray={e.kind === "goal" ? undefined : "3 3"} label={label} ifOverflow="extendDomain" />;
  });
}

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-sm border border-rule bg-paper px-2.5 py-1.5 text-[11px] shadow-[0_4px_14px_rgba(10,10,10,0.1)]">
      <div className="font-semibold text-ink">{d.minute}' · MT{d.half}</div>
      <div className="text-ink-2">Menace {d.threat_5min.toFixed(1)} / 5 min (brute cette minute : {d.threat})</div>
      <div className="text-ink-2">Possession (±2,5 min) {d.poss_share == null ? "–" : `${Math.round(d.poss_share * 100)} %`}</div>
    </div>
  );
}

export default function MatchStory({ timeline }) {
  const data = timeline.minutes.map((m) => ({
    ...m, k: xKey(m),
    above: m.poss_share == null ? null : Math.max(m.poss_share, 0.5),
    below: m.poss_share == null ? null : Math.min(m.poss_share, 0.5),
  }));
  if (!data.length) return <p className="text-sm text-ink-3">Pas de données.</p>;
  const events = timeline.events.filter((e) => data.some((d) => d.k === xKey(e)));
  const tick = { fill: MUTED, fontSize: 10 };
  // same clock as the possession strip: every 10 min in half 1 (0..40),
  // every 10 min from 45 in half 2 (45..85)
  const keys = new Set(data.map((d) => d.k));
  const ticks = [...[0, 10, 20, 30, 40].map((m) => `1-${m}`), ...[45, 55, 65, 75, 85].map((m) => `2-${m}`)].filter((k) => keys.has(k));
  const fmt = (k) => `${k.split("-")[1]}'`;
  return (
    <div>
      <div className="text-[11px] font-medium text-ink-2">Menace offensive, points / 5 min (lissage gaussien σ = 2,5 min)</div>
      <ResponsiveContainer width="100%" height={170}>
        <ComposedChart data={data} syncId="story" margin={{ left: -22, right: 8, top: 18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="k" hide />
          <YAxis tick={tick} tickLine={false} axisLine={false} tickCount={4} />
          <Tooltip content={<Tip />} cursor={{ stroke: MUTED, strokeDasharray: "2 2" }} />
          <Area type="monotone" dataKey="threat_5min" stroke={US} strokeWidth={2} fill={US} fillOpacity={0.2} isAnimationActive={false} />
          {timeline.events.filter((e) => e.kind === "shot").map((e, i) => (
            <ReferenceDot key={`s${i}`} x={xKey(e)} y={0} r={3.5} fill={e.code === "TIR_C" ? INK : "#fff"} stroke={INK} strokeWidth={1.2} ifOverflow="visible" />
          ))}
          {EventLines({ events, axisTop: true })}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-1 text-[11px] font-medium text-ink-2">Possession (fenêtre glissante de 5 min)</div>
      <ResponsiveContainer width="100%" height={130}>
        <ComposedChart data={data} syncId="story" margin={{ left: -22, right: 8, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="k" tick={tick} tickLine={false} axisLine={{ stroke: GRID }} ticks={ticks} interval={0} tickFormatter={fmt} />
          <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v) => `${v * 100}%`} tick={tick} tickLine={false} axisLine={false} />
          <Tooltip content={<Tip />} cursor={{ stroke: MUTED, strokeDasharray: "2 2" }} />
          <ReferenceLine y={0.5} stroke={MUTED} />
          <Area type="monotone" dataKey="above" baseValue={0.5} stroke="none" fill={US} fillOpacity={0.35} isAnimationActive={false} connectNulls />
          <Area type="monotone" dataKey="below" baseValue={0.5} stroke="none" fill={THEM} fillOpacity={0.35} isAnimationActive={false} connectNulls />
          <Line type="monotone" dataKey="poss_share" stroke={INK} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
          {EventLines({ events, axisTop: false })}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
        <span><span className="mr-1 inline-block h-0.5 w-3 align-middle" style={{ background: US }} />But Lauréats</span>
        <span><span className="mr-1 inline-block h-0.5 w-3 align-middle" style={{ background: THEM }} />But adverse</span>
        <span><span className="mr-1 inline-block h-0.5 w-3 border-t border-dashed align-middle" style={{ borderColor: "#d4a017" }} />Carton</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-ink align-middle" />Tir cadré <span className="ml-1 mr-1 inline-block h-2 w-2 rounded-full border border-ink align-middle" />non cadré</span>
        <span>Menace = action 1, +2 surface, tir 3–4, but 6 (pas un xG).</span>
      </div>
    </div>
  );
}

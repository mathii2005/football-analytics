import { clock } from "../format.js";
import { SHOT_V_FR } from "./format.js";

// The match in xG: cumulative xG of each team minute by minute (steps at each
// shot), goals as large dots, half-time as a dashed line. One shared scale.
const W = 800, H = 240, L = 36, R = 744, T = 12, B = 206;

export default function XgFlow({ shots }) {
  if (!shots?.length) return null;
  const end = Math.max(95, ...shots.map((s) => s.t / 60000 + 1));
  const total = (team) => shots.filter((s) => s.team === team).reduce((a, s) => a + s.xg, 0);
  const top = Math.max(0.5, Math.ceil(Math.max(total("US"), total("THEM")) * 2 + 0.4) / 2);
  const x = (min) => L + (min / end) * (R - L), y = (v) => B - (v / top) * (B - T);
  const ticks = [0, top / 2, top];
  const series = ["US", "THEM"].map((team) => {
    let cum = 0, d = `M${x(0)},${y(0)}`;
    const pts = [];
    for (const s of [...shots].filter((s) => s.team === team).sort((a, b) => a.t - b.t)) {
      d += ` H${x(s.t / 60000)}`; cum += s.xg; d += ` V${y(cum)}`;
      pts.push({ ...s, cum });
    }
    return { team, d: `${d} H${x(end)}`, pts, cum, color: team === "US" ? "var(--us)" : "var(--them)" };
  });
  return (
    <div>
      <div className="mb-1 flex gap-4 text-[11px] text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: "var(--us)" }} />Lauréats</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: "var(--them)" }} />Adversaire</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-ink-3 bg-ink-3" />But</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="xG cumulé au fil du match">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={R} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{v.toFixed(1).replace(".", ",")}</text>
          </g>
        ))}
        {[0, 15, 30, 45, 60, 75, 90].map((m) => <text key={m} x={x(m)} y={B + 18} textAnchor="middle" fontSize="11" fill="var(--ink-3)">{m}'</text>)}
        <line x1={x(45)} x2={x(45)} y1={T} y2={B} stroke="var(--ink-3)" strokeDasharray="3 4" />
        {series.map((s) => (
          <g key={s.team}>
            <path d={s.d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" />
            <text x={R + 6} y={y(s.cum) + 4} fontSize="12" fontWeight="600" fill={s.color}>{s.cum.toFixed(2).replace(".", ",")}</text>
            {s.pts.map((p) => (
              <circle key={`${p.half}-${p.t}`} cx={x(p.t / 60000)} cy={y(p.cum)} r={p.v === "GOAL" ? 6.5 : 3.5}
                fill={p.v === "GOAL" ? s.color : "var(--paper)"} stroke={p.v === "GOAL" ? "var(--paper)" : s.color} strokeWidth="2">
                <title>{`${s.team === "US" ? "Lauréats" : "Adversaire"} · MT${p.half} ${clock(p.t)} · ${SHOT_V_FR[p.v]} · xG ${p.xg.toFixed(2)}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

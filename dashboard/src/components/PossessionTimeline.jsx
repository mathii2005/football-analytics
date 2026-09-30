import { useState } from "react";
import { clock, secs, OUTCOME_LABELS, START_LABELS, END_LABELS } from "../format.js";

const TICK_MS = 5 * 60 * 1000;

function GoalMarker({ team, left, title }) {
  return (
    <span role="img" aria-label={title} title={title}
      className={`absolute top-0 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full text-[9px] font-bold ring-2 ring-paper ${
        team === "us" ? "bg-gold text-ink" : "bg-them text-paper"}`}
      style={{ left: `${left}%` }}>B</span>
  );
}

function Tooltip({ p, x }) {
  return (
    <div className="pointer-events-none absolute bottom-full z-20 mb-3 w-60 -translate-x-1/2 rounded border border-rule bg-paper px-3 py-2 text-xs shadow-[0_6px_20px_rgba(10,10,10,0.10)]"
      style={{ left: `${Math.min(Math.max(x, 14), 86)}%` }}>
      <div className="flex items-center gap-2">
        <span className="inline-block h-0.5 w-3" style={{ background: `var(--${p.team})` }} />
        <span className="text-sm font-semibold text-ink tabular">{p.duration_ms != null ? secs(p.duration_ms) : "durée inconnue"}</span>
        <span className="text-ink-3">{p.team === "us" ? "Lauréats" : "Adversaire"}</span>
      </div>
      <div className="mt-1 text-ink-2 tabular">
        {p.start_exact ? "" : "~"}{clock(p.start_ms)} – {p.end_exact ? "" : "~"}{clock(p.end_ms)}
        {p.stoppage_ms > 0 && ` · ${Math.round(p.stoppage_ms / 1000)} s d'arrêt exclus`}
      </div>
      <div className="mt-1 text-ink-2">
        {START_LABELS[p.start_type] ?? p.start_type} → {END_LABELS[p.end_type] ?? p.end_type}
        {p.outcome && ` · ${OUTCOME_LABELS[p.outcome]}`}
      </div>
      {p.is_inferred && <div className="mt-1 text-gold-deep">Limite déduite (transition non taguée)</div>}
    </div>
  );
}

function Half({ half, possessions }) {
  const [hover, setHover] = useState(null);
  const start = Math.min(...possessions.map((p) => p.start_ms));
  const end = Math.max(...possessions.map((p) => p.end_ms));
  const span = Math.max(end - start, 1);
  const x = (t) => ((t - start) / span) * 100;
  const ticks = [];
  for (let t = Math.ceil(start / TICK_MS) * TICK_MS; t <= end; t += TICK_MS) ticks.push(t);

  return (
    <div className="mt-5 first:mt-0">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-3">{half === 1 ? "1re mi-temps" : "2e mi-temps"}</div>
      <div className="relative h-5">
        {possessions.flatMap((p) => [
          ...p.shot_ms.map((t) => (
            <span key={`s${t}`} title={`Tir ${clock(t)}`}
              className="absolute top-1.5 h-2 w-2 -translate-x-1/2 rounded-full ring-2 ring-paper"
              style={{ left: `${x(t)}%`, background: `var(--${p.team})` }} />
          )),
          ...p.goal_ms.map((t) => <GoalMarker key={`g${t}`} team="us" left={x(t)} title={`But ${clock(t)}`} />),
          ...(p.end_type === "opp_goal"
            ? [<GoalMarker key={`og${p.possession_id}`} team="them" left={x(p.end_ms)}
                title={`But adverse ${p.end_exact ? "" : "vers "}${clock(p.end_ms)}`} />]
            : []),
        ])}
      </div>
      <div className="relative h-8 w-full" onMouseLeave={() => setHover(null)}>
        {possessions.map((p) => (
          <button key={p.possession_id} type="button"
            aria-label={`${p.team === "us" ? "Lauréats" : "Adversaire"} ${clock(p.start_ms)} à ${clock(p.end_ms)}`}
            onMouseEnter={() => setHover(p)} onFocus={() => setHover(p)} onBlur={() => setHover(null)}
            className={`absolute top-0 h-full border-r-2 border-paper transition-opacity duration-150 ${p.is_inferred ? "hatched" : ""} ${
              hover && hover.possession_id !== p.possession_id ? "opacity-40" : ""}`}
            style={{ left: `${x(p.start_ms)}%`, width: `${Math.max(x(p.end_ms) - x(p.start_ms), 0.15)}%`, backgroundColor: `var(--${p.team})` }} />
        ))}
        {hover && <Tooltip p={hover} x={x((hover.start_ms + hover.end_ms) / 2)} />}
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-ink-3 tabular">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${x(t)}%` }}>{Math.round(t / 60000)}'</span>
        ))}
      </div>
    </div>
  );
}

export default function PossessionTimeline({ possessions }) {
  const halves = [...new Set(possessions.map((p) => p.half))].sort();
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-ink" />Lauréats</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-them" />Adversaire</span>
        <span className="flex items-center gap-1.5"><span className="hatched h-3 w-3 rounded-sm bg-ink-3" />Limite déduite</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink" />Tir</span>
        <span className="flex items-center gap-1.5"><span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold text-[8px] font-bold text-ink">B</span>But</span>
      </div>
      {halves.map((h) => <Half key={h} half={h} possessions={possessions.filter((p) => p.half === h)} />)}
    </div>
  );
}

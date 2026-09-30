import { useState } from "react";
import { clock, seconds, OUTCOME_LABELS } from "../format.js";

const TICK_MS = 5 * 60 * 1000;

function Tooltip({ p, x }) {
  const label = p.team === "us" ? "Us" : "Them";
  return (
    <div
      className="pointer-events-none absolute bottom-full z-10 mb-3 w-56 -translate-x-1/2 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg"
      style={{ left: `${Math.min(Math.max(x, 12), 88)}%` }}
    >
      <div className="flex items-center gap-2">
        <span className="inline-block h-0.5 w-3" style={{ background: `var(--${p.team})` }} />
        <span className="text-sm font-semibold text-ink tabular">
          {p.duration_ms != null ? seconds(p.duration_ms) : "duration unknown"}
        </span>
        <span className="text-muted">{label}</span>
      </div>
      <div className="mt-1 text-muted tabular">
        {p.start_exact ? "" : "~"}{clock(p.start_ms)} – {p.end_exact ? "" : "~"}{clock(p.end_ms)}
        {p.stoppage_ms > 0 && ` · ${Math.round(p.stoppage_ms / 1000)}s dead ball excluded`}
      </div>
      <div className="mt-1 text-muted">
        {p.start_type} → {p.end_type}
        {p.outcome && ` · ${OUTCOME_LABELS[p.outcome]}`}
      </div>
      {p.codes && <div className="mt-1 truncate text-faint">{p.codes}</div>}
      {p.is_inferred && <div className="mt-1 text-warn">Boundary inferred (untagged)</div>}
    </div>
  );
}

function GoalMarker({ team, left, title }) {
  return (
    <span title={title} aria-label={title}
      className="absolute top-0 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-[var(--card)]"
      style={{ left: `${left}%`, background: `var(--${team})` }}>G</span>
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
    <div className="mt-6 first:mt-0">
      <div className="mb-2 text-xs font-medium text-muted">Half {half}</div>
      <div className="relative">
        {/* shot / goal markers, above the band */}
        <div className="relative h-5">
          {possessions.flatMap((p) => [
            ...p.shot_ms.map((t) => (
              <span key={`s${t}`} title={`Shot ${clock(t)}`}
                className="absolute top-1.5 h-2 w-2 -translate-x-1/2 rounded-full ring-2 ring-[var(--card)]"
                style={{ left: `${x(t)}%`, background: `var(--${p.team})` }} />
            )),
            ...p.goal_ms.map((t) => <GoalMarker key={`g${t}`} team="us" left={x(t)} title={`Goal ${clock(t)}`} />),
            // opponent goals aren't tagged: placed where their possession ended
            ...(p.end_type === "opp_goal"
              ? [<GoalMarker key={`og${p.possession_id}`} team="them" left={x(p.end_ms)}
                  title={`Goal against ${p.end_exact ? "" : "~"}${clock(p.end_ms)}${p.end_exact ? "" : " (time estimated)"}`} />]
              : []),
          ])}
        </div>

        <div className="relative flex h-9 w-full overflow-visible" onMouseLeave={() => setHover(null)}>
          {possessions.map((p) => (
            <button
              key={p.possession_id}
              type="button"
              aria-label={`${p.team} ${clock(p.start_ms)} to ${clock(p.end_ms)}, ${p.start_type} to ${p.end_type}`}
              onMouseEnter={() => setHover(p)}
              onFocus={() => setHover(p)}
              onBlur={() => setHover(null)}
              className={`absolute top-0 h-full border-r-2 border-[var(--card)] outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ink ${
                p.is_inferred ? "hatched opacity-70" : ""
              } ${hover && hover.possession_id !== p.possession_id ? "opacity-60" : ""}`}
              style={{
                left: `${x(p.start_ms)}%`,
                width: `${Math.max(x(p.end_ms) - x(p.start_ms), 0.15)}%`,
                backgroundColor: `var(--${p.team})`,
              }}
            />
          ))}
          {hover && <Tooltip p={hover} x={x((hover.start_ms + hover.end_ms) / 2)} />}
        </div>

        <div className="relative mt-1 h-4 text-[10px] text-faint tabular">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: `${x(t)}%` }}>
              {Math.round(t / 60000)}'
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PossessionTimeline({ possessions }) {
  const halves = [...new Set(possessions.map((p) => p.half))].sort();
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-us" />Us</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-them" />Them</span>
        <span className="flex items-center gap-1.5"><span className="hatched h-3 w-3 rounded-sm bg-faint" />Inferred boundary</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-faint" />Shot</span>
        <span className="flex items-center gap-1.5"><span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-faint text-[8px] font-bold text-white">G</span>Goal</span>
      </div>
      {halves.map((h) => (
        <Half key={h} half={h} possessions={possessions.filter((p) => p.half === h)} />
      ))}
    </div>
  );
}

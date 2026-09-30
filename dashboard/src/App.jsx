import { useEffect, useState } from "react";
import { fetchMatch, fetchMatches } from "./api.js";
import { pct, seconds } from "./format.js";
import Card from "./components/Card.jsx";
import StatTile from "./components/StatTile.jsx";
import PossessionTimeline from "./components/PossessionTimeline.jsx";
import OutcomeChart from "./components/OutcomeChart.jsx";
import LossZoneChart from "./components/LossZoneChart.jsx";
import CouloirTable from "./components/CouloirTable.jsx";
import QualityPanel from "./components/QualityPanel.jsx";
import PossessionTable from "./components/PossessionTable.jsx";

function matchLabel(m) {
  const score = m.final_score ? ` ${m.final_score.us}–${m.final_score.them}` : "";
  return `${m.date ?? "?"} · ${m.opponent ?? m.id}${score}`;
}

export default function App() {
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMatches()
      .then((ms) => {
        setMatches(ms);
        if (ms.length) setSelected(ms[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetchMatch(selected)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected]);

  const m = data?.summary.metrics;
  const info = data?.summary.match;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Match analytics</h1>
          <p className="text-sm text-muted">Possessions rebuilt from tagged events</p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Match
          <select
            className="min-w-64 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
            value={selected ?? ""}
            onChange={(e) => setSelected(e.target.value)}
          >
            {matches.map((mm) => <option key={mm.id} value={mm.id}>{matchLabel(mm)}</option>)}
          </select>
        </label>
      </header>

      {error && (
        <div className="mt-6 rounded-xl border border-line bg-card p-4 text-sm text-ink">
          <span className="text-warn">⚠</span> Could not load data: {error}. Is the API running on port 8000?
        </div>
      )}

      {data && (
        <main className={`mt-6 space-y-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
          <div className="flex flex-wrap items-baseline gap-x-3 text-sm text-muted">
            <span className="text-lg font-semibold text-ink">
              Laureats {info.final_score?.us ?? "?"}–{info.final_score?.them ?? "?"} {info.opponent}
            </span>
            <span>{info.date} · {info.venue}</span>
            {info.veo_url && <a className="text-us underline" href={info.veo_url} target="_blank" rel="noreferrer">Veo video</a>}
          </div>

          <div className="grid gap-4 md:grid-cols-[1.2fr_2fr]">
            <Card>
              <div className="text-xs text-muted">Possession (strict)</div>
              <div className="mt-1 text-5xl font-semibold text-ink tabular">{pct(m.possession_pct.strict)}</div>
              <div className="mt-2 text-sm text-muted">
                Inclusive {pct(m.possession_pct.inclusive)} · {pct(m.possession_pct.coverage)} of live time exactly bounded
              </div>
              <div className="mt-3 text-xs text-faint">
                {m.possessions_us} possessions for us, {m.possessions_them} for them.
                Strict counts only possessions with tagged boundaries; inclusive splits untagged gaps evenly.
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatTile label="Shot sequences" value={m.shot_sequences} note={`${pct(m.shot_sequence_rate)} of our possessions`} />
              <StatTile label="Recovery → shot" value={seconds(m.turnover_to_shot_ms.median)} note={`median, n=${m.turnover_to_shot_ms.n}`} />
              <StatTile label="PPDA-lite" value={m.ppda_lite == null ? "–" : m.ppda_lite.toFixed(1)} note={`${m.high_recups} high recoveries`} />
              <StatTile label="Field tilt" value={pct(m.field_tilt)} note="our time in final third" />
              <StatTile label="Direct / sustained" value={`${m.direct} / ${m.sustained}`} note="attacks reaching the box" />
              <StatTile label="Untagged transitions" value={data.quality.inferred_transitions.length} note="inferred, check on video" />
            </div>
          </div>

          <Card title="Possession timeline" subtitle="Hover or tab through a possession for details. Dead ball (stoppages) excluded from durations.">
            <PossessionTimeline possessions={data.possessions} />
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card title="How our possessions end" subtitle="One outcome per possession, best outcome first">
              <OutcomeChart outcomes={m.outcomes} rates={m.outcome_rates} />
            </Card>
            <Card title="Where we lose the ball" subtitle={`${data.losses.losses.length} losses · ${data.losses.conceded_after_loss} led straight to a goal against`}>
              <LossZoneChart byZone={data.losses.by_zone} />
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Possession value by couloir" subtitle="Small samples per match: read across the season">
              <CouloirTable couloirs={m.couloirs} />
            </Card>
            <Card title="Tagging quality" subtitle="Automatic checks, no video">
              <QualityPanel quality={data.quality} />
            </Card>
          </div>

          <Card>
            <PossessionTable possessions={data.possessions} />
          </Card>
        </main>
      )}
    </div>
  );
}

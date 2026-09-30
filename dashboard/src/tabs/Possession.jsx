import Section from "../components/Section.jsx";
import SplitBars from "../components/SplitBars.jsx";
import DurationHistogram from "../components/DurationHistogram.jsx";
import StartOutcomeMatrix from "../components/StartOutcomeMatrix.jsx";
import RecoveryValue from "../components/RecoveryValue.jsx";
import CounterPress from "../components/CounterPress.jsx";
import TransitionSpeed from "../components/TransitionSpeed.jsx";
import OutcomeChart from "../components/OutcomeChart.jsx";
import PossessionTable from "../components/PossessionTable.jsx";
import { START_GROUP_LABELS, STATE_LABELS, ZONE_LABELS, pct, secs, dec, mmss } from "../format.js";

// What only the possession engine can tell: when we had the ball, how long,
// what it turned into, and how fast we win it back.
export default function Possession({ d }) {
  const ph = d.phases, r = d.report;
  const halves = ph.splits.by_half.map((h) => ({ label: h.half === 1 ? "1re mi-temps" : "2e mi-temps", ...h }));
  const periods = ph.splits.by_period.map((p) => ({ label: `${p.label}'`, ...p }));
  const states = ph.splits.by_state.filter((s) => s.n_us + s.n_them > 0)
    .map((s) => ({ label: `${STATE_LABELS[s.state]} (${s.n_us})`, strict: s.strict, inclusive: null }));
  const starts = ["recup", "set_piece", "kickoff", "other"].map((k) => ({ key: k, label: START_GROUP_LABELS[k] }));
  const zones = ["1", "2", "3", "4", "BOX"].map((k) => ({ key: k, label: ZONE_LABELS[k] }));
  const f = ph.finishing, def = ph.defence, gt = ph.game_time;
  return (
    <div className="space-y-10">
      <div className="grid gap-10 lg:grid-cols-3">
        <Section title="Par mi-temps" note="Barre = possession stricte ; trait or = en comptant les phases déduites.">
          <SplitBars rows={halves} />
        </Section>
        <Section title="Par quart d'heure">
          <SplitBars rows={periods} />
        </Section>
        <Section title="Selon le score" note="Au début de la possession (nombre de nos possessions).">
          <SplitBars rows={states} />
        </Section>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Durée des possessions" note={`Temps de jeu effectif. Médiane : nous ${secs(ph.profile.us.median_ms)}, eux ${secs(ph.profile.them.median_ms)} ; plus longue : ${secs(ph.profile.us.max_ms)}.`}>
          <DurationHistogram us={ph.profile.us} them={ph.profile.them} />
        </Section>
        <Section title="Comment finissent nos possessions" note="Une issue par possession. En or : buts et tirs ; en gras : la perte la plus fréquente.">
          <OutcomeChart outcomes={r.metrics.outcomes} rates={r.metrics.outcome_rates} />
        </Section>
      </div>

      <Section title="Départ → issue" note="Comment la possession a commencé, et ce qu'elle est devenue.">
        <StartOutcomeMatrix cells={ph.profile.start_x_outcome} rowKey="start" rows={starts} />
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Valeur des récupérations" note="Par zone de récupération (nombre entre parenthèses).">
          <RecoveryValue rows={ph.progression.recovery_value} />
        </Section>
        <Section title="Zone de départ → issue" note="Zone de la récupération ou du coup de pied arrêté qui lance la possession.">
          <StartOutcomeMatrix cells={ph.progression.start_zone_x_outcome} rowKey="zone" rows={zones} />
        </Section>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Contre-pressing" note="Après chacune de nos pertes : temps pour récupérer le ballon.">
          <CounterPress cp={ph.counter_press} />
        </Section>
        <Section title="Vitesse de transition" note="Définition de l'ancien tableau de bord.">
          <TransitionSpeed t={r.transition_speed} />
        </Section>
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        <Section title="Phases défensives">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-rule pb-2"><dt className="text-ink-2">Possession adverse médiane</dt><dd className="font-semibold text-ink tabular">{secs(def.median_opp_ms)}</dd></div>
            <div className="flex justify-between border-b border-rule pb-2"><dt className="text-ink-2">Terminées par une récup haute</dt><dd className="font-semibold text-ink tabular">{pct(def.ended_by_high_recup_share)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-2">Intensité du pressing (PPDA-lite)</dt><dd className="font-semibold text-ink tabular">{dec(def.ppda_lite)}</dd></div>
          </dl>
        </Section>
        <Section title="Efficacité">
          <table className="w-full text-sm tabular">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-ink-3">
              <th className="pb-2 font-medium">Départ</th><th className="pb-2 text-right font-medium">Poss.</th><th className="pb-2 text-right font-medium">Avec tir</th></tr></thead>
            <tbody>
              {f.shot_sequences_by_start.filter((s) => s.n).map((s) => (
                <tr key={s.start} className="border-t border-rule">
                  <td className="py-2 text-ink">{START_GROUP_LABELS[s.start]}</td>
                  <td className="py-2 text-right text-ink">{s.n}</td>
                  <td className="py-2 text-right text-ink">{s.shot_seq} <span className="text-ink-3">({pct(s.shot_seq / s.n)})</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Section title="Temps de jeu">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-rule pb-2"><dt className="text-ink-2">Temps effectif</dt><dd className="font-semibold text-ink tabular">{mmss(gt.live_ms)}</dd></div>
            <div className="flex justify-between border-b border-rule pb-2"><dt className="text-ink-2">Arrêts longs tagués</dt><dd className="font-semibold text-ink tabular">{mmss(gt.dead_ms)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-2">Actions par minute de possession</dt><dd className="font-semibold text-ink tabular">{dec(gt.actions_per_live_min)}</dd></div>
          </dl>
        </Section>
      </div>
      <PossessionTable possessions={d.possessions} />
    </div>
  );
}

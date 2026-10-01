import Tile from "../charts/Tile.jsx";
import FlowSankey from "../charts/FlowSankey.jsx";
import RegainCurve from "../charts/RegainCurve.jsx";
import TransitionSwarm from "../charts/TransitionSwarm.jsx";
import DurationDensity from "../charts/DurationDensity.jsx";
import BandPitch from "../charts/BandPitch.jsx";
import StateDots from "../charts/StateDots.jsx";
import { goldRamp } from "../charts/palette.js";
import CounterPress from "../components/CounterPress.jsx";
import PossessionTable from "../components/PossessionTable.jsx";
import { counterPressPreset } from "../links.js";
import { START_GROUP_LABELS, pct, secs, dec, mmss, plural } from "../format.js";

const MIN_N = 5;

function KV({ rows }) {
  return (
    <dl className="divide-y divide-rule text-[12px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 py-1.5"><dt className="text-ink-2">{k}</dt><dd className="font-semibold text-ink tabular">{v}</dd></div>
      ))}
    </dl>
  );
}

// The possession engine's tab: flows, survival, distributions, space.
export default function Possession({ d, openClips }) {
  const ph = d.phases, r = d.report;
  const rv = ph.progression.recovery_value;
  const maxBox = Math.max(0.01, ...rv.filter((z) => z.n >= MIN_N).map((z) => z.box_rate ?? 0));
  const rvRows = rv.map((z) => ({
    zone: z.zone, t: z.n ? Math.min(1, (z.box_rate ?? 0) / maxBox) * (z.n < MIN_N ? 0.3 : 1) : 0,
    big: z.n ? pct(z.box_rate) + (z.n < MIN_N ? "*" : "") : "–",
    small: z.n ? `${z.n} récup · ${pct(z.shot_rate)} finissent par un tir` : "aucune récupération",
  }));
  const f = ph.finishing, def = ph.defence, gt = ph.game_time;
  const halves = ph.splits.by_half;
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <Tile className="lg:col-span-7" title="Comment nos possessions commencent-elles, et comment finissent-elles ?"
        note="Largeur = nombre de possessions. Or : danger créé ; bleu : ballon perdu ; gris : sortie ou fin non taguée.">
        <FlowSankey flow={ph.flow} />
      </Tile>
      <Tile className="lg:col-span-5" title="À quelle vitesse récupère-t-on le ballon après l'avoir perdu ?"
        note="Part des pertes pas encore reprises, seconde par seconde. Une chute rapide = bon contre-pressing.">
        <RegainCurve curve={ph.regain_curve} />
      </Tile>
      <Tile className="lg:col-span-7" title="Sommes-nous directs après une récupération ?"
        note={`Chaque point : une récupération suivie d'une action dangereuse (n = ${r.transition_speed.n}, ${pct(r.transition_speed.pct_leading)} de nos récupérations).`}>
        <TransitionSwarm deltas={r.transition_speed.deltas_s} median={r.transition_speed.median_s} />
      </Tile>
      <Tile className="lg:col-span-5" title="Qui garde le ballon plus longtemps ?" note="Distribution des durées de possession (temps de jeu effectif, échelle logarithmique).">
        <DurationDensity us={ph.durations.us} them={ph.durations.them} />
      </Tile>
      <Tile className="lg:col-span-4" title="Quelles récupérations deviennent dangereuses ?"
        note={`% de récupérations dont la possession atteint la surface ; * moins de ${MIN_N} récupérations.`}>
        <BandPitch rows={rvRows} color={goldRamp} label="Valeur des récupérations par zone"
          onZone={(zone) => openClips({ zone, cats: ["recup"] })} />
      </Tile>
      <Tile className="lg:col-span-4" title="Le score change-t-il notre possession ?" note="Possession stricte selon le score au début de la possession.">
        <StateDots states={ph.splits.by_state} />
        <div className="mt-5 text-[11px] font-medium text-ink-2">Par mi-temps</div>
        <KV rows={halves.map((h) => [`MT${h.half}`, `${pct(h.strict)} (${pct(h.inclusive)} incl. déduites)`])} />
      </Tile>
      <Tile className="lg:col-span-4" title="Où le contre-pressing marche-t-il ?" note="Par zone de perte ; cliquer une zone pour voir ces pertes.">
        <CounterPress cp={ph.counter_press} onZone={(zone) => openClips(counterPressPreset(zone))} />
      </Tile>
      <Tile className="lg:col-span-4" title="Phases défensives">
        <KV rows={[["Possession adverse médiane", secs(def.median_opp_ms)], ["Terminées par une récup haute", pct(def.ended_by_high_recup_share)],
          ["Intensité du pressing (PPDA-lite)", dec(def.ppda_lite)]]} />
      </Tile>
      <Tile className="lg:col-span-4" title="Efficacité selon le départ">
        <KV rows={f.shot_sequences_by_start.filter((s) => s.n).map((s) => [START_GROUP_LABELS[s.start], `${plural(s.shot_seq, "possession")} avec tir sur ${s.n}`])} />
      </Tile>
      <Tile className="lg:col-span-4" title="Temps de jeu">
        <KV rows={[["Temps effectif", mmss(gt.live_ms)], ["Arrêts longs tagués", mmss(gt.dead_ms)], ["Actions par minute de possession", dec(gt.actions_per_live_min)]]} />
      </Tile>
      <div className="lg:col-span-12"><PossessionTable possessions={d.possessions} /></div>
    </div>
  );
}

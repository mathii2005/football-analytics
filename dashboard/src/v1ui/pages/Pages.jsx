import Tile from "../../charts/Tile.jsx";
import MatchStory from "../../charts/MatchStory.jsx";
import FlowSankey from "../../charts/FlowSankey.jsx";
import RegainCurve from "../../charts/RegainCurve.jsx";
import DurationDensity from "../../charts/DurationDensity.jsx";
import SetPieceButterfly from "../../charts/SetPieceButterfly.jsx";
import PossessionTimeline from "../../components/PossessionTimeline.jsx";
import MetricTile from "../MetricTile.jsx";
import MetricRows from "../MetricRows.jsx";
import Bars from "../Bars.jsx";
import LaneGrid from "../LaneGrid.jsx";
import StatusChip from "../StatusChip.jsx";
import { fmtValue, subline, GROUP_FR, LANE_FR, PHASE_FR, CAUSE_FR, INTENT_FR, METHOD_FR } from "../format.js";
import { pct } from "../../format.js";

// The v1 pages (PIPELINE §7.2). Every tile is bound to catalogue metrics from
// /matches/{id}/metrics; clicks open the clips behind the number.
const PHASES = ["TRANSITION", "BUILD_UP", "SETTLED", "SET_PIECE"];
const xg2 = (v) => v.toFixed(2);

// ---------- Récap ----------
const PRIORITIES = [["identite", "Identité", "chance_share"], ["phases", "Phases", "transition_to_box"],
  ["couloir", "Couloir intérieur", "hs_entry_share"], ["zone", "Zone rouge", "box_entries"],
  ["intensite", "Intensité", "counterpress_5s"], ["defense", "Défense", "xg_against"]];

export function Recap({ d, v1, openClips, present }) {
  const M = v1.metrics, S = d.seasonV1?.metrics || {};
  const key = ["goals_for", "xg_for", "box_entries", "counterpress_5s", "shots_against"].filter((k) => M[k]?.clips?.all?.length);
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      {d.recap?.available && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-rule bg-paper px-4 py-3 lg:col-span-12">
          <p className="text-[13px] text-ink-2"><span className="font-semibold text-ink">Récap du lundi</span> · 5 diapos, ~10 min ·{" "}
            {d.recap.mode === "vs_season" ? `comparé à nos ${d.recap.n_other_matches} autres matchs` : "premier match : comparé à l'adversaire"}
            {" "}· meilleurs : {d.recap.best.map((x) => x.label_fr).join(", ") || "–"} · à travailler : {d.recap.worst.map((x) => x.label_fr).join(", ") || "–"}</p>
          <button type="button" onClick={present} className="rounded bg-ink px-3 py-1.5 text-sm font-semibold text-paper hover:bg-ink-2">Mode présentation</button>
        </div>
      )}
      <Tile className="lg:col-span-8" title="Quand étions-nous dangereux, et avions-nous le ballon ?" note="Menace (lissée) et part de possession sur 5 min glissantes, buts et mi-temps.">
        <MatchStory timeline={d.timeline} />
      </Tile>
      <Tile className="lg:col-span-4" title="Où en est-on par rapport à la référence ?" note={`Règle fixée d'avance : moyenne des 5 derniers matchs vs la référence (${d.seasonV1?.matches?.length ?? 0} matchs v1).`}>
        <ul className="space-y-2">
          {PRIORITIES.map(([k, label, mid]) => (
            <li key={k} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="text-ink-2">{label} <span className="text-[11px] text-ink-3">· {M[mid]?.label_fr}</span></span>
              <span className="flex items-center gap-2"><span className="font-semibold tabular">{fmtValue(M[mid])}</span><StatusChip status={S[mid]?.status} /></span>
            </li>
          ))}
        </ul>
      </Tile>
      <Tile className="lg:col-span-12" title="Qui avait le ballon ?" note="Chaque possession, telle que tapée en direct ; survoler pour le détail.">
        <PossessionTimeline possessions={d.possessions} />
      </Tile>
      <Tile className="lg:col-span-6" title="Les moments clés" note="Cliquer pour voir les clips de chaque chiffre.">
        <MetricRows ids={key} metrics={M} season={S} openClips={openClips} />
      </Tile>
      <Tile className="lg:col-span-6" title="Peut-on se fier aux chiffres ?" note="Contrôles d'intégrité et couverture de la revue.">
        <ul className="space-y-1 text-[13px]">
          {v1.gates.map((g) => (
            <li key={g.id} className="flex justify-between gap-2"><span className="text-ink-2">{g.id} · {g.detail}</span>
              <span className={`font-semibold ${g.ok ? "text-ink" : "text-[#7c2a1d]"}`}>{g.ok ? "✓ ok" : g.scope === "clips" ? "✗ liens Veo" : "✗ bloquant"}</span></li>
          ))}
        </ul>
      </Tile>
    </div>
  );
}

// ---------- Saison ----------
function Spark({ series }) {
  const vals = series.map((s) => s.value).filter((v) => v != null);
  if (vals.length < 2) return <span className="text-[11px] text-ink-3">{vals.length ? "1 match" : "–"}</span>;
  const min = Math.min(...vals), max = Math.max(...vals), w = 80, h = 20;
  const pts = series.map((s, i) => s.value == null ? null : [i / (series.length - 1) * w, h - 2 - ((s.value - min) / (max - min || 1)) * (h - 4)]).filter(Boolean);
  return <svg width={w} height={h} aria-hidden="true"><polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--us)" strokeWidth="2" /></svg>;
}

export function Saison({ d, v1, openClips }) {
  const M = v1.metrics, S = d.seasonV1?.metrics || {};
  const groups = Object.keys(GROUP_FR);
  return (
    <div className="grid gap-3">
      <Tile title="Sommes-nous meilleurs que la référence ?" note={`Chaque statistique du codebook : ce match, la série des matchs v1, le statut. Référence : ${Object.values(S)[0]?.baseline_source ?? "à venir"}.`}>
        {groups.map((g) => {
          const ids = Object.keys(M).filter((k) => M[k].group === g && typeof M[k].value !== "object");
          if (!ids.length) return null;
          return (
            <div key={g} className="mb-4">
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{GROUP_FR[g]}</h4>
              <table className="w-full text-[13px]"><tbody>
                {ids.map((id) => (
                  <tr key={id} className="border-b border-rule last:border-0">
                    <td className="py-1 pr-2"><button type="button" className="text-left text-ink-2 hover:text-ink hover:underline" onClick={() => openClips(M[id])}>{M[id].label_fr}{id.endsWith("_against") ? " (adversaire)" : ""}</button></td>
                    <td className="py-1 pr-2 text-right font-semibold tabular">{fmtValue(M[id])}</td>
                    <td className="py-1 pr-2 text-right text-[11px] text-ink-3">{subline(M[id])}</td>
                    <td className="py-1 pr-2 text-right">{S[id] ? <Spark series={S[id].series} /> : null}</td>
                    <td className="py-1 text-right">{S[id] ? <StatusChip status={S[id].status} /> : null}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          );
        })}
      </Tile>
    </div>
  );
}

// ---------- Attaque ----------
export function Attaque({ d, v1, openClips }) {
  const M = v1.metrics;
  const byPhase = Object.fromEntries(PHASES.map((p) => [p, M[`xg_rate_${p}`]?.value]));
  const funnel = { red: M.redzone_entries?.n, box: M.box_entries?.n, shot: M.shots_for?.n, goal: M.goals_for?.n };
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <MetricTile className="lg:col-span-6" title="Quelle phase crée le danger ?" metric={M.xg_for} openClips={openClips}
        note="xG par 10 min passées dans chaque phase (table publique StatsBomb, grossière).">
        <Bars data={byPhase} order={PHASES} labels={PHASE_FR} format={xg2} />
      </MetricTile>
      <MetricTile className="lg:col-span-6" title="Où nos attaques s'arrêtent-elles ?" metric={M.box_entries} openClips={openClips}
        note="Entrées en zone rouge → dans la surface → tirs → buts (nombres).">
        <Bars data={funnel} order={["red", "box", "shot", "goal"]} labels={{ red: "Zone rouge", box: "Surface", shot: "Tirs", goal: "Buts" }} />
      </MetricTile>
      <MetricTile className="lg:col-span-6" title="Par où progresse-t-on dangereusement ?" metric={M.xt_gained} openClips={openClips}>
        <Bars data={M.xt_by_lane?.value} order={["L", "HS_L", "C", "HS_R", "R", "?"]} labels={LANE_FR} format={(v) => v.toFixed(3)} />
        <p className="mt-2 text-[11px] text-ink-3">Gains xT (grille publique, grossière) ; « couloir inconnu » tant que les entrées ne sont pas revues.</p>
      </MetricTile>
      <MetricTile className="lg:col-span-6" title="… et dans quelle phase ?" metric={M.xt_by_phase} openClips={openClips}>
        <Bars data={M.xt_by_phase?.value} order={[...PHASES, "?"]} labels={PHASE_FR} format={(v) => v.toFixed(3)} />
      </MetricTile>
      <Tile className="lg:col-span-12" title="Les chiffres de l'attaque" note="Cliquer un libellé pour ses clips.">
        <MetricRows ids={["goals_for", "shots_for", "chances_for", "xg_for", "conversion", "transition_to_box", "transition_speed", "buildup_progression", "xt_gained"]}
          metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
      </Tile>
    </div>
  );
}

// ---------- Couloirs & zone rouge ----------
export function Couloirs({ d, v1, openClips }) {
  const M = v1.metrics, det = M.hs_entry_share?.detail || {};
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <MetricTile className="lg:col-span-7" title="Par où entrons-nous dans la zone rouge ?" metric={M.hs_entry_share} openClips={openClips}
        note={`${det.answered ?? 0} entrées revues sur ${det.entries ?? 0}.`}>
        <LaneGrid grid={det.grid} />
      </MetricTile>
      <MetricTile className="lg:col-span-5" title="Comment entrons-nous ?" metric={M.hs_entry_share} openClips={openClips} note="Méthode d'entrée (cartes « Entrée »).">
        <Bars data={det.methods} labels={METHOD_FR} order={["PASS", "CARRY", "CROSS", "SET_PIECE", "LOOSE"]} empty="Pas encore de réponses." />
      </MetricTile>
      <Tile className="lg:col-span-6" title="Le couloir intérieur" note="Le cœur du jeu du staff : trouver des joueurs entre les lignes.">
        <MetricRows ids={["hs_entry_share", "between_lines_rate", "hs_to_box", "hs_assist_share", "hs_attempt_success", "xg_after_hs", "xg_after_other"]} metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
      </Tile>
      <Tile className="lg:col-span-6" title="Zone rouge et attaque des 18 m" note="Par 10 min de possession quand c'est un rythme.">
        <MetricRows ids={["redzone_entries", "box_entries", "red_to_box", "box_attack_eff", "box_attempt_success", "possessions_reaching_redzone", "field_tilt_time", "field_tilt_classic"]} metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
      </Tile>
    </div>
  );
}

// ---------- Possession & construction ----------
export function Possession({ d, v1, openClips }) {
  const M = v1.metrics, ph = d.phases, causes = M.counterpress_5s?.detail?.causes;
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <Tile className="lg:col-span-12" title="Qui avait le ballon ?" note="Possessions tapées en direct (notre ballon / leur ballon / ballon mort).">
        <PossessionTimeline possessions={d.possessions} />
      </Tile>
      <Tile className="lg:col-span-7" title="Comment nos possessions commencent-elles et finissent-elles ?"><FlowSankey flow={ph.flow} /></Tile>
      <MetricTile className="lg:col-span-5" title="Pourquoi perd-on le ballon ?" metric={M.counterpress_5s} openClips={openClips}
        note={`Cause des pertes dans leur moitié (${M.counterpress_5s?.detail?.answered ?? 0} cartes revues).`}>
        <Bars data={causes} labels={CAUSE_FR} order={["INTERCEPTED", "TACKLED", "BAD_TOUCH", "OUT", "FOUL"]} empty="Les causes viennent des cartes « Perte » de la revue." />
      </MetricTile>
      <Tile className="lg:col-span-6" title="Qui garde le ballon le plus longtemps ?"><DurationDensity us={ph.durations.us} them={ph.durations.them} /></Tile>
      <Tile className="lg:col-span-6" title="Construction et territoire">
        <MetricRows ids={["buildup_progression", "field_tilt_time", "field_tilt_classic", "opp_possession_length", "possessions_reaching_redzone"]} metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
      </Tile>
    </div>
  );
}

// ---------- Intensité ----------
export function Intensite({ d, v1, openClips }) {
  const M = v1.metrics, det = M.counterpress_5s?.detail || {};
  const bands = Object.fromEntries(Object.entries(det.losses_by_band || {}).map(([b, n]) => [`Zone ${b}`, n]));
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <Tile className="lg:col-span-7" title="Récupère-t-on le ballon vite ?" note="Part des pertes pas encore récupérées, de 0 à 60 s.">
        <RegainCurve curve={d.phases.regain_curve} />
      </Tile>
      <MetricTile className="lg:col-span-5" title="Où perd-on le ballon dans leur moitié ?" metric={M.counterpress_5s} openClips={openClips}>
        <Bars data={bands} order={["Zone 3", "Zone 4", "Zone 5"]} />
      </MetricTile>
      <MetricTile className="lg:col-span-6" title="Que tentait-on quand on l'a perdu ?" metric={M.hs_attempt_success} openClips={openClips}>
        <Bars data={det.intents} labels={INTENT_FR} order={Object.keys(INTENT_FR)} empty="Les intentions viennent des cartes « Perte »." />
      </MetricTile>
      <Tile className="lg:col-span-6" title="Grinta et intensité">
        <MetricRows ids={["counterpress_5s", "high_regains", "closing_3s_mean", "closing_2plus_share", "duel_win", "opp_possession_length", "resilience_late", "resilience_after_conceding"]} metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
      </Tile>
    </div>
  );
}

// ---------- CPA ----------
export function Cpa({ d, v1, openClips }) {
  const M = v1.metrics;
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <Tile className="lg:col-span-6" title="Qui a eu les coups de pied arrêtés ?" note="Nos CPA à gauche, les leurs à droite.">
        <SetPieceButterfly counts={d.report.set_pieces.counts} />
      </Tile>
      <Tile className="lg:col-span-6" title="Nos CPA rapportent-ils ?" note="Tir dans les 20 s, xG par CPA, premier contact (cartes « CPA »).">
        <MetricRows ids={["setpiece_shot_rate", "setpiece_xg", "first_contact_won", "xg_rate_SET_PIECE", "setpiece_shot_rate_against", "setpiece_xg_against", "first_contact_won_against"]} metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
      </Tile>
    </div>
  );
}

// ---------- Défense ----------
export function Defense({ d, v1, openClips }) {
  const M = v1.metrics;
  const byPhase = Object.fromEntries(PHASES.map((p) => [p, M[`xg_rate_${p}_against`]?.value]));
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <MetricTile className="lg:col-span-6" title="D'où vient le danger adverse ?" metric={M.xg_against} openClips={openClips} note="xG adverse par 10 min de chaque phase de leur possession.">
        <Bars data={byPhase} order={PHASES} labels={PHASE_FR} format={xg2} color="var(--them)" />
      </MetricTile>
      <Tile className="lg:col-span-6" title="Ce qu'on concède">
        <MetricRows ids={["goals_against", "shots_against", "chances_against", "xg_against", "transition_to_box_against", "buildup_progression_against"]} metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
      </Tile>
    </div>
  );
}

// ---------- Données ----------
export function Donnees({ v1 }) {
  const M = v1.metrics, judged = Object.values(M).filter((m) => m.coverage != null);
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <Tile className="lg:col-span-6" title="Contrôles d'intégrité" note="Un contrôle bloquant en échec cache le rapport ; G3 ne bloque que les liens Veo.">
        <ul className="space-y-1 text-[13px]">{v1.gates.map((g) => <li key={g.id} className="flex justify-between gap-2"><span>{g.id} · {g.detail}</span><span className="font-semibold">{g.ok ? "✓" : "✗"}</span></li>)}</ul>
      </Tile>
      <Tile className="lg:col-span-6" title="Temps de jeu tapé" note="Minutes par état, tel que tapé en direct.">
        <Bars data={{ "Notre ballon": v1.minutes.US, "Leur ballon": v1.minutes.THEM, "Ballon mort": v1.minutes.DEAD, "Fil perdu": v1.minutes.UNKNOWN }} format={(v) => `${v.toFixed(1)} min`} />
      </Tile>
      <Tile className="lg:col-span-6" title="Couverture de la revue" note="Part des cartes répondues, par statistique jugée.">
        <ul className="space-y-1 text-[13px]">{judged.map((m) => <li key={m.id} className="flex justify-between gap-2"><span className="text-ink-2">{m.label_fr}</span><span className="tabular">{pct(m.coverage)}</span></li>)}</ul>
      </Tile>
      <Tile className="lg:col-span-6" title="Décalage du tagging" note="Mesuré quand un moment est déplacé dans la revue (V).">
        <p className="text-[13px] text-ink-2">{v1.calibration.n ? `Décalage médian ${(v1.calibration.median_lag_ms / 1000).toFixed(1)} s sur ${v1.calibration.n} moments déplacés · avance des clips ${v1.calibration.lead_ms / 1000} s${v1.calibration.propose_longer_lead ? " · proposer une avance plus longue" : ""}.` : "Aucun moment déplacé pour l'instant."}</p>
      </Tile>
    </div>
  );
}

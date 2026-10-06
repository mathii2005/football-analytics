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
import TeamRadar from "../../charts/TeamRadar.jsx";
import Bullets from "../../charts/Bullets.jsx";
import HalvesDumbbell from "../../charts/HalvesDumbbell.jsx";
import BandPitch from "../../charts/BandPitch.jsx";
import StateDots from "../../charts/StateDots.jsx";
import { goldRamp, blueRamp, diverging, inkOnDiverging } from "../../charts/palette.js";
import KeyPoints from "../../components/KeyPoints.jsx";
import CounterPress from "../../components/CounterPress.jsx";
import PossessionTable from "../../components/PossessionTable.jsx";
import ShotsTable from "../ShotsTable.jsx";
import { profileFor } from "../../links.js";
import { SHOW_VEO } from "../../veo.js";
import { fmtValue, subline, GROUP_FR, LANE_FR, PHASE_FR, CAUSE_FR, INTENT_FR, METHOD_FR, ASSIST_FR, LOC_FR, RESTART_FR } from "../format.js";
import { pct, dec, secs, signed, clock, plural, START_GROUP_LABELS } from "../../format.js";

// The v1 pages (PIPELINE §7.2). Every tile is bound to catalogue metrics from
// /matches/{id}/metrics; clicks open the clips behind the number.
const PHASES = ["TRANSITION", "BUILD_UP", "SETTLED", "SET_PIECE"];

// "click a bar -> its clips": the metric's moments filtered on one field
function only(metric, field, value, label) {
  const all = (metric?.clips?.all || []).filter((c) => (c[field] ?? "?") === value);
  return { ...metric, label_fr: `${metric.label_fr} · ${label}`, clips: { typical: all.slice(0, 3), extreme: [], all, mode: "spread" } };
}
const xg2 = (v) => v.toFixed(2);
const LANES = ["L", "HS_L", "C", "HS_R", "R"];
const ASSISTS = Object.keys(ASSIST_FR);
const LOCS = Object.keys(LOC_FR);
const noDetails = null;
const has = (o) => o && Object.values(o).some((v) => v);

function KV({ rows }) {
  return (
    <dl className="divide-y divide-rule text-[12px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 py-1.5"><dt className="text-ink-2">{k}</dt><dd className="font-semibold text-ink tabular">{v}</dd></div>
      ))}
    </dl>
  );
}

// the old engine's zone pitches (4 zones + box), shared by Intensité
function zonePitches(r) {
  const zones = r.zones;
  const maxR = Math.max(1, ...zones.map((z) => z.recups)), maxL = Math.max(1, ...zones.map((z) => z.losses));
  const maxB = Math.max(1, ...zones.map((z) => Math.abs(z.balance)));
  return {
    rec: zones.map((z) => ({ zone: z.zone, t: z.recups / maxR, big: z.recups, small: "récupérations" })),
    los: zones.map((z) => ({ zone: z.zone, t: z.losses / maxL, big: z.losses, small: "pertes" })),
    bal: zones.map((z) => ({ zone: z.zone, t: z.balance / maxB, big: signed(z.balance), small: z.recups + z.losses ? `contrôle ${pct(z.control)}` : "" })),
  };
}

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
        <div className="flex justify-end lg:col-span-12">
          <button type="button" onClick={present} className="rounded bg-ink px-4 py-1.5 text-sm font-semibold text-paper hover:bg-ink-2">Récap</button>
        </div>
      )}
      <Tile className="lg:col-span-8" title="Quand étions-nous dangereux, et avions-nous le ballon ?" note="Menace (lissée) et part de possession sur 5 min glissantes, buts et mi-temps.">
        <MatchStory timeline={d.timeline} />
      </Tile>
      <Tile className="lg:col-span-4" title="Où en est-on sur nos priorités ?">
        <ul className="space-y-2">
          {PRIORITIES.filter(([, , mid]) => M[mid]?.value != null).map(([k, label, mid]) => (
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
      <Tile className="lg:col-span-12" title="Ce que disent les données" note="Généré automatiquement à partir des tags.">
        <KeyPoints points={d.report.key_points} />
      </Tile>
      <Tile className="lg:col-span-6" title="Les moments clés" note="Cliquer pour voir les clips de chaque chiffre.">
        <MetricRows ids={key} metrics={M} season={S} openClips={openClips} />
      </Tile>
      <Tile className="lg:col-span-6" title="Peut-on se fier aux chiffres ?" note="Contrôles d'intégrité et couverture de la revue.">
        <ul className="space-y-1 text-[13px]">
          {v1.gates.filter((g) => SHOW_VEO || g.id !== "G3").map((g) => (
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
  const me = profileFor(d.season, d.report.match.id), n = d.season?.matches.length ?? 0;
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      {me && <Tile className="lg:col-span-6" title="Quel type de match était-ce ?" note={`Profil comparé à nos ${n} matchs de la saison.`}>
        <TeamRadar profile={me} summary={d.season.summary} n={n} />
      </Tile>}
      {me && <Tile className="lg:col-span-6" title="Les chiffres clés, dans leur contexte" note="Ce match face à la moyenne et à l'écart de nos matchs de la saison.">
        <Bullets profile={me} summary={d.season.summary} />
      </Tile>}
      <div className="lg:col-span-12">
      <Tile title="Sommes-nous meilleurs que la référence ?" note="Chaque statistique du codebook pour ce match.">
        {groups.map((g) => {
          const ids = Object.keys(M).filter((k) => M[k].group === g && M[k].value != null && typeof M[k].value !== "object");
          if (!ids.length) return null;
          return (
            <div key={g} className="mb-4">
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{GROUP_FR[g]}</h4>
              <table className="w-full table-fixed text-[13px]"><colgroup><col className="w-[38%]" /><col className="w-[12%]" /><col className="w-[26%]" /><col className="w-[12%]" /><col className="w-[12%]" /></colgroup><tbody>
                {ids.map((id) => (
                  <tr key={id} className="border-b border-rule last:border-0">
                    <td className="py-1 pr-2"><button type="button" className="text-left text-ink-2 hover:text-ink hover:underline" onClick={() => openClips(M[id])}>{M[id].label_fr}{id.endsWith("_against") && !M[id].label_fr.includes("(adversaire)") ? " (adversaire)" : ""}</button></td>
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
    </div>
  );
}

// ---------- Attaque ----------
export function Attaque({ d, v1, openClips }) {
  const M = v1.metrics, det = d.details?.available ? d.details : null;
  const byPhase = Object.fromEntries(PHASES.map((p) => [p, M[`xg_rate_${p}`]?.value]));
  const funnel = { red: M.redzone_entries?.n, box: M.box_entries?.n, shot: M.shots_for?.n, goal: M.goals_for?.n };
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <MetricTile className="lg:col-span-6" title="Quelle phase crée le danger ?" metric={M.xg_for} openClips={openClips}
        note="xG par 10 min passées dans chaque phase (table publique StatsBomb, grossière).">
        <Bars data={byPhase} order={PHASES} labels={PHASE_FR} format={xg2} onSelect={(k) => openClips(only(M.xg_for, "phase", k, PHASE_FR[k]))} />
      </MetricTile>
      <MetricTile className="lg:col-span-6" title="Où nos attaques s'arrêtent-elles ?" metric={M.box_entries} openClips={openClips}
        note="Entrées en zone rouge → dans la surface → tirs → buts (nombres).">
        <Bars data={funnel} order={["red", "box", "shot", "goal"]} labels={{ red: "Zone rouge", box: "Surface", shot: "Tirs", goal: "Buts" }} />
      </MetricTile>
      <MetricTile className="lg:col-span-6" title="Par où progresse-t-on dangereusement ?" metric={M.xt_gained} openClips={openClips}>
        <Bars data={M.xt_by_lane?.value} order={["L", "HS_L", "C", "HS_R", "R"]} labels={LANE_FR} format={(v) => v.toFixed(3)} onSelect={(k) => openClips(only(M.xt_gained, "lane", k, LANE_FR[k]))} />
      </MetricTile>
      <MetricTile className="lg:col-span-6" title="… et dans quelle phase ?" metric={M.xt_by_phase} openClips={openClips}>
        <Bars data={M.xt_by_phase?.value} order={PHASES} labels={PHASE_FR} format={(v) => v.toFixed(3)} onSelect={(k) => openClips(only(M.xt_gained, "phase", k === "?" ? null : k, PHASE_FR[k]))} />
      </MetricTile>
      <Tile className="lg:col-span-6" title="Comment nos tirs sont-ils créés ?" note="Dernière action avant le tir (cartes « Tir »). Or : nous ; bleu : l'adversaire.">
        {det ? <Bars data={det.shot_origin.US} compare={det.shot_origin.THEM} labels={ASSIST_FR} order={ASSISTS} /> : noDetails}
      </Tile>
      <Tile className="lg:col-span-6" title="D'où tire-t-on ?" note="Lieu du tir (cartes « Tir »). Or : nous ; bleu : l'adversaire.">
        {det ? <Bars data={det.shot_loc.US} compare={det.shot_loc.THEM} labels={LOC_FR} order={LOCS} /> : noDetails}
      </Tile>
      <Tile className="lg:col-span-12" title="Tous les tirs" note={`${det?.shots.length ?? 0} tirs ; xG de la table publique selon lieu, corps et situation.`}>
        {det ? <ShotsTable shots={det.shots} /> : noDetails}
      </Tile>
      <Tile className="lg:col-span-6" title="Qu'est-ce qui a changé à la mi-temps ?" note="Chaque ligne sur sa propre échelle ; point creux = MT1, plein = MT2.">
        <HalvesDumbbell halves={d.report.halves} tempo={d.report.tempo} hide={["dangerous_actions", "aps"]} />
      </Tile>
      <Tile className="lg:col-span-6" title="Les chiffres de l'attaque" note="Cliquer un libellé pour ses clips.">
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
        <Bars data={det.methods} labels={METHOD_FR} order={["PASS", "CARRY", "CROSS", "SET_PIECE", "LOOSE"]} />
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
const MIN_N = 5;
export function Possession({ d, v1, openClips }) {
  const M = v1.metrics, ph = d.phases, causes = M.counterpress_5s?.detail?.causes;
  const rv = ph.progression.recovery_value;
  const maxBox = Math.max(0.01, ...rv.filter((z) => z.n >= MIN_N).map((z) => z.box_rate ?? 0));
  const rvRows = rv.map((z) => ({ zone: z.zone, t: z.n ? Math.min(1, (z.box_rate ?? 0) / maxBox) : 0, hatched: z.n > 0 && z.n < MIN_N,
    big: z.n ? pct(z.box_rate) + (z.n < MIN_N ? "*" : "") : "0", small: z.n ? `${z.n} récup · ${pct(z.shot_rate)} finissent par un tir` : "récupération" }));
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <Tile className="lg:col-span-12" title="Qui avait le ballon ?" note="Possessions tapées en direct (notre ballon / leur ballon / ballon mort).">
        <PossessionTimeline possessions={d.possessions} />
      </Tile>
      <Tile className="lg:col-span-7" title="Comment nos possessions commencent-elles et finissent-elles ?"><FlowSankey flow={ph.flow} /></Tile>
      <MetricTile className="lg:col-span-5" title="Pourquoi perd-on le ballon ?" metric={M.counterpress_5s} openClips={openClips}
        note={`Cause des pertes dans leur moitié (${M.counterpress_5s?.detail?.answered ?? 0} cartes revues).`}>
        <Bars data={causes} labels={CAUSE_FR} order={["INTERCEPTED", "TACKLED", "BAD_TOUCH", "OUT", "FOUL"]} />
      </MetricTile>
      <Tile className="lg:col-span-6" title="Qui garde le ballon le plus longtemps ?"><DurationDensity us={ph.durations.us} them={ph.durations.them} /></Tile>
      <Tile className="lg:col-span-6" title="Construction et territoire">
        <MetricRows ids={["buildup_progression", "field_tilt_time", "field_tilt_classic", "opp_possession_length", "possessions_reaching_redzone"]} metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
      </Tile>
      <Tile className="lg:col-span-4" title="Le score change-t-il notre possession ?" note="Possession selon le score au début de la possession.">
        <StateDots states={ph.splits.by_state} />
        <div className="mt-5 text-[11px] font-medium text-ink-2">Par mi-temps</div>
        <KV rows={ph.splits.by_half.map((h) => [`MT${h.half}`, pct(h.strict)])} />
      </Tile>
      <Tile className="lg:col-span-4" title="Quelles récupérations deviennent dangereuses ?" note={`% de récupérations dont la possession atteint la surface ; hachuré (*) : moins de ${MIN_N} récupérations.`}>
        <BandPitch rows={rvRows} color={goldRamp} label="Valeur des récupérations par zone" />
      </Tile>
      <Tile className="lg:col-span-4" title="Efficacité selon le départ et temps de jeu">
        <KV rows={[...ph.finishing.shot_sequences_by_start.filter((x) => x.n).map((x) => [START_GROUP_LABELS[x.start], `${plural(x.shot_seq, "possession")} avec tir sur ${x.n}`]),
          ["Ballon en jeu (tapé)", `${dec(v1.minutes.US + v1.minutes.THEM)} min`], ["Ballon mort (tapé)", `${dec(v1.minutes.DEAD)} min`]]} />
      </Tile>
      <div className="lg:col-span-12"><PossessionTable possessions={d.possessions} /></div>
    </div>
  );
}

// ---------- Intensité ----------
export function Intensite({ d, v1, openClips }) {
  const M = v1.metrics, det = M.counterpress_5s?.detail || {};
  const D = d.details?.available ? d.details : null, zp = zonePitches(d.report);
  const bands = Object.fromEntries(Object.entries(det.losses_by_band || {}).map(([b, n]) => [`Zone ${b}`, n]));
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <Tile className="lg:col-span-7" title="Récupère-t-on le ballon vite ?" note="Part des pertes toujours chez l'adversaire, de 0 à 60 s après la perte.">
        <RegainCurve curve={d.phases.regain_curve} />
      </Tile>
      <MetricTile className="lg:col-span-5" title="Où perd-on le ballon dans leur moitié ?" metric={M.counterpress_5s} openClips={openClips}>
        <Bars data={bands} order={["Zone 3", "Zone 4", "Zone 5"]} />
      </MetricTile>
      <MetricTile className="lg:col-span-6" title="Que tentait-on quand on l'a perdu ?" metric={M.hs_attempt_success} openClips={openClips}>
        <Bars data={det.intents} labels={INTENT_FR} order={Object.keys(INTENT_FR)} />
      </MetricTile>
      <Tile className="lg:col-span-6" title="Combien de joueurs ferment après une perte ?" note="Joueurs à moins de 3 s du porteur après nos pertes dans leur moitié (cartes « Perte »).">
        {D ? <Bars data={D.closing} order={["0", "1", "2", "3PLUS"]} labels={{ 0: "Personne", 1: "1 joueur", 2: "2 joueurs", "3PLUS": "3 et +" }} /> : noDetails}
      </Tile>
      <Tile className="lg:col-span-4" title="Où récupère-t-on le ballon ?" note={`Hauteur de récupération ${d.report.headline.recovery_height?.toFixed(1).replace(".", ",") ?? "–"} / 5.`}>
        <BandPitch rows={zp.rec} color={goldRamp} label="Récupérations par zone" />
      </Tile>
      <Tile className="lg:col-span-4" title="Où perd-on le ballon ?">
        <BandPitch rows={zp.los} color={blueRamp} label="Pertes par zone" />
      </Tile>
      <Tile className="lg:col-span-4" title="Qui domine chaque zone ?" note="Récupérations − pertes. Or : on gagne la zone ; bleu : on la perd.">
        <BandPitch rows={zp.bal} color={diverging} ink={inkOnDiverging} label="Bilan territorial" />
      </Tile>
      <Tile className="lg:col-span-6" title="Où le contre-pressing marche-t-il ?" note="Par zone de perte : temps médian pour reprendre le ballon, part reprise en 5 et 10 s.">
        <CounterPress cp={d.phases.counter_press} onZone={() => {}} />
      </Tile>
      <Tile className="lg:col-span-6" title="Phases défensives">
        <KV rows={[["Possession adverse médiane", secs(d.phases.defence.median_opp_ms)], ["Terminées par une récup haute", pct(d.phases.defence.ended_by_high_recup_share)],
          ["Intensité du pressing (PPDA-lite)", dec(d.phases.defence.ppda_lite)]]} />
      </Tile>
      <Tile className="lg:col-span-12" title="Grinta et intensité">
        <MetricRows ids={["counterpress_5s", "high_regains", "closing_3s_mean", "closing_2plus_share", "duel_win", "opp_possession_length", "resilience_late", "resilience_after_conceding"]} metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
      </Tile>
    </div>
  );
}

// ---------- CPA ----------
export function Cpa({ d, v1, openClips }) {
  const M = v1.metrics, det = d.details?.available ? d.details : null;
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <Tile className="lg:col-span-6" title="Qui a eu les coups de pied arrêtés ?" note="Nos CPA à gauche, les leurs à droite.">
        <SetPieceButterfly counts={d.report.set_pieces.counts} />
      </Tile>
      <Tile className="lg:col-span-6" title="Nos CPA rapportent-ils ?" note="Tir dans les 20 s, xG par CPA, premier contact (cartes « CPA »).">
        <MetricRows ids={["setpiece_shot_rate", "setpiece_xg", "first_contact_won", "xg_rate_SET_PIECE", "setpiece_shot_rate_against", "setpiece_xg_against", "first_contact_won_against"]} metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
      </Tile>
      {[["US", "Nos coups de pied arrêtés, par zone"], ["THEM", "Leurs coups de pied arrêtés, par zone"]].map(([t, title]) => (
        <Tile key={t} className="lg:col-span-6" title={title} note="Nombre et tirs dans les 20 s (ballon gardé). « CPA → tir » compte les corners, penalties, coups francs dans leur moitié et touches en zone 4–5.">
          {det ? (
            <table className="w-full text-[12px]"><thead><tr className="border-b border-rule text-left text-ink-3"><th className="py-1 font-medium">Type</th><th className="py-1 font-medium">Zone</th><th className="py-1 text-right font-medium">Nombre</th><th className="py-1 text-right font-medium">→ tir</th></tr></thead>
              <tbody>{det.set_pieces[t].filter((r) => r.type !== "KICKOFF").map((r) => (
                <tr key={`${r.type}-${r.zone}`} className="border-b border-rule last:border-0"><td className="py-1">{RESTART_FR[r.type] ?? r.type}</td><td className="py-1 text-ink-2">{r.zone}</td>
                  <td className="py-1 text-right tabular">{r.n}</td><td className="py-1 text-right font-semibold tabular">{r.shots}</td></tr>
              ))}</tbody></table>
          ) : noDetails}
        </Tile>
      ))}
    </div>
  );
}

// ---------- Défense ----------
export function Defense({ d, v1, openClips }) {
  const M = v1.metrics, det = d.details?.available ? d.details : null;
  const byPhase = Object.fromEntries(PHASES.map((p) => [p, M[`xg_rate_${p}_against`]?.value]));
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <MetricTile className="lg:col-span-6" title="D'où vient le danger adverse ?" metric={M.xg_against} openClips={openClips} note="xG adverse par 10 min de chaque phase de leur possession.">
        <Bars data={byPhase} order={PHASES} labels={PHASE_FR} format={xg2} color="var(--them)" onSelect={(k) => openClips(only(M.xg_against, "phase", k, PHASE_FR[k]))} />
      </MetricTile>
      <Tile className="lg:col-span-6" title="Ce qu'on concède">
        <MetricRows ids={["goals_against", "shots_against", "chances_against", "xg_against", "transition_to_box_against", "buildup_progression_against"]} metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
      </Tile>
      {det && has(det.opp_entries.lanes) && <Tile className="lg:col-span-6" title="Par où entrent-ils dans notre surface ?" note={`${det.opp_entries.answered} entrées dans notre surface.`}>
        <Bars data={det.opp_entries.lanes} order={LANES} labels={LANE_FR} color="var(--them)" />
        <div className="mt-4 text-[11px] font-medium text-ink-2">Comment</div>
        <Bars data={det.opp_entries.methods} order={["PASS", "CARRY", "CROSS", "SET_PIECE", "LOOSE"]} labels={METHOD_FR} color="var(--them)" />
      </Tile>}
      <Tile className="lg:col-span-6" title="Comment leurs tirs sont-ils créés ?" note="Dernière action avant leur tir, et lieu du tir (cartes « Tir »).">
        {det ? <><Bars data={det.shot_origin.THEM} labels={ASSIST_FR} order={ASSISTS} color="var(--them)" />
          <div className="mt-4 text-[11px] font-medium text-ink-2">Lieu</div>
          <Bars data={det.shot_loc.THEM} labels={LOC_FR} order={LOCS} color="var(--them)" /></> : noDetails}
      </Tile>
      {det && det.losses_to_shots.moments.length > 0 && <Tile className="lg:col-span-12" title="Nos pertes qui mènent à un tir adverse" note={`${det.losses_to_shots.n_shots} de nos ${det.losses_to_shots.n_losses} pertes suivies d'un tir adverse en 20 s, sans que l'on reprenne le ballon.`}>
        {(
          <table className="w-full text-[12px]"><thead><tr className="border-b border-rule text-left text-ink-3"><th className="py-1 font-medium">Perte</th><th className="py-1 font-medium">Zone</th><th className="py-1 font-medium">Tir adverse</th><th className="py-1 text-right font-medium">Délai</th></tr></thead>
            <tbody>{det.losses_to_shots.moments.map((m) => (
              <tr key={`${m.half}-${m.t}`} className={`border-b border-rule last:border-0 ${m.shot_v === "GOAL" ? "font-semibold" : ""}`}>
                <td className="py-1 tabular">MT{m.half} · {clock(m.t)}</td><td className="py-1">{m.band == null ? "–" : `Zone ${m.band}`}</td>
                <td className="py-1">{{ OFF: "Non cadré", ON: "Cadré", GOAL: "But" }[m.shot_v]}</td><td className="py-1 text-right tabular">{dec(m.delay_s)} s</td></tr>
            ))}</tbody></table>)}
      </Tile>}
    </div>
  );
}

// ---------- Données ----------
export function Donnees({ d, v1 }) {
  const M = v1.metrics, judged = Object.values(M).filter((m) => m.coverage);
  const load = d.details?.available ? d.details.load : [];
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <Tile className="lg:col-span-6" title="Contrôles d'intégrité" note="Un contrôle bloquant en échec cache le rapport ; G3 ne bloque que les liens Veo.">
        <ul className="space-y-1 text-[13px]">{v1.gates.filter((g) => SHOW_VEO || g.id !== "G3").map((g) => <li key={g.id} className="flex justify-between gap-2"><span>{g.id} · {g.detail}</span><span className="font-semibold">{g.ok ? "✓" : "✗"}</span></li>)}</ul>
      </Tile>
      <Tile className="lg:col-span-6" title="Temps de jeu tapé" note="Minutes par état, tel que tapé en direct.">
        <Bars data={{ "Notre ballon": v1.minutes.US, "Leur ballon": v1.minutes.THEM, "Ballon mort": v1.minutes.DEAD, "Fil perdu": v1.minutes.UNKNOWN }} format={(v) => `${v.toFixed(1)} min`} />
      </Tile>
      <Tile className="lg:col-span-6" title="Couverture de la revue" note="Part des cartes répondues, par statistique jugée.">
        <ul className="space-y-1 text-[13px]">{judged.map((m) => <li key={m.id} className="flex justify-between gap-2"><span className="text-ink-2">{m.label_fr}</span><span className="tabular">{pct(m.coverage)}</span></li>)}</ul>
      </Tile>
      <Tile className="lg:col-span-6" title="Charge de tagging" note="Pressions tapées par minute, par bloc de 15 min (corrections incluses). Cible 10, plafond 12.">
        <Bars data={Object.fromEntries(load.map((b) => [`MT${b.half} · ${b.block * 15}–${b.block * 15 + 15}'`, b.per_min]))} format={(v) => dec(v)} />
      </Tile>
      {v1.calibration.n > 0 && <Tile className="lg:col-span-6" title="Décalage du tagging" note="Mesuré quand un moment est déplacé dans la revue (V).">
        <p className="text-[13px] text-ink-2">{`Décalage médian ${(v1.calibration.median_lag_ms / 1000).toFixed(1)} s sur ${v1.calibration.n} moments déplacés · avance des clips ${v1.calibration.lead_ms / 1000} s${v1.calibration.propose_longer_lead ? " · proposer une avance plus longue" : ""}.`}</p>
      </Tile>}
    </div>
  );
}

import Tile from "../../charts/Tile.jsx";
import PossessionTimeline from "../../components/PossessionTimeline.jsx";
import MetricTile from "../MetricTile.jsx";
import MetricRows from "../MetricRows.jsx";
import Bars from "../Bars.jsx";
import StatusChip from "../StatusChip.jsx";
import ShotsTable from "../ShotsTable.jsx";
import XgFlow from "../XgFlow.jsx";
import Momentum from "../Momentum.jsx";
import { PitchGrid, ShotZoneMap, DeliveryMap } from "../Pitch.jsx";
import { PlayerCards, PlayerScatter, DuoList, PlayerTable } from "../Players.jsx";
import { StoryTile, EditableText } from "../story.jsx";
import { fmtValue, subline, catalogueCsv, GROUP_FR, LANE_FR, PHASE_FR, CAUSE_FR, INTENT_FR, METHOD_FR, ASSIST_FR, LOC_FR, RESTART_FR } from "../format.js";
import { pct, dec, clock } from "../../format.js";

// Dashboard v2 (PIPELINE §7): every staff tile is titled with a finding written
// from the data (EditableText / StoryTile, /matches/{id}/texts); the grey line is
// the question it answers. Pitch drawings on our zone grid carry the main visuals.
// Only the v1 engine (/metrics, /details, /recap, /texts) feeds these pages.
const PHASES = ["TRANSITION", "BUILD_UP", "SETTLED", "SET_PIECE"];
const LANES = ["L", "HS_L", "C", "HS_R", "R"];
const ASSISTS = Object.keys(ASSIST_FR).filter((k) => k !== "UNREVIEWED");
const METHODS = ["PASS", "CARRY", "CROSS", "SET_PIECE", "LOOSE"];
const OUTCOME_FR = { SHOT: "Tir", BOX_ENTRY: "Entrée dans la surface", FOUL_WON: "Faute obtenue", CORNER: "Corner", RECYCLED: "Ressortie", LOST: "Perdu" };
const xg2 = (v) => v.toFixed(2).replace(".", ",");
const has = (o) => !!o && Object.values(o).some((v) => v);
const known = (M, id) => M[id] && M[id].value != null;

// "click a bar -> its clips": the metric's moments filtered on one field
function only(metric, field, value, label) {
  const all = (metric?.clips?.all || []).filter((c) => (c[field] ?? "?") === value);
  return { ...metric, label_fr: `${metric.label_fr} · ${label}`, clips: { typical: all.slice(0, 3), extreme: [], all, mode: "spread" } };
}
function det(d) { return d.details?.available ? d.details : null; }
const firstNames = (D) => Object.fromEntries((D?.players || []).map((p) => [p.num, p.name ? p.name.split(" ")[0] : `#${p.num}`]));

function SetPieceTable({ rows }) {
  const shown = (rows || []).filter((r) => r.type !== "KICKOFF");
  if (!shown.length) return null;
  return (
    <table className="w-full text-[12px]">
      <thead><tr className="border-b border-rule text-left text-ink-3"><th className="py-1 font-medium">Type</th><th className="py-1 font-medium">Zone</th>
        <th className="py-1 text-right font-medium">Nombre</th><th className="py-1 text-right font-medium">→ tir en 20 s</th></tr></thead>
      <tbody>{shown.map((r) => (
        <tr key={`${r.type}-${r.zone}`} className="border-b border-rule last:border-0"><td className="py-1">{RESTART_FR[r.type] ?? r.type}</td><td className="py-1 text-ink-2">{r.zone}</td>
          <td className="py-1 text-right tabular">{r.n}</td><td className="py-1 text-right font-semibold tabular">{r.shots}</td></tr>
      ))}</tbody>
    </table>
  );
}

// a 100 % bar of outcomes, the biggest first
function Stacked({ data, labels, colors }) {
  const total = Object.values(data || {}).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const items = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <div className="flex h-5 overflow-hidden rounded-sm">
        {items.map(([k, v]) => <span key={k} title={`${labels[k] ?? k} : ${v}`} style={{ width: `${(v / total) * 100}%`, background: colors[k] ?? "var(--rule)" }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        {items.map(([k, v]) => <li key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: colors[k] ?? "var(--rule)" }} />{labels[k] ?? k} <span className="tabular text-ink-3">{v}</span></li>)}
      </ul>
    </div>
  );
}

// ---------- Récap: "Le match" ----------
function RecapCard({ it, side, k }) {
  const fmt = (v) => fmtValue({ value: v, unit: it.unit });
  const max = Math.max(Math.abs(it.value), Math.abs(it.compare.value), 1e-9);
  return (
    <div className="rounded-sm border border-rule bg-paper p-3">
      <EditableText k={k} fallback={it.label_fr} as="p" className="text-[13px] font-semibold leading-snug text-ink" />
      <div className="mt-2 space-y-1 text-[12px]">
        {[["Lauréats", it.value, "var(--us)"], ["Adversaire", it.compare.value, "var(--them)"]].map(([who, v, c]) => (
          <div key={who} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2">
            <span className="text-ink-3">{who}</span><span className="h-2 rounded-r-[3px]" style={{ width: `${(Math.abs(v) / max) * 100}%`, background: c, minWidth: v ? 2 : 0 }} />
            <span className="text-right tabular text-ink">{fmt(v)}</span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-ink-3">{side === "best" ? "Un point fort à garder." : "Un écart à combler."} n = {it.n}</p>
    </div>
  );
}

const PRIORITIES = [["Identité", "chance_share"], ["Construction", "buildup_progression"], ["Couloir intérieur", "hs_entry_share"],
  ["Zone rouge", "box_entries"], ["Intensité", "counterpress_5s"], ["CPA", "setpiece_shot_rate"], ["Défense", "xg_against"]];

export function Recap({ d, v1, present }) {
  const M = v1.metrics, S = d.seasonV1?.metrics || {}, D = det(d), r = d.recap;
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-sm border border-rule bg-paper px-4 py-3 lg:col-span-12">
        <EditableText k="recap.headline" as="h2" className="display max-w-4xl text-xl font-semibold leading-snug text-ink [text-wrap:balance] sm:text-2xl" />
        {r?.available && <button type="button" onClick={present} className="shrink-0 rounded bg-ink px-4 py-1.5 text-sm font-semibold text-paper hover:bg-ink-2">Récap</button>}
      </div>
      {D && <Tile className="lg:col-span-8" title="Le match en xG" note="xG cumulé de chaque équipe ; les gros points sont les buts.">
        <XgFlow shots={D.shots} names={firstNames(D)} />
      </Tile>}
      <Tile className="lg:col-span-4" title="Nos priorités">
        <ul className="space-y-2">
          {PRIORITIES.filter(([, id]) => known(M, id)).map(([label, id]) => (
            <li key={id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="text-ink-2">{label} <span className="text-[11px] text-ink-3">· {M[id].label_fr}</span></span>
              <span className="flex items-center gap-2"><span className="font-semibold tabular">{fmtValue(M[id])}</span><StatusChip status={S[id]?.status} /></span>
            </li>
          ))}
        </ul>
      </Tile>
      {D?.blocks?.length > 0 && <Tile className="lg:col-span-12" title="Le match par tranches de 15 minutes" note="Qui a été dangereux, et quand ; possession et nos entrées en zone rouge à droite.">
        <Momentum blocks={D.blocks} />
      </Tile>}
      {r?.best?.length > 0 && <div className="space-y-2 lg:col-span-4"><h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Ce qui a marché</h3>
        {r.best.map((it) => <RecapCard key={it.id} it={it} side="best" k={`recap.best.${it.id}`} />)}</div>}
      {r?.worst?.length > 0 && <div className="space-y-2 lg:col-span-4"><h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Ce qui nous a coûté</h3>
        {r.worst.map((it) => <RecapCard key={it.id} it={it} side="worst" k={`recap.worst.${it.id}`} />)}</div>}
      {d.texts?.texts?.["recap.focus"] && <div className="lg:col-span-4"><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">À travailler cette semaine</h3>
        <div className="rounded-sm border border-ink bg-paper p-3"><EditableText k="recap.focus" as="p" className="text-[14px] font-semibold text-ink" /></div></div>}
    </div>
  );
}

// ---------- Attaque: "Comment on crée" ----------
export function Attaque({ v1, d, openClips }) {
  const M = v1.metrics, D = det(d);
  const byPhase = Object.fromEntries(PHASES.map((p) => [p, M[`xg_rate_${p}`]?.value]));
  const funnel = { red: M.redzone_entries?.n, box: M.box_entries?.n, shot: M.shots_for?.n, goal: M.goals_for?.n };
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      {D && <StoryTile className="lg:col-span-5" k="attaque.zones" question="D'où tire-t-on ?" note="Nombre de tirs et xG par zone ; points dorés = buts.">
        <ShotZoneMap shots={D.shots} team="US" title="Nos tirs par zone" />
      </StoryTile>}
      {D && <StoryTile className="lg:col-span-7" k="attaque.creation" question="Comment nos tirs sont-ils créés ?" note="Or : nous ; bleu : l'adversaire.">
        <Bars data={D.shot_origin.US} compare={D.shot_origin.THEM} labels={ASSIST_FR} order={ASSISTS} />
      </StoryTile>}
      <StoryTile className="lg:col-span-6" k="attaque.funnel" question="Où nos attaques s'arrêtent-elles ?">
        <Bars data={funnel} order={["red", "box", "shot", "goal"]} labels={{ red: "Zone rouge", box: "Surface", shot: "Tirs", goal: "Buts" }} />
      </StoryTile>
      <StoryTile className="lg:col-span-6" k="attaque.phase" question="Quelle phase crée le danger ?" note="xG par 10 min passées dans chaque phase.">
        <Bars data={byPhase} order={PHASES} labels={PHASE_FR} format={xg2} onSelect={(k) => openClips(only(M.xg_for, "phase", k, PHASE_FR[k]))} />
      </StoryTile>
    </div>
  );
}

// ---------- Zone rouge & couloirs ----------
export function Couloirs({ v1, d, openClips }) {
  const M = v1.metrics, x = M.hs_entry_share?.detail || {}, D = det(d);
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <StoryTile className="lg:col-span-7" k="couloirs.grid" question="Par où entrons-nous dans la zone rouge ?" note="Entrées en zone 4 et dans la surface, par couloir.">
        <PitchGrid values={x.grid || {}} bands={[4, 5]} team="us" title="Nos entrées par couloir" />
      </StoryTile>
      <div className="space-y-3 lg:col-span-5">
        {D && has(D.entry_outcomes) && <StoryTile k="couloirs.outcomes" question="Que se passe-t-il après une entrée ?">
          <Stacked data={D.entry_outcomes} labels={OUTCOME_FR}
            colors={{ SHOT: "var(--us)", BOX_ENTRY: "#d9b46a", FOUL_WON: "#e6cf9c", CORNER: "#efe0bd", RECYCLED: "var(--rule)", LOST: "var(--them)" }} />
        </StoryTile>}
        <StoryTile k="couloirs.method" question="Comment entrons-nous ?">
          <Bars data={x.methods} labels={METHOD_FR} order={METHODS} />
        </StoryTile>
      </div>
      <Tile className="lg:col-span-12" title="Couloir intérieur et attaque des 18 m">
        <MetricRows ids={["hs_entry_share", "between_lines_rate", "hs_to_box", "hs_assist_share", "red_to_box", "box_attack_eff", "possessions_reaching_redzone"]}
          metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
      </Tile>
    </div>
  );
}

// ---------- Pressing & transitions: "La grinta" ----------
export function Intensite({ v1, d, openClips }) {
  const M = v1.metrics, x = M.counterpress_5s?.detail || {}, D = det(d);
  const lossBands = Object.fromEntries(Object.entries(x.losses_by_band || {}).map(([b, n]) => [`*:${b}`, n]));
  const ls = D?.losses_to_shots;
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      {D && has(D.closing) && <StoryTile className="lg:col-span-6" k="intensite.closing" question="Combien de joueurs ferment après une perte ?" note="Pertes dans leur moitié, joueurs à moins de 3 s du porteur.">
        <Bars data={D.closing} order={["0", "1", "2", "3PLUS"]} labels={{ 0: "Personne", 1: "1 joueur", 2: "2 joueurs", "3PLUS": "3 et +" }} />
      </StoryTile>}
      <StoryTile className="lg:col-span-6" k="intensite.losses" question="Où et pourquoi perd-on le ballon ?" note="Pertes dans leur moitié par zone ; causes revues dessous.">
        <PitchGrid values={lossBands} bands={[3, 4, 5]} team="them" title="Nos pertes par zone" />
        {has(x.causes) && <div className="mt-3"><Bars data={x.causes} labels={CAUSE_FR} order={["INTERCEPTED", "TACKLED", "BAD_TOUCH", "OUT", "FOUL"]} color="var(--them)" /></div>}
      </StoryTile>
      {has(x.intents) && <MetricTile className="lg:col-span-6" title="Que tentait-on quand on l'a perdu ?" metric={M.hs_attempt_success} openClips={openClips}>
        <Bars data={x.intents} labels={INTENT_FR} order={Object.keys(INTENT_FR)} color="var(--them)" />
      </MetricTile>}
      {ls?.moments?.length > 0 && <StoryTile className="lg:col-span-6" k="intensite.losses_to_shots" question="Nos pertes qui mènent à un tir adverse">
        <table className="w-full text-[12px]"><thead><tr className="border-b border-rule text-left text-ink-3"><th className="py-1 font-medium">Perte</th><th className="py-1 font-medium">Zone</th>
          <th className="py-1 font-medium">Tir adverse</th><th className="py-1 text-right font-medium">Délai</th></tr></thead>
          <tbody>{ls.moments.map((m) => (
            <tr key={`${m.half}-${m.t}`} className={`border-b border-rule last:border-0 ${m.shot_v === "GOAL" ? "font-semibold" : ""}`}>
              <td className="py-1 tabular">MT{m.half} · {clock(m.t)}</td><td className="py-1">{m.band == null ? "" : `Zone ${m.band}`}</td>
              <td className="py-1">{{ OFF: "Non cadré", ON: "Cadré", GOAL: "But" }[m.shot_v]}</td><td className="py-1 text-right tabular">{dec(m.delay_s)} s</td></tr>
          ))}</tbody></table>
      </StoryTile>}
      <Tile className="lg:col-span-12" title="Grinta et intensité">
        <MetricRows ids={["counterpress_5s", "high_regains", "closing_3s_mean", "closing_2plus_share", "duel_win", "opp_possession_length", "resilience_late", "resilience_after_conceding"]} metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
      </Tile>
    </div>
  );
}

// ---------- Défense: "Ce qu'on concède" ----------
export function Defense({ v1, d, openClips }) {
  const M = v1.metrics, D = det(d);
  const byPhase = Object.fromEntries(PHASES.map((p) => [p, M[`xg_rate_${p}_against`]?.value]));
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      {D && <StoryTile className="lg:col-span-5" k="defense.zones" question="D'où tirent-ils ?" note="Leurs tirs par zone, vus vers notre but ; points dorés = buts.">
        <ShotZoneMap shots={D.shots} team="THEM" title="Leurs tirs par zone" />
      </StoryTile>}
      {D && <StoryTile className="lg:col-span-7" k="defense.creation" question="Comment leurs tirs sont-ils créés ?">
        <Bars data={D.shot_origin.THEM} labels={ASSIST_FR} order={ASSISTS} color="var(--them)" />
      </StoryTile>}
      <StoryTile className="lg:col-span-6" k="defense.phase" question="Dans quelle phase nous mettent-ils en danger ?" note="xG adverse par 10 min de chaque phase de leur possession.">
        <Bars data={byPhase} order={PHASES} labels={PHASE_FR} format={xg2} color="var(--them)" onSelect={(k) => openClips(only(M.xg_against, "phase", k, PHASE_FR[k]))} />
      </StoryTile>
      {D && has(D.opp_entries.lanes) && <Tile className="lg:col-span-6" title="Par où entrent-ils dans notre surface ?" note={`${D.opp_entries.answered} entrées dans notre surface.`}>
        <Bars data={D.opp_entries.lanes} order={LANES} labels={LANE_FR} color="var(--them)" />
      </Tile>}
    </div>
  );
}

// ---------- CPA ----------
export function Cpa({ v1, d, openClips }) {
  const M = v1.metrics, D = det(d);
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      {D && <StoryTile className="lg:col-span-7" k="cpa.ours" question="Nos coups de pied arrêtés rapportent-ils ?" note="Corners, penalties, coups francs dans leur moitié et touches en zone 4–5 ; tir dans les 20 s.">
        <SetPieceTable rows={D.set_pieces.US} />
      </StoryTile>}
      {D && has(D.deliveries?.US) && <Tile className="lg:col-span-5" title="Où on envoie le ballon" note="Livraisons de nos CPA revus ; taille = nombre.">
        <DeliveryMap deliveries={D.deliveries.US} team="us" />
      </Tile>}
      {D && <Tile className="lg:col-span-6" title="Leurs coups de pied arrêtés"><SetPieceTable rows={D.set_pieces.THEM} /></Tile>}
      <Tile className="lg:col-span-6" title="Les chiffres des CPA">
        <MetricRows ids={["setpiece_shot_rate", "setpiece_xg", "first_contact_won", "xg_rate_SET_PIECE", "setpiece_shot_rate_against", "setpiece_xg_against", "first_contact_won_against"]}
          metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
      </Tile>
    </div>
  );
}

// ---------- Joueurs ----------
export function Joueurs({ d }) {
  const D = det(d);
  if (!D?.players?.length) return null;
  const minutes = D.players.some((p) => p.minutes != null);
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <StoryTile className="lg:col-span-7" k="joueurs.scatter" question="Qui fait avancer l'équipe, et à quel prix ?"
        note={`Une perte suit le volume de jeu : celui qui porte le ballon le perd plus souvent.${minutes ? "" : " Chiffres sur le match (minutes jouées dès que la composition est saisie)."}`}>
        <PlayerScatter players={D.players} />
      </StoryTile>
      <StoryTile className="lg:col-span-5" k="joueurs.duos" question="Quels duos créent les occasions ?" note="Passeur → tireur, xG des tirs créés.">
        <DuoList duos={D.duos} players={D.players} />
      </StoryTile>
      <div className="lg:col-span-12"><PlayerCards players={D.players} /></div>
      <Tile className="lg:col-span-12" title="Tous les joueurs" note="Cliquer un en-tête pour trier. Entrées dangereuses = suivies d'un tir ou d'une entrée dans la surface en 15 s.">
        <PlayerTable players={D.players} />
      </Tile>
    </div>
  );
}

// ---------- Saison ----------
const SEASON_IDS = ["chance_share", "xg_for", "xg_against", "xgd", "buildup_progression", "transition_to_box", "setpiece_shot_rate",
  "hs_entry_share", "between_lines_rate", "redzone_entries", "box_entries", "counterpress_5s", "high_regains", "closing_3s_mean"];

function Spark({ series }) {
  const vals = series.map((s) => s.value).filter((v) => v != null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals), w = 80, h = 20;
  const pts = series.map((s, i) => s.value == null ? null : [i / (series.length - 1) * w, h - 2 - ((s.value - min) / (max - min || 1)) * (h - 4)]).filter(Boolean);
  return <svg width={w} height={h} aria-hidden="true"><polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--us)" strokeWidth="2" /></svg>;
}

function CatalogueTable({ ids, M, S, openClips }) {
  return (
    <table className="w-full table-fixed text-[13px]">
      <colgroup><col className="w-[40%]" /><col className="w-[14%]" /><col className="w-[22%]" /><col className="w-[12%]" /><col className="w-[12%]" /></colgroup>
      <tbody>{ids.map((id) => (
        <tr key={id} className="border-b border-rule last:border-0">
          <td className="py-1 pr-2"><button type="button" className="text-left text-ink-2 hover:text-ink hover:underline" onClick={() => openClips(M[id])}>{M[id].label_fr}</button></td>
          <td className="py-1 pr-2 text-right font-semibold tabular">{fmtValue(M[id])}</td>
          <td className="py-1 pr-2 text-right text-[11px] text-ink-3">{subline(M[id])}</td>
          <td className="py-1 pr-2 text-right">{S[id] ? <Spark series={S[id].series} /> : null}</td>
          <td className="py-1 text-right">{S[id] ? <StatusChip status={S[id].status} /> : null}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

export function Saison({ v1, d, openClips }) {
  const M = v1.metrics, S = d.seasonV1?.metrics || {};
  return (
    <div className="grid gap-3">
      <Tile title="Nos priorités, match après match">
        <CatalogueTable ids={SEASON_IDS.filter((id) => known(M, id))} M={M} S={S} openClips={openClips} />
      </Tile>
    </div>
  );
}

// ---------- Analyste (no tab: #analyste) ----------
export function Analyste({ v1, d, openClips }) {
  const M = v1.metrics, S = d.seasonV1?.metrics || {}, D = det(d);
  const missing = Object.values(M).filter((m) => m.value == null || m.coverage === 0);
  const judged = Object.values(M).filter((m) => m.coverage != null);
  const exportAll = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([catalogueCsv(M, `${v1.match?.date} ${v1.match?.opponent}`)], { type: "text/csv" }));
    a.download = `catalogue_${v1.match?.date}_${v1.match?.opponent}.csv`; a.click();
  };
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <div className="flex items-center justify-between gap-3 lg:col-span-12">
        <p className="text-[13px] text-ink-2">Page analyste : tout le catalogue et les contrôles. Pas d'onglet ; adresse <span className="font-mono">#analyste</span>.</p>
        <button type="button" onClick={exportAll} className="rounded border border-rule bg-paper px-3 py-1.5 text-sm font-semibold text-ink hover:bg-paper-2">Exporter tout (CSV)</button>
      </div>
      {d.texts?.texts && <Tile className="lg:col-span-12" title="Phrases du tableau de bord" note={`${d.texts.source === "llm" ? "Rédigées par Claude" : "Modèles automatiques"} ; crayon = réécrire, phrase vide = revenir à la version générée. Une phrase vide n'est pas affichée.`}>
        <ul className="divide-y divide-rule text-[13px]">{Object.keys(d.texts.texts).sort().map((k) => (
          <li key={k} className="grid grid-cols-[13rem_1fr] gap-3 py-1.5"><span className="font-mono text-[11px] text-ink-3">{k}{d.texts.edited?.includes(k) ? " · modifiée" : ""}</span>
            <EditableText k={k} showEmpty className="text-ink" /></li>
        ))}</ul>
      </Tile>}
      <Tile className="lg:col-span-6" title="Non mesuré sur ce match" note="Statistiques sans valeur : cartes de revue absentes (thème tournant) ou échantillon vide.">
        <ul className="space-y-1 text-[13px]">{missing.map((m) => (
          <li key={m.id} className="flex justify-between gap-2"><span className="text-ink-2">{m.label_fr}</span><span className="text-ink-3">{m.coverage === 0 ? "aucune carte revue" : `n = ${m.n}`}</span></li>
        ))}</ul>
      </Tile>
      <Tile className="lg:col-span-6" title="Contrôles d'intégrité">
        <ul className="space-y-1 text-[13px]">{v1.gates.map((g) => <li key={g.id} className="flex justify-between gap-2"><span>{g.id} · {g.detail}</span><span className="font-semibold">{g.ok ? "✓" : "✗"}</span></li>)}</ul>
        <div className="mt-4 text-[11px] font-medium text-ink-2">Temps tapé</div>
        <Bars data={{ "Notre ballon": v1.minutes.US, "Leur ballon": v1.minutes.THEM, "Ballon mort": v1.minutes.DEAD, "Fil perdu": v1.minutes.UNKNOWN }} format={(v) => `${v.toFixed(1)} min`} />
      </Tile>
      <Tile className="lg:col-span-6" title="Couverture de la revue">
        <ul className="space-y-1 text-[13px]">{judged.map((m) => <li key={m.id} className="flex justify-between gap-2"><span className="text-ink-2">{m.label_fr}</span><span className="tabular">{pct(m.coverage)}</span></li>)}</ul>
      </Tile>
      <Tile className="lg:col-span-6" title="Charge de tagging" note="Pressions tapées par minute, par bloc de 15 min (corrections incluses). Cible 10, plafond 12.">
        <Bars data={Object.fromEntries((D?.load || []).map((b) => [`MT${b.half} · ${(b.half === 2 ? 45 : 0) + b.block * 15}–${(b.half === 2 ? 45 : 0) + b.block * 15 + 15}'`, b.per_min]))} format={(v) => dec(v)} />
        <p className="mt-3 text-[12px] text-ink-2">{v1.calibration.n ? `Décalage médian ${(v1.calibration.median_lag_ms / 1000).toFixed(1)} s sur ${v1.calibration.n} moments déplacés.` : "Aucun moment déplacé dans la revue."}</p>
      </Tile>
      {D?.players?.length > 0 && <Tile className="lg:col-span-12" title="Joueurs" note={`Ce que la revue attribue à chaque joueur. Une perte suit le volume de jeu : à lire avec les actions de chacun, jamais comme un reproche. Pertes sans pressing : ${D.unpressed_losses}.`}>
        <PlayerTable players={D.players} />
      </Tile>}
      {D && <Tile className="lg:col-span-12" title="Tous les tirs"><ShotsTable shots={D.shots} /></Tile>}
      <MetricTile className="lg:col-span-6" title="Progression dangereuse par couloir (xT)" metric={M.xt_gained} openClips={openClips}>
        <Bars data={M.xt_by_lane?.value} order={[...LANES, "?"]} labels={LANE_FR} format={(v) => v.toFixed(3)} onSelect={(k) => openClips(only(M.xt_gained, "lane", k, LANE_FR[k]))} />
      </MetricTile>
      <MetricTile className="lg:col-span-6" title="… et par phase" metric={M.xt_by_phase} openClips={openClips}>
        <Bars data={M.xt_by_phase?.value} order={[...PHASES, "?"]} labels={PHASE_FR} format={(v) => v.toFixed(3)} />
      </MetricTile>
      {d.possessions && <Tile className="lg:col-span-12" title="Toutes les possessions"><PossessionTimeline possessions={d.possessions} /></Tile>}
      <Tile className="lg:col-span-12" title="Catalogue complet">
        {Object.keys(GROUP_FR).map((g) => {
          const ids = Object.keys(M).filter((k) => M[k].group === g && typeof M[k].value !== "object");
          return ids.length ? <div key={g} className="mb-4"><h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{GROUP_FR[g]}</h4>
            <CatalogueTable ids={ids} M={M} S={S} openClips={openClips} /></div> : null;
        })}
      </Tile>
    </div>
  );
}

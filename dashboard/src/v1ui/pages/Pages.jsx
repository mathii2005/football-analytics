import Tile from "../../charts/Tile.jsx";
import PossessionTimeline from "../../components/PossessionTimeline.jsx";
import MetricTile from "../MetricTile.jsx";
import MetricRows from "../MetricRows.jsx";
import Bars from "../Bars.jsx";
import LaneGrid from "../LaneGrid.jsx";
import StatusChip from "../StatusChip.jsx";
import ShotsTable from "../ShotsTable.jsx";
import XgFlow from "../XgFlow.jsx";
import { fmtValue, subline, catalogueCsv, GROUP_FR, LANE_FR, PHASE_FR, CAUSE_FR, INTENT_FR, METHOD_FR, ASSIST_FR, LOC_FR, RESTART_FR } from "../format.js";
import { pct, dec, clock } from "../../format.js";

// The v1 pages (PIPELINE §7.2), built only from the v1 engine
// (/matches/{id}/metrics, /details, /recap). Staff pages carry the few visuals
// that answer the staff's priorities; everything else is on the analyst page
// (#analyste), which has no tab.
const PHASES = ["TRANSITION", "BUILD_UP", "SETTLED", "SET_PIECE"];
const LANES = ["L", "HS_L", "C", "HS_R", "R"];
const ASSISTS = Object.keys(ASSIST_FR);
const LOCS = Object.keys(LOC_FR);
const METHODS = ["PASS", "CARRY", "CROSS", "SET_PIECE", "LOOSE"];
const xg2 = (v) => v.toFixed(2);
const has = (o) => !!o && Object.values(o).some((v) => v);
const known = (M, id) => M[id] && M[id].value != null;

// "click a bar -> its clips": the metric's moments filtered on one field
function only(metric, field, value, label) {
  const all = (metric?.clips?.all || []).filter((c) => (c[field] ?? "?") === value);
  return { ...metric, label_fr: `${metric.label_fr} · ${label}`, clips: { typical: all.slice(0, 3), extreme: [], all, mode: "spread" } };
}

function det(d) { return d.details?.available ? d.details : null; }

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

// ---------- Récap ----------
const PRIORITIES = [["Identité", "chance_share"], ["Construction", "buildup_progression"], ["Couloir intérieur", "hs_entry_share"],
  ["Zone rouge", "box_entries"], ["Intensité", "counterpress_5s"], ["CPA", "setpiece_shot_rate"], ["Défense", "xg_against"]];

function RecapItems({ items }) {
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.id} className="flex items-baseline justify-between gap-3 border-b border-rule pb-2 last:border-0">
          <span className="text-[13px] text-ink-2">{it.label_fr}</span>
          <span className="text-right tabular"><span className="text-lg font-semibold text-ink">{fmtValue({ value: it.value, unit: it.unit })}</span>
            <span className="ml-2 text-[12px] text-ink-3">vs {fmtValue({ value: it.compare.value, unit: it.unit })}</span></span>
        </li>
      ))}
    </ul>
  );
}

export function Recap({ d, v1, present }) {
  const M = v1.metrics, S = d.seasonV1?.metrics || {}, D = det(d), r = d.recap;
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      {r?.available && (
        <div className="flex justify-end lg:col-span-12">
          <button type="button" onClick={present} className="rounded bg-ink px-4 py-1.5 text-sm font-semibold text-paper hover:bg-ink-2">Récap</button>
        </div>
      )}
      {D && <Tile className="lg:col-span-8" title="Le match en xG" note="xG cumulé de chaque équipe ; les gros points sont les buts.">
        <XgFlow shots={D.shots} />
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
      {r?.best?.length > 0 && <Tile className="lg:col-span-6" title="Ce qui a marché"><RecapItems items={r.best} /></Tile>}
      {r?.worst?.length > 0 && <Tile className="lg:col-span-6" title="À travailler"><RecapItems items={r.worst} /></Tile>}
    </div>
  );
}

// ---------- Attaque ----------
export function Attaque({ v1, d, openClips }) {
  const M = v1.metrics, D = det(d);
  const byPhase = Object.fromEntries(PHASES.map((p) => [p, M[`xg_rate_${p}`]?.value]));
  const funnel = { red: M.redzone_entries?.n, box: M.box_entries?.n, shot: M.shots_for?.n, goal: M.goals_for?.n };
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      {D && <Tile className="lg:col-span-6" title="Comment nos tirs sont-ils créés ?" note="Dernière action avant le tir. Or : nous ; bleu : l'adversaire.">
        <Bars data={D.shot_origin.US} compare={D.shot_origin.THEM} labels={ASSIST_FR} order={ASSISTS} />
      </Tile>}
      {D && <Tile className="lg:col-span-6" title="D'où tire-t-on ?" note="Lieu du tir. Or : nous ; bleu : l'adversaire.">
        <Bars data={D.shot_loc.US} compare={D.shot_loc.THEM} labels={LOC_FR} order={LOCS} />
      </Tile>}
      <MetricTile className="lg:col-span-6" title="Quelle phase crée le danger ?" metric={M.xg_for} openClips={openClips} note="xG par 10 min passées dans chaque phase.">
        <Bars data={byPhase} order={PHASES} labels={PHASE_FR} format={xg2} onSelect={(k) => openClips(only(M.xg_for, "phase", k, PHASE_FR[k]))} />
      </MetricTile>
      <MetricTile className="lg:col-span-6" title="Où nos attaques s'arrêtent-elles ?" metric={M.box_entries} openClips={openClips} note="Entrées en zone rouge → dans la surface → tirs → buts.">
        <Bars data={funnel} order={["red", "box", "shot", "goal"]} labels={{ red: "Zone rouge", box: "Surface", shot: "Tirs", goal: "Buts" }} />
      </MetricTile>
    </div>
  );
}

// ---------- Couloirs & zone rouge ----------
export function Couloirs({ v1, d, openClips }) {
  const M = v1.metrics, x = M.hs_entry_share?.detail || {};
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <MetricTile className="lg:col-span-7" title="Par où entrons-nous dans la zone rouge ?" metric={M.hs_entry_share} openClips={openClips}
        note={`${x.entries ?? 0} entrées, par couloir et profondeur.`}>
        <LaneGrid grid={x.grid} />
      </MetricTile>
      <MetricTile className="lg:col-span-5" title="Comment entrons-nous ?" metric={M.hs_entry_share} openClips={openClips} note="Méthode d'entrée.">
        <Bars data={x.methods} labels={METHOD_FR} order={METHODS} />
      </MetricTile>
      <Tile className="lg:col-span-12" title="Couloir intérieur et attaque des 18 m">
        <MetricRows ids={["hs_entry_share", "between_lines_rate", "hs_to_box", "hs_assist_share", "red_to_box", "box_attack_eff", "possessions_reaching_redzone"]}
          metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
      </Tile>
    </div>
  );
}

// ---------- Intensité ----------
export function Intensite({ v1, d, openClips }) {
  const M = v1.metrics, x = M.counterpress_5s?.detail || {}, D = det(d);
  const bands = Object.fromEntries(Object.entries(x.losses_by_band || {}).map(([b, n]) => [`Zone ${b}`, n]));
  const ls = D?.losses_to_shots;
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      {D && has(D.closing) && <Tile className="lg:col-span-6" title="Combien de joueurs ferment après une perte ?" note="Joueurs à moins de 3 s du porteur après nos pertes dans leur moitié.">
        <Bars data={D.closing} order={["0", "1", "2", "3PLUS"]} labels={{ 0: "Personne", 1: "1 joueur", 2: "2 joueurs", "3PLUS": "3 et +" }} />
      </Tile>}
      <MetricTile className="lg:col-span-6" title="Où perd-on le ballon dans leur moitié ?" metric={M.counterpress_5s} openClips={openClips}>
        <Bars data={bands} order={["Zone 3", "Zone 4", "Zone 5"]} />
        {has(x.causes) && <><div className="mt-4 text-[11px] font-medium text-ink-2">Pourquoi</div>
          <Bars data={x.causes} labels={CAUSE_FR} order={["INTERCEPTED", "TACKLED", "BAD_TOUCH", "OUT", "FOUL"]} /></>}
      </MetricTile>
      {has(x.intents) && <MetricTile className="lg:col-span-6" title="Que tentait-on quand on l'a perdu ?" metric={M.hs_attempt_success} openClips={openClips}>
        <Bars data={x.intents} labels={INTENT_FR} order={Object.keys(INTENT_FR)} />
      </MetricTile>}
      {ls?.moments?.length > 0 && <Tile className="lg:col-span-6" title="Nos pertes qui mènent à un tir adverse"
        note={`${ls.n_shots} de nos ${ls.n_losses} pertes suivies d'un tir adverse en 20 s, sans que l'on reprenne le ballon.`}>
        <table className="w-full text-[12px]"><thead><tr className="border-b border-rule text-left text-ink-3"><th className="py-1 font-medium">Perte</th><th className="py-1 font-medium">Zone</th>
          <th className="py-1 font-medium">Tir adverse</th><th className="py-1 text-right font-medium">Délai</th></tr></thead>
          <tbody>{ls.moments.map((m) => (
            <tr key={`${m.half}-${m.t}`} className={`border-b border-rule last:border-0 ${m.shot_v === "GOAL" ? "font-semibold" : ""}`}>
              <td className="py-1 tabular">MT{m.half} · {clock(m.t)}</td><td className="py-1">{m.band == null ? "" : `Zone ${m.band}`}</td>
              <td className="py-1">{{ OFF: "Non cadré", ON: "Cadré", GOAL: "But" }[m.shot_v]}</td><td className="py-1 text-right tabular">{dec(m.delay_s)} s</td></tr>
          ))}</tbody></table>
      </Tile>}
    </div>
  );
}

// ---------- Défense ----------
export function Defense({ v1, d, openClips }) {
  const M = v1.metrics, D = det(d);
  const byPhase = Object.fromEntries(PHASES.map((p) => [p, M[`xg_rate_${p}_against`]?.value]));
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      {D && <Tile className="lg:col-span-6" title="Comment leurs tirs sont-ils créés ?" note="Dernière action avant leur tir.">
        <Bars data={D.shot_origin.THEM} labels={ASSIST_FR} order={ASSISTS} color="var(--them)" />
      </Tile>}
      {D && <Tile className="lg:col-span-6" title="D'où tirent-ils ?" note="Lieu de leurs tirs.">
        <Bars data={D.shot_loc.THEM} labels={LOC_FR} order={LOCS} color="var(--them)" />
      </Tile>}
      <MetricTile className="lg:col-span-6" title="Dans quelle phase nous mettent-ils en danger ?" metric={M.xg_against} openClips={openClips} note="xG adverse par 10 min de chaque phase de leur possession.">
        <Bars data={byPhase} order={PHASES} labels={PHASE_FR} format={xg2} color="var(--them)" onSelect={(k) => openClips(only(M.xg_against, "phase", k, PHASE_FR[k]))} />
      </MetricTile>
      {D && has(D.opp_entries.lanes) && <Tile className="lg:col-span-6" title="Par où entrent-ils dans notre surface ?" note={`${D.opp_entries.answered} entrées dans notre surface.`}>
        <Bars data={D.opp_entries.lanes} order={LANES} labels={LANE_FR} color="var(--them)" />
        <div className="mt-4 text-[11px] font-medium text-ink-2">Comment</div>
        <Bars data={D.opp_entries.methods} order={METHODS} labels={METHOD_FR} color="var(--them)" />
      </Tile>}
    </div>
  );
}

// ---------- CPA ----------
export function Cpa({ v1, d, openClips }) {
  const M = v1.metrics, D = det(d);
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      {D && <Tile className="lg:col-span-6" title="Nos coups de pied arrêtés" note="« CPA → tir » compte les corners, penalties, coups francs dans leur moitié et touches en zone 4–5.">
        <SetPieceTable rows={D.set_pieces.US} />
      </Tile>}
      {D && <Tile className="lg:col-span-6" title="Leurs coups de pied arrêtés">
        <SetPieceTable rows={D.set_pieces.THEM} />
      </Tile>}
      <Tile className="lg:col-span-12" title="Nos CPA rapportent-ils ?">
        <MetricRows ids={["setpiece_shot_rate", "setpiece_xg", "first_contact_won", "xg_rate_SET_PIECE", "setpiece_shot_rate_against", "setpiece_xg_against", "first_contact_won_against"]}
          metrics={M} season={d.seasonV1?.metrics} openClips={openClips} />
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
        <Bars data={Object.fromEntries((D?.load || []).map((b) => [`MT${b.half} · ${b.block * 15}–${b.block * 15 + 15}'`, b.per_min]))} format={(v) => dec(v)} />
        <p className="mt-3 text-[12px] text-ink-2">{v1.calibration.n ? `Décalage médian ${(v1.calibration.median_lag_ms / 1000).toFixed(1)} s sur ${v1.calibration.n} moments déplacés.` : "Aucun moment déplacé dans la revue."}</p>
      </Tile>
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

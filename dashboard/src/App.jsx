import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, Play } from "lucide-react";
import { fetchMatch, fetchMatches } from "./api.js";
import { pct, dec, secs, signed, plural, mmss, matchDate, VENUE, ZONE_LABELS, COULOIR_LABELS } from "./format.js";
import Scoreboard from "./components/Scoreboard.jsx";
import { nextPreset } from "./links.js";
import ClipsView from "./components/ClipsView.jsx";
import Apercu from "./tabs/Apercu.jsx";
import Possession from "./tabs/Possession.jsx";
import Attaque from "./tabs/Attaque.jsx";
import Terrain from "./tabs/Terrain.jsx";
import ClipDrawer from "./v1ui/ClipDrawer.jsx";
import Presentation from "./v1ui/Presentation.jsx";
import { fmtValue } from "./v1ui/format.js";
import * as V1 from "./v1ui/pages/Pages.jsx";

const TABS = [
  { id: "apercu", label: "Aperçu" },
  { id: "possession", label: "Possession" },
  { id: "attaque", label: "Attaque" },
  { id: "terrain", label: "Terrain" },
  { id: "clips", label: "Clips Veo" },
];
// v1 matches (two-pass tagger): the pages of PIPELINE §7.2
const V1_TABS = [
  { id: "recap", label: "Récap", Page: V1.Recap },
  { id: "saison", label: "Saison", Page: V1.Saison },
  { id: "attaque", label: "Attaque", Page: V1.Attaque },
  { id: "couloirs", label: "Couloirs & zone rouge", Page: V1.Couloirs },
  { id: "possession", label: "Possession & construction", Page: V1.Possession },
  { id: "intensite", label: "Intensité", Page: V1.Intensite },
  { id: "cpa", label: "CPA", Page: V1.Cpa },
  { id: "defense", label: "Défense", Page: V1.Defense },
  { id: "clips", label: "Clips" },
  { id: "donnees", label: "Données", Page: V1.Donnees },
];
const ALL_IDS = new Set([...TABS, ...V1_TABS].map((t) => t.id));

// KPI row of a v1 page: catalogue metrics, value + n / status in the sub line
const V1_KPIS = {
  recap: ["goals_for", "xg_for", "chances_for", "field_tilt_time", "box_entries"],
  saison: ["chance_share", "box_entries", "hs_entry_share", "counterpress_5s", "xgd"],
  attaque: ["xg_for", "shots_for", "chances_for", "conversion", "xt_gained"],
  couloirs: ["redzone_entries", "box_entries", "red_to_box", "hs_entry_share", "between_lines_rate"],
  possession: ["field_tilt_time", "field_tilt_classic", "buildup_progression", "opp_possession_length", "possessions_reaching_redzone"],
  intensite: ["counterpress_5s", "high_regains", "closing_3s_mean", "duel_win", "resilience_late"],
  cpa: ["setpiece_shot_rate", "setpiece_xg", "first_contact_won", "setpiece_shot_rate_against", "first_contact_won_against"],
  defense: ["goals_against", "shots_against", "xg_against", "transition_to_box_against", "buildup_progression_against"],
  clips: ["goals_for", "shots_for", "box_entries", "counterpress_5s", "shots_against"],
  donnees: ["shots_for", "box_entries", "hs_entry_share", "counterpress_5s", "xg_for"],
};
function v1Figures(tab, d) {
  const M = d.v1.metrics;
  return (V1_KPIS[tab] || V1_KPIS.recap).filter((k) => M[k]).map((k) => {
    const m = M[k];
    const sub = [`n = ${m.n}`, m.coverage != null ? `revu ${Math.round(m.coverage * 100)} %` : null, m.status !== "ok" ? m.status : null].filter(Boolean).join(" · ");
    return { label: m.label_fr + (k.endsWith("_against") ? " (adv.)" : ""), value: fmtValue(m), sub };
  });
}

function Wordmark() {
  // The user's logo goes in dashboard/public/logo.png; until then, the name.
  const [logo, setLogo] = useState(true);
  return logo
    ? <img src="/logo.png" alt="Lauréats" className="h-9 w-auto" onError={() => setLogo(false)} />
    : <span className="display text-2xl font-bold uppercase tracking-[0.12em] text-gold">Lauréats</span>;
}

function figuresFor(tab, d) {
  const { report: r, clips, phases: ph } = d;
  const m = r.metrics, h = r.headline;
  const score = r.match.final_score;
  if (tab === "apercu") return [
    { label: "Possession", value: pct(m.possession_pct.strict), sub: `${pct(m.possession_pct.inclusive)} avec les phases déduites` },
    { label: "Tirs", value: h.shots, sub: `${plural(h.shots_on_target, "cadré")} · ${plural(h.goals, "but")}` },
    { label: "Bilan récup / perte", value: signed(h.balance), sub: `${h.recups} récup · ${h.losses} pertes` },
    { label: "Field tilt", value: pct(h.field_tilt), sub: "évènements dans leur moitié" },
    { label: "Récup hautes", value: pct(h.high_recup_share), sub: `${h.high_recups} en zone 3, 4 ou surface` },
  ];
  if (tab === "possession") {
    const cp = ph.counter_press, t = r.transition_speed;
    return [
      { label: "Possession médiane", value: secs(ph.profile.us.median_ms), sub: `${ph.profile.us.n} possessions · eux ${secs(ph.profile.them.median_ms)}` },
      { label: "Repris en ≤ 10 s", value: pct(cp.within_10s), sub: `après nos ${cp.n_losses} pertes · ≤ 5 s ${pct(cp.within_5s)}` },
      { label: "Récup → action", value: t.median_s == null ? "–" : `${dec(t.median_s)} s`, sub: `médiane sur ${plural(t.n, "transition")}` },
      { label: "Tirs par possession", value: dec(ph.finishing.shots_per_possession), sub: `1 tir toutes les ${dec(ph.finishing.possessions_per_shot)} poss.` },
      ph.game_time.dead_ms
        ? { label: "Temps effectif", value: mmss(ph.game_time.live_ms), sub: `arrêts longs tagués ${mmss(ph.game_time.dead_ms)}` }
        : { label: "Temps total", value: mmss(ph.game_time.live_ms), sub: "aucun arrêt long tagué" },
    ];
  }
  if (tab === "attaque") return [
    { label: "Actions dangereuses", value: h.dangerous_actions, sub: `${dec(h.actions_per_shot)} actions par tir` },
    { label: "Entrées surface", value: r.funnel[1].n, sub: `${h.box_shots} tirs dans la surface` },
    { label: "Possessions avec tir", value: m.shot_sequences, sub: `${pct(m.shot_sequence_rate)} de nos possessions` },
    { label: "Jeu vertical", value: pct(r.attack_style.vertical_pct),
      sub: r.attack_style.lateral === 0 ? "aucun centre / changement tagué" : "passes prof. + conduites" },
    { label: "Buts sur CPA", value: r.set_pieces.goals_from_set_piece, sub: `${plural(r.set_pieces.shots_from_set_piece, "tir")} après un CPA` },
  ];
  if (tab === "terrain") {
    const worst = [...r.zones].sort((x, y) => y.losses - x.losses)[0];
    const main = [...r.couloir_origins].sort((x, y) => y.n - x.n)[0];
    return [
      { label: "Field tilt", value: pct(h.field_tilt), sub: "évènements dans leur moitié" },
      { label: "Dernier tiers", value: pct(m.field_tilt), sub: "de notre temps de possession" },
      { label: "Hauteur de récup", value: dec(h.recovery_height), sub: "de 1 (zone 1) à 5 (surface)" },
      { label: "Zone la plus perdue", value: worst?.losses ? ZONE_LABELS[worst.zone].replace("Zone ", "Z") : "–", sub: worst?.losses ? `${worst.losses} pertes` : "" },
      { label: "Couloir principal", value: main?.n ? COULOIR_LABELS[main.couloir] : "–", sub: main?.n ? `${pct(main.share)} des actions` : "" },
    ];
  }
  const count = (k) => clips.library.filter((c) => c.category === k).length;
  return [
    { label: "Bibliothèque", value: clips.library.length, sub: "clips liés à Veo" },
    { label: "À revoir", value: clips.selection.length, sub: "choisis par contexte" },
    { label: "Buts", value: score ? score.us + score.them : "–", sub: score ? `${score.us} pour · ${score.them} contre` : "" },
    { label: "Contre-pressing raté", value: count("failed_press"), sub: `${count("quick_regain")} réussis en ≤ 5 s` },
    { label: "Tirs", value: count("shot"), sub: `${count("box_entry")} entrées surface` },
  ];
}

export default function App() {
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(null);
  // a stat can open the clip library pre-filtered (category / zone)
  const [clipPreset, setClipPreset] = useState(null);
  // the tab lives in the URL hash so a coach can be sent straight to #clips
  const [tab, setTabState] = useState(() => {
    const h = window.location.hash.slice(1);
    return ALL_IDS.has(h) ? h : "apercu";
  });
  const moveTo = (id) => { setTabState(id); window.history.replaceState(null, "", `#${id}`); };
  // plain navigation drops any clip preset; openClips sets one
  const setTab = (id) => { setClipPreset((p) => nextPreset(p, { type: "tab" })); moveTo(id); };
  const [data, setData] = useState(null);
  const openClips = (preset) => {
    setClipPreset((p) => nextPreset(p, { type: "open", preset, key: Date.now() }));
    moveTo("clips"); window.scrollTo(0, 0);
  };
  const [loading, setLoading] = useState(false);
  const [drawer, setDrawer] = useState(null);     // v1 metric whose clips are open
  const [presenting, setPresenting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMatches()
      .then((ms) => { setMatches(ms); if (ms.length) setSelected(ms[0].id); })
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

  const isV1 = !!data?.v1?.available;
  const tabs = isV1 ? V1_TABS : TABS;
  // a tab that does not exist for this kind of match falls back to the first one
  const current = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
  const info = data?.report.match;
  const score = info?.final_score;

  return (
    <div className="min-h-screen bg-paper-2">
      <header className="band bg-band text-paper">
        <div className="mx-auto max-w-7xl px-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <Wordmark />
            <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-band-ink-2">
              <span className="hidden sm:inline">Match</span>
              <select value={selected ?? ""} onChange={(e) => { setClipPreset((p) => nextPreset(p, { type: "match" })); setSelected(e.target.value); }}
                className="max-w-[16rem] rounded border border-band-rule bg-band-2 px-3 py-2 text-sm normal-case tracking-normal text-paper">
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {matchDate(m.date)} · {m.opponent}{m.final_score ? ` ${m.final_score.us}–${m.final_score.them}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {info && (
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-3 pt-1">
              <h1 className="display text-3xl font-bold uppercase leading-none tracking-wide sm:text-4xl">
                Lauréats <span className="text-gold tabular">{score ? `${score.us}–${score.them}` : "–"}</span> {info.opponent}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-band-ink-2">
                <span>{matchDate(info.date)} · {VENUE[info.venue] ?? info.venue}</span>
                {info.veo_url && (
                  <a href={info.veo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-paper underline decoration-band-rule hover:decoration-gold">
                    Match sur Veo <ExternalLink size={13} aria-hidden="true" />
                  </a>
                )}
                {data && current !== "clips" && (
                  <button type="button" onClick={() => setTab("clips")}
                    className="inline-flex items-center gap-1.5 rounded bg-gold px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-gold-lift">
                    <Play size={14} strokeWidth={2.5} aria-hidden="true" /> Voir les clips ({data.clips.selection.length})
                  </button>
                )}
              </div>
            </div>
          )}

          <nav role="tablist" aria-label="Sections" className="-mx-3 flex overflow-x-auto px-3 sm:mx-0 sm:px-0"
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              const i = tabs.findIndex((t) => t.id === current);
              const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].id;
              setTab(next);
              document.getElementById(`tab-${next}`)?.focus();
            }}>
            {tabs.map((t) => (
              <button key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={current === t.id} aria-controls="tabpanel"
                tabIndex={current === t.id ? 0 : -1} type="button" onClick={() => setTab(t.id)}
                className={`display shrink-0 border-b-2 px-2 py-3 text-[15px] font-semibold uppercase tracking-wide transition-colors sm:px-3 ${isV1 ? "sm:text-base" : "sm:px-4 sm:text-lg"} ${
                  current === t.id ? "border-gold text-paper" : "border-transparent text-band-ink-2 hover:text-paper"}`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        {data && (
          <div className="bg-band-2">
            <div className="mx-auto max-w-7xl sm:px-2">
              <Scoreboard figures={isV1 ? v1Figures(current, data) : figuresFor(current, data)} boardKey={`${selected}-${current}`} />
            </div>
          </div>
        )}
      </header>

      <main id="tabpanel" role="tabpanel" aria-labelledby={`tab-${current}`}
        className={`mx-auto max-w-7xl px-3 py-4 transition-opacity sm:px-5 ${loading ? "opacity-50" : ""}`}>
        {error && (
          <div role="alert" className="mb-8 flex gap-3 rounded border border-rule bg-paper-2 p-4 text-sm text-ink-2">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-gold-deep" aria-hidden="true" />
            <p><span className="font-medium text-ink">Impossible de charger les données.</span> {error}. Vérifie que l'API tourne sur le port 8000.</p>
          </div>
        )}
        {!data && !error && (
          <p className="flex items-center gap-2 text-sm text-ink-3"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Chargement du match…</p>
        )}
        {data && !isV1 && current === "apercu" && <Apercu d={data} goClips={() => setTab("clips")} />}
        {data && !isV1 && current === "possession" && <Possession d={data} openClips={openClips} />}
        {data && !isV1 && current === "attaque" && <Attaque d={data} openClips={openClips} />}
        {data && !isV1 && current === "terrain" && <Terrain d={data} openClips={openClips} />}
        {data && current === "clips" && <ClipsView clips={data.clips} quality={data.quality} preset={clipPreset} />}
        {data && isV1 && (() => { const T = V1_TABS.find((t) => t.id === current); return T?.Page ? <T.Page d={data} v1={data.v1} openClips={setDrawer} present={() => setPresenting(true)} /> : null; })()}
        {presenting && data?.recap?.available && <Presentation recap={data.recap} info={data.report.match} matchId={selected} onClose={() => setPresenting(false)} />}
        <ClipDrawer metric={drawer} onClose={() => setDrawer(null)} />
      </main>
    </div>
  );
}

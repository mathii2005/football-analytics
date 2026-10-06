import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { fetchMatch, fetchMatches, fetchMetrics, fetchSeasonV1 } from "./api.js";
import FilterBar from "./v1ui/FilterBar.jsx";
import { pct, matchDate, VENUE } from "./format.js";
import Scoreboard from "./components/Scoreboard.jsx";
import ClipDrawer from "./v1ui/ClipDrawer.jsx";
import Presentation from "./v1ui/Presentation.jsx";
import { fmtValue } from "./v1ui/format.js";
import * as V1 from "./v1ui/pages/Pages.jsx";

// Staff tabs, in order of importance (PIPELINE §7.2). The analyst page has no
// tab: it opens at #analyste.
const V1_TABS = [
  { id: "recap", label: "Récap", Page: V1.Recap },
  { id: "attaque", label: "Attaque", Page: V1.Attaque },
  { id: "couloirs", label: "Couloirs & zone rouge", Page: V1.Couloirs },
  { id: "intensite", label: "Intensité", Page: V1.Intensite },
  { id: "defense", label: "Défense", Page: V1.Defense },
  { id: "cpa", label: "CPA", Page: V1.Cpa },
  { id: "saison", label: "Saison", Page: V1.Saison },
];
const ANALYST = { id: "analyste", label: "Analyste", Page: V1.Analyste };
const ALL_IDS = new Set([...V1_TABS, ANALYST].map((t) => t.id));

// KPI row of a page: catalogue metrics (only those with a value)
const V1_KPIS = {
  recap: ["goals_for", "xg_for", "xg_against", "chances_for", "chances_against"],
  attaque: ["xg_for", "shots_for", "chances_for", "conversion", "xt_gained"],
  couloirs: ["redzone_entries", "box_entries", "red_to_box", "hs_entry_share", "between_lines_rate"],
  intensite: ["counterpress_5s", "high_regains", "closing_3s_mean", "closing_2plus_share", "opp_possession_length"],
  defense: ["goals_against", "shots_against", "xg_against", "chances_against", "buildup_progression_against"],
  cpa: ["setpiece_shot_rate", "setpiece_xg", "setpiece_shot_rate_against", "first_contact_won", "xg_rate_SET_PIECE"],
  saison: ["chance_share", "xgd", "buildup_progression", "hs_entry_share", "counterpress_5s"],
  analyste: ["shots_for", "box_entries", "hs_entry_share", "counterpress_5s", "xg_for"],
};
function v1Figures(tab, d) {
  const M = d.v1.metrics;
  const figs = (V1_KPIS[tab] || V1_KPIS.recap).filter((k) => M[k] && M[k].value != null).map((k) => {
    const m = M[k];
    const sub = [`n = ${m.n}`, m.coverage != null ? `revu ${Math.round(m.coverage * 100)} %` : null].filter(Boolean).join(" · ");
    const label = m.label_fr.replace(" (adversaire)", "") + (k.endsWith("_against") ? " (adv.)" : "");
    return { label, value: fmtValue(m), sub };
  });
  const poss = d.details?.possession_share;
  if (tab === "recap" && poss != null) figs.splice(1, 0, { label: "Possession", value: pct(poss), sub: "temps de ballon vivant" });
  return figs.slice(0, 5);
}

function Wordmark() {
  // The user's logo goes in dashboard/public/logo.png; until then, the name.
  const [logo, setLogo] = useState(true);
  return logo
    ? <img src="/logo.png" alt="Lauréats" className="h-9 w-auto" onError={() => setLogo(false)} />
    : <span className="display text-2xl font-bold uppercase tracking-[0.12em] text-gold">Lauréats</span>;
}

export default function App() {
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(null);
  // the tab lives in the URL hash so a coach can be sent straight to #clips
  const [tab, setTabState] = useState(() => {
    const h = window.location.hash.slice(1);
    return ALL_IDS.has(h) ? h : "recap";
  });
  const moveTo = (id) => { setTabState(id); window.history.replaceState(null, "", `#${id}`); };
  const setTab = (id) => moveTo(id);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drawer, setDrawer] = useState(null);     // v1 metric whose clips are open
  const [presenting, setPresenting] = useState(false);
  const [half, setHalf] = useState(null);            // v1 filters
  const [tier, setTier] = useState(null);
  const [venue, setVenue] = useState(null);
  const [error, setError] = useState(null);

  // typing #analyste (or any tab id) in the address bar opens that page
  useEffect(() => {
    const onHash = () => { const h = window.location.hash.slice(1); if (ALL_IDS.has(h)) setTabState(h); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    fetchMatches()
      .then((ms) => { setMatches(ms); if (ms.length) setSelected(ms[0].id); })
      .catch((e) => setError(e.message));
  }, []);

  // half filter: every metric recomputed on that half
  useEffect(() => {
    if (!data?.v1?.available) return;
    fetchMetrics(selected, half).then((v1) => setData((d) => (d ? { ...d, v1 } : d))).catch((e) => setError(e.message));
  }, [half]);   // eslint-disable-line react-hooks/exhaustive-deps
  // opponent tier / venue: the season view and the reference statuses
  useEffect(() => {
    if (!data?.v1?.available) return;
    fetchSeasonV1({ tier, venue }).then((s) => setData((d) => (d ? { ...d, seasonV1: s } : d))).catch(() => {});
  }, [tier, venue]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) return;
    setHalf(null); setTier(null); setVenue(null);
    setLoading(true);
    fetchMatch(selected)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected]);

  const isV1 = !!data?.v1?.available;
  const tabs = V1_TABS;
  // a tab that does not exist for this kind of match falls back to the first one
  const current = tab === ANALYST.id || tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
  const page = current === ANALYST.id ? ANALYST : tabs.find((t) => t.id === current);
  const info = data?.v1?.match;
  const score = info?.final_score;

  return (
    <div className="min-h-screen bg-paper-2">
      <header className="band bg-band text-paper">
        <div className="mx-auto max-w-7xl px-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <Wordmark />
            <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-band-ink-2">
              <span className="hidden sm:inline">Match</span>
              <select value={selected ?? ""} onChange={(e) => setSelected(e.target.value)}
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
                className={`display shrink-0 border-b-2 px-2 py-3 text-[15px] font-semibold uppercase tracking-wide transition-colors sm:px-3 sm:text-base ${
                  current === t.id ? "border-gold text-paper" : "border-transparent text-band-ink-2 hover:text-paper"}`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        {data && (
          <div className="bg-band-2">
            <div className="mx-auto max-w-7xl sm:px-2">
              <Scoreboard figures={isV1 ? v1Figures(current, data) : []} boardKey={`${selected}-${current}`} />
            </div>
          </div>
        )}
      </header>
      {isV1 && <FilterBar half={half} setHalf={setHalf} tier={tier} setTier={setTier} venue={venue} setVenue={setVenue} nSeason={data.seasonV1?.matches?.length} />}

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
        {data && !isV1 && <p className="text-sm text-ink-3">Ce match n'a pas été tagué avec le tagger v1.</p>}
        {data && isV1 && page?.Page && <page.Page d={data} v1={data.v1} openClips={setDrawer} present={() => setPresenting(true)} />}
        {presenting && data?.recap?.available && <Presentation recap={data.recap} info={data.v1.match} matchId={selected} onClose={() => setPresenting(false)} />}
        <ClipDrawer metric={drawer} onClose={() => setDrawer(null)} />
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, ExternalLink, Loader2, Play } from "lucide-react";
import { fetchMatch, fetchMatches } from "./api.js";
import { pct, dec, secs, signed, plural, matchDate, VENUE, ZONE_LABELS } from "./format.js";
import Scoreboard from "./components/Scoreboard.jsx";
import Section from "./components/Section.jsx";
import KeyPoints from "./components/KeyPoints.jsx";
import PossessionTimeline from "./components/PossessionTimeline.jsx";
import HalvesTable from "./components/HalvesTable.jsx";
import ThreatChart from "./components/ThreatChart.jsx";
import OutcomeChart from "./components/OutcomeChart.jsx";
import SetPieces from "./components/SetPieces.jsx";
import PitchZones from "./components/PitchZones.jsx";
import AttackOrigins from "./components/AttackOrigins.jsx";
import CouloirTable from "./components/CouloirTable.jsx";
import ClipsView from "./components/ClipsView.jsx";
import ClipRow from "./components/ClipRow.jsx";
import PossessionTable from "./components/PossessionTable.jsx";

const TABS = [
  { id: "apercu", label: "Aperçu" },
  { id: "profondeur", label: "En profondeur" },
  { id: "terrain", label: "Terrain" },
  { id: "clips", label: "Clips Veo" },
];

function Wordmark() {
  // The user's logo goes in dashboard/public/logo.png; until then, the name.
  const [logo, setLogo] = useState(true);
  return logo
    ? <img src="/logo.png" alt="Lauréats" className="h-9 w-auto" onError={() => setLogo(false)} />
    : <span className="display text-2xl font-bold uppercase tracking-[0.12em] text-gold">Lauréats</span>;
}

function figuresFor(tab, d) {
  const { report: r, clips } = d;
  const m = r.metrics, h = r.headline;
  const losses = r.metrics.outcomes;
  const ourLosses = d.losses.losses.length;
  const oppHalf = d.losses.losses.filter((l) => l.zone === 3 || l.zone === 4 || l.zone === "BOX").length;
  const count = (k) => clips.categories.find((c) => c.key === k)?.clips.length ?? 0;
  const score = r.match.final_score;
  if (tab === "apercu") return [
    { label: "Possession", value: pct(m.possession_pct.strict), sub: `${pct(m.possession_pct.inclusive)} avec les phases déduites · fiable sur ${pct(m.possession_pct.coverage)} du jeu` },
    { label: "Tirs", value: h.shots, sub: `${plural(h.shots_on_target, "cadré")} · ${plural(h.goals, "but")}` },
    { label: "Pertes dans leur moitié", value: pct(ourLosses ? oppHalf / ourLosses : null), sub: `${oppHalf} sur ${ourLosses} pertes` },
    { label: "Bilan récup / perte", value: signed(h.recups - h.losses), sub: `${h.recups} récup · ${h.losses} pertes` },
    { label: "Possessions avec tir", value: m.shot_sequences, sub: `${pct(m.shot_sequence_rate)} de nos possessions` },
  ];
  if (tab === "profondeur") {
    const [a, b] = r.halves;
    return [
      { label: "Récupération → tir", value: secs(m.turnover_to_shot_ms.median), sub: `médiane sur ${plural(m.turnover_to_shot_ms.n, "action")}` },
      { label: "Pertes rapides", value: losses.cheap_loss, sub: "reperdu en moins de 5 s" },
      { label: "Direct / construit", value: `${m.direct}/${m.sustained}`, sub: "attaques jusqu'à la surface" },
      { label: "Menace MT1 → MT2", value: b ? `${a.threat}→${b.threat}` : a?.threat ?? "–", sub: "score pondéré, pas un xG" },
      { label: "Actions par tir", value: dec(h.actions_per_shot), sub: `${h.dangerous_actions} actions dangereuses` },
    ];
  }
  if (tab === "terrain") {
    const worst = [...r.zones].sort((x, y) => y.losses - x.losses)[0];
    return [
      { label: "Dernier tiers", value: pct(m.field_tilt), sub: "de notre temps de possession" },
      { label: "Hauteur de récup", value: dec(h.recovery_height), sub: "de 1 (zone 1) à 5 (surface)" },
      { label: "Récupérations hautes", value: m.high_recups, sub: `${pct(h.recups ? m.high_recups / h.recups : null)} de nos récupérations` },
      { label: "Zone la plus perdue", value: worst?.losses ? ZONE_LABELS[worst.zone].replace("Zone ", "Z") : "–", sub: worst?.losses ? `${worst.losses} pertes` : "" },
      { label: "Intensité du pressing", value: dec(m.ppda_lite), sub: "poss. adverses par récup haute · bas = fort" },
    ];
  }
  return [
    { label: "À revoir", value: clips.selection.length, sub: "clips choisis par contexte" },
    { label: "Buts", value: score ? score.us + score.them : "–", sub: score ? `${score.us} pour · ${score.them} contre` : "" },
    { label: "Occasions", value: count("chance"), sub: "tirs cadrés ou dans la surface" },
    { label: "Pertes à revoir", value: count("costly_loss"), sub: "notre moitié ou rapides" },
    { label: "Pressing réussi", value: count("press_win"), sub: "récup haute → surface" },
  ];
}

function Apercu({ d, goClips }) {
  const top = [...d.clips.selection].sort((a, b) => b.priority - a.priority).slice(0, 3);
  return (
    <div className="space-y-10">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Section title="Points clés" note="Générés automatiquement à partir des tags.">
          <KeyPoints points={d.report.key_points} />
        </Section>
        <Section title="Qui avait le ballon" note="Possessions reconstruites ; survoler ou tabuler pour le détail. Les temps d'arrêt longs sont exclus des durées.">
          <PossessionTimeline possessions={d.possessions} />
        </Section>
      </div>
      <Section title="Les moments à revoir d'abord"
        aside={<button type="button" onClick={goClips} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-deep hover:text-ink">
          Tous les clips ({d.clips.selection.length}) <ArrowRight size={15} aria-hidden="true" /></button>}>
        {top.length ? <ul>{top.map((c) => <ClipRow key={`${c.half}-${c.t_ms}`} clip={c} />)}</ul>
          : <p className="text-sm text-ink-3">Aucun moment sélectionné.</p>}
      </Section>
    </div>
  );
}

function Profondeur({ d }) {
  const r = d.report;
  return (
    <div className="space-y-10">
      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Mi-temps contre mi-temps" note="En or : la meilleure mi-temps quand l'écart est net.">
          <HalvesTable halves={r.halves} />
        </Section>
        <Section title="Comment finissent nos possessions" note="Une issue par possession, la meilleure d'abord. En or : buts et tirs ; en gras : le type de perte le plus fréquent.">
          <OutcomeChart outcomes={r.metrics.outcomes} rates={r.metrics.outcome_rates} />
        </Section>
      </div>
      <Section title="Menace par tranche de 5 minutes" note="Action dangereuse 1 pt (+2 dans la surface), tir non cadré 3, cadré 4, but 6.">
        <ThreatChart threat={r.threat} />
      </Section>
      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Coups de pied arrêtés"><SetPieces sp={r.set_pieces} /></Section>
        <Section title="Après nos pertes" note="Ce que l'adversaire a fait du ballon (ses actions sont peu taguées).">
          <p className="text-[15px] text-ink">
            <span className="display text-3xl font-semibold tabular">{d.losses.conceded_after_loss}</span>{" "}
            {d.losses.conceded_after_loss > 1 ? "buts encaissés" : "but encaissé"} directement après une perte, sur {plural(d.losses.losses.length, "perte")}.
          </p>
        </Section>
      </div>
      <PossessionTable possessions={d.possessions} />
    </div>
  );
}

function Terrain({ d }) {
  const r = d.report;
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <Section title="Bilan par zone" note="Où on gagne le ballon et où on le rend.">
        <PitchZones zones={r.zones} />
      </Section>
      <div className="space-y-10">
        <Section title="D'où partent nos attaques" note="Actions dangereuses par couloir et par zone.">
          <AttackOrigins grid={r.attack_origins} />
        </Section>
        <Section title="Valeur par couloir" note="Part des possessions passées par un couloir qui atteignent la surface ou finissent par un tir.">
          <CouloirTable couloirs={r.metrics.couloirs} />
        </Section>
      </div>
    </div>
  );
}

export default function App() {
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(null);
  // the tab lives in the URL hash so a coach can be sent straight to #clips
  const [tab, setTabState] = useState(() => {
    const h = window.location.hash.slice(1);
    return TABS.some((t) => t.id === h) ? h : "apercu";
  });
  const setTab = (id) => { setTabState(id); window.history.replaceState(null, "", `#${id}`); };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
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

  const info = data?.report.match;
  const score = info?.final_score;

  return (
    <div className="min-h-screen bg-paper">
      <header className="band bg-band text-paper">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
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
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-5 pt-2">
              <h1 className="display text-4xl font-bold uppercase leading-none tracking-wide sm:text-5xl">
                Lauréats <span className="text-gold tabular">{score ? `${score.us}–${score.them}` : "–"}</span> {info.opponent}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-band-ink-2">
                <span>{matchDate(info.date)} · {VENUE[info.venue] ?? info.venue}</span>
                {info.veo_url && (
                  <a href={info.veo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-paper underline decoration-band-rule hover:decoration-gold">
                    Match sur Veo <ExternalLink size={13} aria-hidden="true" />
                  </a>
                )}
                {data && tab !== "clips" && (
                  <button type="button" onClick={() => setTab("clips")}
                    className="inline-flex items-center gap-1.5 rounded bg-gold px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-gold-lift">
                    <Play size={14} strokeWidth={2.5} aria-hidden="true" /> Voir les clips ({data.clips.selection.length})
                  </button>
                )}
              </div>
            </div>
          )}

          <nav role="tablist" aria-label="Sections" className="-mx-4 flex overflow-x-auto px-4 sm:mx-0 sm:px-0"
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              const i = TABS.findIndex((t) => t.id === tab);
              const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].id;
              setTab(next);
              document.getElementById(`tab-${next}`)?.focus();
            }}>
            {TABS.map((t) => (
              <button key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={tab === t.id} aria-controls="tabpanel"
                tabIndex={tab === t.id ? 0 : -1} type="button" onClick={() => setTab(t.id)}
                className={`display shrink-0 border-b-2 px-2.5 py-3 text-base font-semibold uppercase tracking-wide transition-colors sm:px-4 sm:text-lg ${
                  tab === t.id ? "border-gold text-paper" : "border-transparent text-band-ink-2 hover:text-paper"}`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        {data && (
          <div className="bg-band-2">
            <div className="mx-auto max-w-6xl sm:px-2">
              <Scoreboard figures={figuresFor(tab, data)} boardKey={`${selected}-${tab}`} />
            </div>
          </div>
        )}
      </header>

      <main id="tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`}
        className={`mx-auto max-w-6xl px-4 py-8 transition-opacity sm:px-6 ${loading ? "opacity-50" : ""}`}>
        {error && (
          <div role="alert" className="mb-8 flex gap-3 rounded border border-rule bg-paper-2 p-4 text-sm text-ink-2">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-gold-deep" aria-hidden="true" />
            <p><span className="font-medium text-ink">Impossible de charger les données.</span> {error}. Vérifie que l'API tourne sur le port 8000.</p>
          </div>
        )}
        {!data && !error && (
          <p className="flex items-center gap-2 text-sm text-ink-3"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Chargement du match…</p>
        )}
        {data && tab === "apercu" && <Apercu d={data} goClips={() => setTab("clips")} />}
        {data && tab === "profondeur" && <Profondeur d={data} />}
        {data && tab === "terrain" && <Terrain d={data} />}
        {data && tab === "clips" && <ClipsView clips={data.clips} quality={data.quality} />}
      </main>
    </div>
  );
}

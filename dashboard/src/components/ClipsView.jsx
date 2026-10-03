import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Play } from "lucide-react";
import ClipFilters from "./ClipFilters.jsx";
import ClipRow from "./ClipRow.jsx";
import Section from "./Section.jsx";

function NoVideo() {
  return (
    <div className="flex gap-3 rounded border border-rule bg-paper-2 p-4 text-sm text-ink-2">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-gold-deep" aria-hidden="true" />
      <p>
        <span className="font-medium text-ink">Vidéo Veo non liée à ce match.</span> Ajoute l'URL Veo et les décalages
        du coup d'envoi (MT1 et MT2) dans les paramètres du match du tagger pour activer les liens.
      </p>
    </div>
  );
}

const EMPTY = { cats: [], half: "", zone: "", state: "", tone: "", sort: "time" };
const PAGE = 40;

function Library({ library, preset }) {
  const [f, setF] = useState(() => (preset ? { ...EMPTY, cats: preset.cats ?? [], zone: preset.zone ?? "" } : EMPTY));
  const ref = useRef(null);
  useEffect(() => {
    if (!preset) return;
    setF({ ...EMPTY, cats: preset.cats ?? [], zone: preset.zone ?? "" });
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [preset?.key]);
  const [shown, setShown] = useState(PAGE);
  const set = (next) => { setF(next); setShown(PAGE); };
  const categories = useMemo(() => {
    const seen = new Map();
    library.forEach((c) => seen.set(c.category, { key: c.category, label: c.category_label, n: (seen.get(c.category)?.n ?? 0) + 1 }));
    return [...seen.values()].sort((a, b) => b.n - a.n);
  }, [library]);
  const rows = useMemo(() => {
    const out = library.filter((c) => (!f.cats.length || f.cats.includes(c.category))
      && (!f.half || String(c.half) === f.half) && (!f.zone || c.zone === f.zone)
      && (!f.state || c.state === f.state) && (!f.tone || (f.tone === "pos") === c.positive));
    // without a category filter, one row per moment: keep the highest-priority
    // clip and carry the other categories as extra tags
    let rows = out;
    if (!f.cats.length) {
      const byMoment = new Map();
      for (const c of out) {
        const k = `${c.half}-${c.t_ms}`;
        const prev = byMoment.get(k);
        if (!prev) byMoment.set(k, { ...c, also: [] });
        else if (c.priority > prev.priority) byMoment.set(k, { ...c, also: [prev.category_label, ...prev.also] });
        else prev.also.push(c.category_label);
      }
      rows = [...byMoment.values()];
    }
    return f.sort === "priority" ? [...rows].sort((a, b) => b.priority - a.priority) : rows;
  }, [library, f]);
  return (
    <div ref={ref} className="scroll-mt-4">
    <Section title="Bibliothèque de clips" aside={<span className="text-sm text-ink-3 tabular">{rows.length} moments · {library.length} clips</span>}
      note="Tous les moments tagués, liés à Veo (8 s avant le tag). Filtre par thème, mi-temps, zone ou score.">
      <ClipFilters categories={categories} f={f} set={set} reset={() => set(EMPTY)} />
      {rows.length === 0 ? (
        <div className="mt-6 flex items-center gap-3 text-sm text-ink-2">
          Aucun clip pour ces filtres.
          <button type="button" onClick={() => set(EMPTY)} className="font-semibold text-gold-deep hover:text-ink">Réinitialiser</button>
        </div>
      ) : (
        <>
          <ul className="mt-4">{rows.slice(0, shown).map((c) => <ClipRow key={`${c.category}-${c.half}-${c.t_ms}-${c.title}`} clip={c} />)}</ul>
          {rows.length > shown && (
            <button type="button" onClick={() => setShown(shown + PAGE)}
              className="mt-3 w-full rounded border border-rule py-2 text-sm font-medium text-ink hover:border-ink-3">
              Afficher {Math.min(PAGE, rows.length - shown)} de plus ({rows.length - shown} restants)
            </button>
          )}
        </>
      )}
    </Section>
    </div>
  );
}

export default function ClipsView({ clips, quality, preset }) {
  return (
    <div className="space-y-10">
      {!clips.has_video && <NoVideo />}

      <Section title="À revoir en priorité"
        note="Les 20 moments les plus importants, choisis selon ce qu'ils ont coûté ou rapporté et le contexte (score, fin de mi-temps), dans l'ordre du match.">
        {clips.selection.length
          ? <ul>{clips.selection.map((c) => <ClipRow key={`${c.category}-${c.half}-${c.t_ms}`} clip={c} />)}</ul>
          : <p className="text-sm text-ink-3">Aucun moment à revoir selon les règles actuelles.</p>}
      </Section>

      <Library library={clips.library} preset={preset} />

      <Section title="Contrôle du tagging" note="Pour l'analyste : passages longs sans tag dans nos possessions et transitions déduites.">
        {quality.long_gaps.length === 0 && quality.inferred_transitions.length === 0
          ? <p className="text-sm text-ink-3">Rien à vérifier.</p>
          : (
            <div className="space-y-4 text-sm">
              {quality.long_gaps.length > 0 && (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-ink-3">Silences de plus de 90 s</div>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {quality.long_gaps.map((g) => (
                      <li key={`${g.half}-${g.from}`}>
                        {g.video_url
                          ? <a href={g.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded border border-rule px-2 py-1 text-ink tabular hover:border-gold">
                              <Play size={12} aria-hidden="true" /> MT{g.half} {g.from}–{g.to}
                            </a>
                          : <span className="rounded border border-rule px-2 py-1 text-ink tabular">MT{g.half} {g.from}–{g.to}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {quality.inferred_transitions.length > 0 && (
                <p className="text-ink-2"><span className="font-semibold text-ink">{quality.inferred_transitions.length}</span> transitions non taguées ont été déduites.</p>
              )}
            </div>
          )}
      </Section>
    </div>
  );
}

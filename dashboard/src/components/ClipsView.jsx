import { AlertTriangle, ChevronDown, Play } from "lucide-react";
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

export default function ClipsView({ clips, quality }) {
  return (
    <div className="space-y-10">
      {!clips.has_video && <NoVideo />}

      <Section title="À revoir en priorité"
        note="Choisis selon ce qu'ils ont coûté ou rapporté et le contexte du match (score, fin de mi-temps), dans l'ordre du match. Chaque lien ouvre Veo 8 s avant le tag.">
        {clips.selection.length
          ? <ul>{clips.selection.map((c) => <ClipRow key={`${c.category}-${c.half}-${c.t_ms}`} clip={c} />)}</ul>
          : <p className="text-sm text-ink-3">Aucun moment à revoir selon les règles actuelles.</p>}
      </Section>

      <Section title="Tous les clips par thème">
        <div className="divide-y divide-rule border-y border-rule">
          {clips.categories.filter((cat) => cat.clips.length).map((cat) => (
            <details key={cat.key} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
                <span className="font-medium text-ink">{cat.label}</span>
                <span className="flex items-center gap-3 text-sm text-ink-3 tabular">
                  {cat.clips.length}
                  <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
                </span>
              </summary>
              <ul className="pb-2">{cat.clips.map((c) => <ClipRow key={`${c.half}-${c.t_ms}-${c.title}`} clip={c} showCategory={false} />)}</ul>
            </details>
          ))}
        </div>
      </Section>

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

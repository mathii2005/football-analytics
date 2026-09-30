import { ArrowRight } from "lucide-react";
import Section from "../components/Section.jsx";
import KeyPoints from "../components/KeyPoints.jsx";
import Momentum from "../components/Momentum.jsx";
import PossessionTimeline from "../components/PossessionTimeline.jsx";
import ClipRow from "../components/ClipRow.jsx";

// The match in one screen: summary, momentum, who had the ball, first clips.
export default function Apercu({ d, goClips }) {
  const r = d.report;
  const top = [...d.clips.selection].sort((a, b) => b.priority - a.priority).slice(0, 5);
  return (
    <div className="space-y-10">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Section title="Résumé" note="Généré automatiquement à partir des tags.">
          <KeyPoints points={r.key_points} />
        </Section>
        <Section title="Momentum" note="Menace offensive par tranche de 5 minutes, buts et cartons.">
          <Momentum threat={r.threat} cards={r.cards} />
        </Section>
      </div>
      <Section title="Qui avait le ballon" note="Possessions reconstruites ; survoler ou tabuler pour le détail. Les temps d'arrêt longs sont exclus des durées.">
        <PossessionTimeline possessions={d.possessions} />
      </Section>
      <Section title="Les moments à revoir d'abord"
        aside={<button type="button" onClick={goClips} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-deep hover:text-ink">
          Bibliothèque ({d.clips.library.length} clips) <ArrowRight size={15} aria-hidden="true" /></button>}>
        {top.length ? <ul>{top.map((c) => <ClipRow key={`${c.category}-${c.half}-${c.t_ms}`} clip={c} />)}</ul>
          : <p className="text-sm text-ink-3">Aucun moment sélectionné.</p>}
      </Section>
    </div>
  );
}

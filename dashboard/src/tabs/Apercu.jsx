import { ArrowRight } from "lucide-react";
import Tile from "../charts/Tile.jsx";
import MatchStory from "../charts/MatchStory.jsx";
import TeamRadar from "../charts/TeamRadar.jsx";
import Bullets from "../charts/Bullets.jsx";
import KeyPoints from "../components/KeyPoints.jsx";
import PossessionTimeline from "../components/PossessionTimeline.jsx";
import ClipRow from "../components/ClipRow.jsx";
import { profileFor } from "../links.js";

// The match in one screen, as a tile grid: story over time, profile vs our
// season, KPIs in context, who had the ball, first clips.
export default function Apercu({ d, goClips }) {
  const me = profileFor(d.season, d.report.match.id);
  const n = d.season?.matches.length ?? 0;
  const none = <p className="text-sm text-ink-3">Profil de saison indisponible pour ce match.</p>;
  const top = [...d.clips.selection].sort((a, b) => b.priority - a.priority).slice(0, 5);
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <Tile className="lg:col-span-8" title="Quand étions-nous dangereux, et avions-nous le ballon ?"
        note="Menace offensive lissée et part de possession minute par minute, avec buts, cartons et mi-temps.">
        <MatchStory timeline={d.timeline} />
      </Tile>
      <Tile className="lg:col-span-4" title="Quel type de match était-ce ?" note={`Profil comparé à nos ${n} matchs tagués.`}>
        {me ? <TeamRadar profile={me} summary={d.season.summary} n={n} /> : none}
      </Tile>
      <Tile className="lg:col-span-4" title="Les chiffres clés, dans leur contexte" note="Ce match face à la moyenne et à l'écart de nos matchs.">
        {me ? <Bullets profile={me} summary={d.season.summary} /> : none}
      </Tile>
      <Tile className="lg:col-span-8" title="Qui avait le ballon ?" note="Chaque possession reconstruite ; survoler ou tabuler pour le détail. Hachures : limite déduite.">
        <PossessionTimeline possessions={d.possessions} />
      </Tile>
      <Tile className="lg:col-span-5" title="Ce que disent les données" note="Généré automatiquement à partir des tags.">
        <KeyPoints points={d.report.key_points} />
      </Tile>
      <Tile className="lg:col-span-7" title="Les moments à revoir d'abord"
        aside={<button type="button" onClick={goClips} className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-gold-deep hover:text-ink">
          Bibliothèque ({d.clips.library.length}) <ArrowRight size={13} aria-hidden="true" /></button>}>
        {top.length ? <ul>{top.map((c) => <ClipRow key={`${c.category}-${c.half}-${c.t_ms}`} clip={c} />)}</ul>
          : <p className="text-sm text-ink-3">Aucun moment sélectionné.</p>}
      </Tile>
    </div>
  );
}

import Tile from "../charts/Tile.jsx";
import Funnel from "../charts/Funnel.jsx";
import HalvesDumbbell from "../charts/HalvesDumbbell.jsx";
import SetPieceButterfly from "../charts/SetPieceButterfly.jsx";
import ActionsByType from "../components/ActionsByType.jsx";
import AttackStyle from "../components/AttackStyle.jsx";
import { FUNNEL_CLIPS } from "../links.js";
import { dec, plural } from "../format.js";

// Attack and finishing.
export default function Attaque({ d, openClips }) {
  const r = d.report, h = r.headline, sp = r.set_pieces;
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <Tile className="lg:col-span-5" title="Où nos attaques s'arrêtent-elles ?" note="De l'action dangereuse au but, taux de passage entre étapes.">
        <Funnel stages={r.funnel} onSelect={(stage) => openClips({ cats: FUNNEL_CLIPS[stage] })} />
      </Tile>
      <Tile className="lg:col-span-7" title="Qu'est-ce qui a changé à la mi-temps ?" note="Chaque ligne sur sa propre échelle.">
        <HalvesDumbbell halves={r.halves} tempo={r.tempo} />
      </Tile>
      <Tile className="lg:col-span-4" title="Comment attaque-t-on ?" note={`${h.dangerous_actions} actions dangereuses · ${dec(h.actions_per_shot)} par tir.`}>
        <ActionsByType rows={r.actions_by_type} />
      </Tile>
      <Tile className="lg:col-span-4" title="Vertical ou latéral ?" note="Passes en profondeur + conduites contre changements de jeu + centres.">
        <AttackStyle s={r.attack_style} />
      </Tile>
      <Tile className="lg:col-span-4" title="Qui a gagné les coups de pied arrêtés ?"
        note={`Issus de nos CPA (≤ 20 s, sans perte) : ${plural(sp.shots_from_set_piece, "tir")}, ${plural(sp.goals_from_set_piece, "but")} · encaissés : ${sp.conceded_from_set_pieces}.`}
        aside={<div className="flex shrink-0 gap-2 text-[11px] font-semibold text-gold-deep">
          <button type="button" onClick={() => openClips({ cats: ["set_piece_us"] })} className="hover:text-ink">nos CPA</button>
          <button type="button" onClick={() => openClips({ cats: ["set_piece_them"] })} className="hover:text-ink">les leurs</button></div>}>
        <SetPieceButterfly counts={sp.counts} />
      </Tile>
    </div>
  );
}

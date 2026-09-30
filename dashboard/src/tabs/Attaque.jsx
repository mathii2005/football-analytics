import Section from "../components/Section.jsx";
import ShotFunnel from "../components/ShotFunnel.jsx";
import ActionsByType from "../components/ActionsByType.jsx";
import HBars from "../components/HBars.jsx";
import AttackStyle from "../components/AttackStyle.jsx";
import TempoTable from "../components/TempoTable.jsx";
import HalvesTable from "../components/HalvesTable.jsx";
import SetPieces from "../components/SetPieces.jsx";
import { dec } from "../format.js";
import { FUNNEL_CLIPS } from "../links.js";

// Attack and finishing: the old staff views, plus halves side by side.
export default function Attaque({ d, openClips }) {
  const r = d.report, h = r.headline;
  return (
    <div className="space-y-10">
      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Entonnoir des tirs" note="De l'action dangereuse au but, avec le taux de passage.">
          <ShotFunnel stages={r.funnel} onSelect={(stage) => openClips({ cats: FUNNEL_CLIPS[stage] })} />
        </Section>
        <Section title="Actions par type" note={`${h.dangerous_actions} actions dangereuses · ${dec(h.actions_per_shot)} par tir.`}>
          <ActionsByType rows={r.actions_by_type} />
        </Section>
      </div>
      <div className="grid gap-10 lg:grid-cols-3">
        <Section title="Entrées surface" note="Par type d'action.">
          <HBars rows={r.box_entries_by_type.map((b) => ({ label: b.label, value: b.n }))} labelWidth="8.5rem" />
        </Section>
        <Section title="Style d'attaque">
          <AttackStyle s={r.attack_style} />
        </Section>
        <Section title="Tempo par mi-temps" note="Actions par tir bas = plus clinique.">
          <TempoTable rows={r.tempo} />
        </Section>
      </div>
      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Mi-temps contre mi-temps" note="En or : la meilleure mi-temps quand l'écart est net.">
          <HalvesTable halves={r.halves} />
        </Section>
        <Section title="Coups de pied arrêtés">
          <SetPieces sp={r.set_pieces} onSelect={(team) => openClips({ cats: [team === "us" ? "set_piece_us" : "set_piece_them"] })} />
        </Section>
      </div>
    </div>
  );
}

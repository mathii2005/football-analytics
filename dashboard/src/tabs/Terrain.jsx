import Section from "../components/Section.jsx";
import PitchBalance from "../components/PitchBalance.jsx";
import PitchOrigins from "../components/PitchOrigins.jsx";
import CouloirOrigins from "../components/CouloirOrigins.jsx";
import ArrivalZones from "../components/ArrivalZones.jsx";
import HBars from "../components/HBars.jsx";
import CouloirTable from "../components/CouloirTable.jsx";
import { ZONE_LABELS, pct } from "../format.js";

// The match on the pitch: where we win and lose the ball, where we attack.
export default function Terrain({ d, openClips }) {
  const r = d.report;
  const order = ["BOX", "4", "3", "2", "1"];
  const zone = (k) => r.zones.find((z) => z.zone === k);
  return (
    <div className="space-y-10">
      <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
        <Section title="Bilan territorial" note="Récupérations − pertes par zone, attaque vers le haut. Or : on domine la zone ; gris : on la subit.">
          <PitchBalance zones={r.zones} onZone={(zone) => openClips({ zone, cats: ["loss", "recup"] })} />
        </Section>
        <Section title="Où on a attaqué" note="Actions dangereuses : couloir × zone d'arrivée, attaque vers le haut, surface nichée dans la Z4.">
          <PitchOrigins grid={r.attack_origins} />
        </Section>
        <Section title="Origine par couloir" note="D'où part l'action dangereuse, par type.">
          <CouloirOrigins rows={r.couloir_origins} />
        </Section>
      </div>
      <div className="grid gap-10 lg:grid-cols-3">
        <Section title="Contrôle des zones" note="Récup / (récup + perte).">
          <HBars rows={order.filter((k) => zone(k).recups + zone(k).losses > 0).map((k) => ({
            label: ZONE_LABELS[k], value: zone(k).control, display: pct(zone(k).control), highlight: zone(k).control >= 0.5,
            onSelect: () => openClips({ zone: k, cats: ["loss", "recup"] }) }))}
            max={1} labelWidth="5rem" />
        </Section>
        <Section title="Hauteur de récupération" note="Récupérations par zone.">
          <HBars rows={r.recovery_distribution.slice().reverse().map((z) => ({ label: ZONE_LABELS[z.zone], value: z.n,
            onSelect: z.n ? () => openClips({ zone: z.zone, cats: ["recup"] }) : undefined }))} labelWidth="5rem" />
        </Section>
        <Section title="Pertes par zone" note="Où on rend le ballon.">
          <HBars rows={order.map((k) => ({ label: ZONE_LABELS[k], value: zone(k).losses,
            onSelect: zone(k).losses ? () => openClips({ zone: k, cats: ["loss"] }) : undefined }))} labelWidth="5rem" />
        </Section>
      </div>
      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Actions × zone d'arrivée">
          <ArrivalZones rows={r.actions_by_arrival_zone} />
        </Section>
        <Section title="Valeur par couloir" note="Part des possessions passées par un couloir qui atteignent la surface ou finissent par un tir.">
          <CouloirTable couloirs={r.metrics.couloirs} />
        </Section>
      </div>
    </div>
  );
}

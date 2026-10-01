import Tile from "../charts/Tile.jsx";
import CouloirPitch from "../charts/CouloirPitch.jsx";
import ZoneGridPitch from "../charts/ZoneGridPitch.jsx";
import BandPitch from "../charts/BandPitch.jsx";
import { goldRamp, blueRamp, diverging } from "../charts/palette.js";
import CouloirTable from "../components/CouloirTable.jsx";
import { pct, signed } from "../format.js";

// The match on the pitch, at the data's true resolution (4 zones, 3 couloirs).
export default function Terrain({ d, openClips }) {
  const r = d.report;
  const zones = r.zones;
  const maxR = Math.max(1, ...zones.map((z) => z.recups));
  const maxL = Math.max(1, ...zones.map((z) => z.losses));
  const maxB = Math.max(1, ...zones.map((z) => Math.abs(z.balance)));
  const rec = zones.map((z) => ({ zone: z.zone, t: z.recups / maxR, big: z.recups, small: "récupérations" }));
  const los = zones.map((z) => ({ zone: z.zone, t: z.losses / maxL, big: z.losses, small: "pertes" }));
  const bal = zones.map((z) => ({ zone: z.zone, t: z.balance / maxB, big: signed(z.balance),
    small: z.recups + z.losses ? `contrôle ${pct(z.control)}` : "" }));
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-12">
      <Tile className="lg:col-span-4" title="Par quel couloir attaque-t-on ?" note="Part des actions dangereuses par couloir ; la flèche grossit avec l'utilisation.">
        <CouloirPitch rows={r.couloir_origins} />
      </Tile>
      <Tile className="lg:col-span-4" title="Où arrivent nos actions dangereuses ?" note="Couloir × zone d'arrivée, surface nichée dans la zone 4.">
        <ZoneGridPitch grid={r.attack_origins} />
      </Tile>
      <Tile className="lg:col-span-4" title="Les couloirs mènent-ils au danger ?" note="Possessions passées par chaque couloir : part qui atteint la surface, part avec tir. Petits échantillons.">
        <CouloirTable couloirs={r.metrics.couloirs} />
      </Tile>
      <Tile className="lg:col-span-4" title="Où récupère-t-on le ballon ?" note={`Hauteur de récupération ${r.headline.recovery_height?.toFixed(1).replace(".", ",") ?? "–"} / 5. Cliquer une zone pour les clips.`}>
        <BandPitch rows={rec} color={goldRamp} label="Récupérations par zone" onZone={(zone) => openClips({ zone, cats: ["recup"] })} />
      </Tile>
      <Tile className="lg:col-span-4" title="Où perd-on le ballon ?" note="Cliquer une zone pour voir ces pertes.">
        <BandPitch rows={los} color={blueRamp} label="Pertes par zone" onZone={(zone) => openClips({ zone, cats: ["loss"] })} />
      </Tile>
      <Tile className="lg:col-span-4" title="Qui domine chaque zone ?" note="Récupérations − pertes. Or : on gagne la zone ; bleu : on la perd. Contrôle = récup / (récup + perte).">
        <BandPitch rows={bal} color={diverging} label="Bilan territorial" onZone={(zone) => openClips({ zone, cats: ["loss", "recup"] })} />
      </Tile>
    </div>
  );
}

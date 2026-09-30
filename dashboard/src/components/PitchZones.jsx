import { ZONE_LABELS, signed } from "../format.js";

// Zones from their box (top) to ours, attack upward. Each zone: losses to
// the left (grey), recoveries to the right (ink), balance (recoveries −
// losses) at the edge with an explicit sign. Gold is not used: it means
// "good" elsewhere on the page.
const ORDER = ["BOX", "4", "3", "2", "1"];

export default function PitchZones({ zones }) {
  const byZone = Object.fromEntries(zones.map((z) => [z.zone, z]));
  const empty = { recups: 0, losses: 0, balance: 0 };
  const max = Math.max(1, ...zones.flatMap((z) => [z.recups, z.losses]));
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3">
      <div>
        {ORDER.map((k) => {
          const z = byZone[k] ?? empty;
          return (
            <div key={k} className="grid h-12 grid-cols-[4.5rem_1fr_1fr_3rem] items-center gap-2 border-t border-rule first:border-t-0">
              <span className="text-xs font-medium uppercase tracking-wider text-ink-3">{ZONE_LABELS[k]}</span>
              <div className="flex justify-end">
                <div className="h-3 rounded-l-sm bg-them" style={{ width: `${(z.losses / max) * 100}%` }} title={`${z.losses} pertes`} />
              </div>
              <div className="flex border-l border-ink/60">
                <div className="h-3 rounded-r-sm bg-ink" style={{ width: `${(z.recups / max) * 100}%` }} title={`${z.recups} récupérations`} />
              </div>
              <span className={`display text-right text-xl font-semibold tabular ${z.balance === 0 ? "text-ink-3" : "text-ink"}`}>
                {signed(z.balance)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex rotate-180 flex-col items-center justify-center gap-2 text-[11px] uppercase tracking-wider text-ink-3 [writing-mode:vertical-rl]">
        Sens de l'attaque
        <svg width="12" height="40" viewBox="0 0 12 40" className="rotate-180" aria-hidden="true"><path d="M6 39V2M1 7l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </div>
      <div className="col-span-2 flex flex-wrap gap-x-5 gap-y-1 border-t border-rule pt-3 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-them" />Pertes</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-ink" />Récupérations</span>
        <span>Bilan = récupérations − pertes</span>
      </div>
    </div>
  );
}

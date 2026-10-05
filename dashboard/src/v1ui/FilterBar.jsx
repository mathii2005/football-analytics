// Filters of the v1 pages, one row above the tiles (sticky):
// half -> every metric recomputed on that half; opponent tier and venue -> the
// season view and the reference statuses.
const Seg = ({ value, options, onChange, label }) => (
  <div className="flex items-center gap-1.5">
    <span className="text-[11px] uppercase tracking-wider text-ink-3">{label}</span>
    <div className="flex overflow-hidden rounded border border-rule">
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)}
          className={`px-2.5 py-1 text-[12px] font-medium ${value === v ? "bg-ink text-paper" : "bg-paper text-ink-2 hover:bg-paper-2"}`}>{l}</button>
      ))}
    </div>
  </div>
);

export default function FilterBar({ half, setHalf, tier, setTier, venue, setVenue, nSeason }) {
  return (
    <div className="z-30 border-b border-rule bg-paper/95 backdrop-blur sm:sticky sm:top-0">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2 sm:px-5">
        <Seg label="Mi-temps" value={half} onChange={setHalf} options={[[null, "Tout"], [1, "MT1"], [2, "MT2"]]} />
        <Seg label="Adversaire" value={tier} onChange={setTier} options={[[null, "Tous"], ["top", "Haut"], ["mid", "Milieu"], ["bottom", "Bas"]]} />
        <Seg label="Lieu" value={venue} onChange={setVenue} options={[[null, "Tous"], ["home", "Domicile"], ["away", "Extérieur"]]} />
        <span className="text-[11px] text-ink-3">{half ? `Chiffres de la MT${half} seulement · ` : ""}Saison : {nSeason ?? 0} match{(nSeason ?? 0) > 1 ? "s" : ""} v1{tier || venue ? " (filtrés)" : ""}</span>
      </div>
    </div>
  );
}

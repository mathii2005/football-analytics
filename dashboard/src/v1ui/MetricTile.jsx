import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import Tile from "../charts/Tile.jsx";
import { subline, toCsv } from "./format.js";
import { SNAPSHOT } from "../snapshot.js";

// A tile bound to one metric: question as title, n / coverage / status as the
// note, and a menu: clips, definition, CSV.
export default function MetricTile({ title, metric, openClips, className, children, note }) {
  const [menu, setMenu] = useState(false);
  const [def, setDef] = useState(false);
  const csv = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toCsv(metric)], { type: "text/csv" }));
    a.download = `${metric.id}.csv`; a.click();
  };
  const aside = metric && (
    <div className="relative">
      <button type="button" aria-label="Options" onClick={() => setMenu((m) => !m)} className="rounded p-0.5 text-ink-3 hover:bg-paper-2 hover:text-ink">
        <MoreHorizontal size={16} />
      </button>
      {menu && (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-sm border border-rule bg-paper py-1 text-[12px] shadow-[0_6px_20px_rgba(10,10,10,0.10)]" onMouseLeave={() => setMenu(false)}>
          <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-paper-2" disabled={!metric.clips?.all?.length}
            onClick={() => { setMenu(false); openClips(metric); }}>Voir les clips ({metric.clips?.all?.length ?? 0})</button>
          <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-paper-2" onClick={() => { setMenu(false); setDef((d) => !d); }}>Définition</button>
          {!SNAPSHOT && <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-paper-2" onClick={() => { setMenu(false); csv(); }}>Exporter CSV</button>}
        </div>
      )}
    </div>
  );
  return (
    <Tile className={className} title={title} note={note ?? (metric ? subline(metric) : undefined)} aside={aside}>
      {def && metric && <p className="mb-2 rounded-sm bg-paper-2 px-2 py-1.5 text-[11px] text-ink-2">{metric.label_fr} · {metric.unit} · min. n {metric.min_n} · {metric.label}</p>}
      {children}
    </Tile>
  );
}

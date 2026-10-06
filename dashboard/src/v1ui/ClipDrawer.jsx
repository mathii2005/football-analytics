import { useEffect } from "react";
import { X, Play } from "lucide-react";
import { clock } from "../format.js";
import { SHOW_VEO } from "../veo.js";

// Right-hand drawer: the moments behind a number. Typical first, then extreme
// (one lucky moment must not look like a pattern), then all of them.
function Row({ c }) {
  return (
    <li className="flex items-center justify-between gap-2 border-b border-rule py-1.5 text-[13px]">
      <span className="tabular text-ink-2">MT{c.half} · {clock(c.t)} <span className="text-ink">{c.what}</span></span>
      {c.url ? <a href={c.url} target="veo" rel="noreferrer" className="inline-flex items-center gap-1 rounded bg-gold px-2 py-0.5 text-[12px] font-semibold text-ink hover:bg-gold-lift"><Play size={12} /> Veo</a>
        : SHOW_VEO && <span className="text-[11px] text-ink-3">pas de lien Veo</span>}
    </li>
  );
}

export default function ClipDrawer({ metric, onClose }) {
  useEffect(() => {
    if (!metric) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [metric, onClose]);
  if (!metric) return null;
  const c = metric.clips || { typical: [], extreme: [], all: [] };
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" onClick={onClose}>
      <aside className="h-full w-[min(26rem,100vw)] overflow-y-auto bg-paper p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div><div className="text-[11px] uppercase tracking-wider text-ink-3">Clips</div><h2 className="text-base font-semibold">{metric.label_fr}</h2></div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="rounded p-1 hover:bg-paper-2"><X size={18} /></button>
        </div>
        <h3 className="mt-4 text-[12px] font-semibold uppercase tracking-wider text-ink-3">{c.mode === "weighted" ? "3 typiques" : "Échantillon réparti dans le match"}</h3>
        <ul>{c.typical.map((x) => <Row key={`t${x.half}${x.t}`} c={x} />)}</ul>
        {c.mode === "weighted" && <>
          <h3 className="mt-4 text-[12px] font-semibold uppercase tracking-wider text-ink-3">3 extrêmes</h3>
          <ul>{c.extreme.map((x) => <Row key={`e${x.half}${x.t}`} c={x} />)}</ul>
        </>}
        <h3 className="mt-4 text-[12px] font-semibold uppercase tracking-wider text-ink-3">Tous ({c.all.length})</h3>
        <ul>{c.all.map((x) => <Row key={`a${x.half}${x.t}`} c={x} />)}</ul>
      </aside>
    </div>
  );
}

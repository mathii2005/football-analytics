import { useEffect, useRef, useState } from "react";
import { searchRoster, playerLabel } from "../core/roster.js";

// « Qui ? »: type a number or part of a name, Entrée picks the first match.
// A number missing from the squad is accepted as is (#23).
export default function PlayerPicker({ roster, value, allowNone, active, onPick, labels }) {
  const [q, setQ] = useState("");
  const input = useRef(null);
  useEffect(() => { if (active) input.current?.focus(); else setQ(""); }, [active]);
  const hits = searchRoster(roster, q).slice(0, 8);
  const pick = (v) => { setQ(""); onPick(v); };
  const onKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (hits[0]) pick(hits[0].num);
      else if (/^\d{1,3}$/.test(q.trim())) pick(q.trim());
    }
    if (e.key === "Escape") { e.preventDefault(); input.current?.blur(); }
  };
  const shown = value === "NONE" ? labels.none : value === "CANT_SEE" ? labels.cantSee : value ? playerLabel(roster, value) : null;
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} className="field mt-0 w-56" placeholder={roster.length ? "Numéro ou nom…" : "Numéro (effectif vide)"} value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
        {allowNone && <button className={`btn ${value === "NONE" ? "btn-primary" : ""}`} onClick={(e) => { e.stopPropagation(); pick("NONE"); }}>{labels.none}</button>}
        <button className={`btn ${value === "CANT_SEE" ? "btn-primary" : ""}`} onClick={(e) => { e.stopPropagation(); pick("CANT_SEE"); }}>{labels.cantSee}</button>
        {shown && <span className="rounded bg-paper-2 px-2 py-1 text-sm font-semibold">{shown}</span>}
      </div>
      {q && (
        <div className="mt-2 flex flex-wrap gap-1">
          {hits.map((p, i) => (
            <button key={p.num} className={`btn ${i === 0 ? "border-ink" : ""}`} onClick={(e) => { e.stopPropagation(); pick(p.num); }}>#{p.num} {p.name}</button>
          ))}
          {!hits.length && /^\d{1,3}$/.test(q.trim()) && <button className="btn" onClick={(e) => { e.stopPropagation(); pick(q.trim()); }}>#{q.trim()} (hors effectif)</button>}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { fmtClock } from "../core/clock.js";
import { parseMmSs } from "../ui/util.js";

// The whole log, newest first, scrollable. Clicking a line opens an editor;
// saving appends a retraction + corrected line (session.editOps).
const VALUES = {
  S: [["US", "Notre ballon"], ["THEM", "Leur ballon"], ["DEAD", "Ballon mort"]],
  Z: [0, 1, 2, 3, 4, 5].map((n) => [n, `Zone ${n}`]),
  R: [["THROW", "Touche"], ["CORNER", "Corner"], ["FK", "Coup franc"], ["GK", "Dégagement"], ["PEN", "Penalty"]],
  SH: [["OFF", "Non cadré"], ["ON", "Cadré"], ["GOAL", "But"]],
};

function Editor({ entry, onSave, onDelete, onRestore, onClose }) {
  const [v, setV] = useState(entry.v);
  const [t, setT] = useState(entry.t);
  const [txt, setTxt] = useState(fmtClock(entry.t));
  const [err, setErr] = useState(null);
  const shift = (d) => { const n = Math.max(0, t + d); setT(n); setTxt(fmtClock(n)); };
  const typed = (s) => { setTxt(s); const ms = parseMmSs(s); if (ms !== null) { setT(ms); setErr(null); } else setErr("mm:ss"); };
  const changed = v !== entry.v || t !== entry.t;
  return (
    <div className="mt-1 space-y-2 rounded border border-ink/20 bg-paper-2 p-2" onClick={(e) => e.stopPropagation()}>
      {VALUES[entry.k] && (
        <div className="flex flex-wrap gap-1">
          {VALUES[entry.k].map(([val, label]) => (
            <button key={val} className={`btn ${v === val ? "btn-primary" : ""}`} onClick={() => setV(val)}>{label}</button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <span className="label mr-1">Temps</span>
        <button className="btn" onClick={() => shift(-5000)}>−5s</button>
        <button className="btn" onClick={() => shift(-1000)}>−1s</button>
        <input className="field mt-0 w-20 text-center tabular-nums" value={txt} onChange={(e) => typed(e.target.value)} />
        <button className="btn" onClick={() => shift(1000)}>+1s</button>
        <button className="btn" onClick={() => shift(5000)}>+5s</button>
        {err && <span className="text-xs text-warn">{err}</span>}
      </div>
      <div className="flex flex-wrap gap-1">
        {entry.retracted
          ? <button className="btn btn-primary" onClick={onRestore}>Restaurer</button>
          : <button className="btn btn-primary" disabled={!changed || err} onClick={() => onSave({ v, t })}>Enregistrer</button>}
        {!entry.retracted && <button className="btn text-warn" onClick={onDelete}>Supprimer</button>}
        <button className="btn" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

export default function Journal({ entries, onEdit }) {
  const [open, setOpen] = useState(null);
  const run = (change) => { const r = onEdit(open, change); if (!r?.error) setOpen(null); };
  return (
    <div className="flex min-h-0 flex-col rounded border border-rule bg-paper p-3">
      <div className="flex items-baseline justify-between">
        <div className="label">Journal ({entries.filter((e) => !e.retracted).length})</div>
        <div className="text-xs text-ink-3">Cliquer une ligne pour la modifier</div>
      </div>
      <ul className="mt-2 max-h-[38vh] min-h-[8rem] overflow-y-auto pr-1 text-sm">
        {entries.map((e) => (
          <li key={e.seq} className={`cursor-pointer rounded px-1 py-0.5 hover:bg-paper-2 ${open === e.seq ? "bg-paper-2" : ""}`}
              onClick={() => setOpen(open === e.seq ? null : e.seq)}>
            <div className={`flex justify-between ${e.retracted ? "text-ink-3 line-through" : ""}`}>
              <span>{e.label}{e.edited && <span className="ml-2 text-xs text-us-deep no-underline">modifié</span>}</span>
              <span className="tabular-nums text-ink-3">MT{e.half} · {fmtClock(e.t)}</span>
            </div>
            {open === e.seq && (
              <Editor entry={e} onClose={() => setOpen(null)} onSave={(c) => run(c)}
                onDelete={() => run({ delete: true })} onRestore={() => run({ restore: true })} />
            )}
          </li>
        ))}
        {!entries.length && <li className="text-ink-3">Espace pour lancer le chrono, puis Q / W / E. <kbd>?</kbd> pour l'aide.</li>}
      </ul>
    </div>
  );
}

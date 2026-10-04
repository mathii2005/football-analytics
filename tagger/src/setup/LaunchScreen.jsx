import { useEffect, useRef, useState } from "react";
import { parseImport, buildBundle, bundleFileName } from "../core/bundle.js";
import { newClock } from "../core/clock.js";
import { download } from "../ui/util.js";

export default function LaunchScreen({ store, onNew, onOpen, onReview }) {
  const [matches, setMatches] = useState([]);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);
  useEffect(() => { store.listMatches().then(setMatches); }, [store]);

  const load = async (id) => {
    const m = await store.loadMatch(id);
    return m && { meta: m.meta, ops: m.ops, reviewed: m.reviewed || [], clock: m.clock || newClock() };
  };
  const resume = async (id) => { const m = await load(id); if (m) onOpen(m); };
  const review = async (id) => { const m = await load(id); if (m) onReview(m); };
  const exportOne = async (id) => {
    const m = await store.loadMatch(id);
    if (m) download(bundleFileName(m.meta), buildBundle(m.meta, m.ops, m.reviewed || []));
  };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = parseImport(await file.text());
    e.target.value = "";
    if (r.kind === "v1") {
      await store.saveMatch(r.meta, r.events, r.reviewed, null);
      onOpen({ meta: r.meta, ops: r.events, reviewed: r.reviewed, clock: newClock() });
    } else if (r.kind === "v0") {
      setMsg("Export de l'ancien tagger (v0) : il se lit dans le tableau de bord, pas ici.");
    } else setMsg(r.error);
  };

  const last = matches[0];
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Lauréats · Tagger</h1>
      <p className="mt-1 text-sm text-ink-3">Reprendre ou nouveau ?{store.ok ? "" : " · Stockage indisponible : exporte souvent."}</p>
      {last && (
        <section className="mt-8 rounded border border-rule bg-paper p-4">
          <div className="label">Dernière session</div>
          <div className="mt-1 text-lg font-medium">{last.opponent || "—"} · {last.date || "—"}</div>
          <div className="text-sm text-ink-3">{last.n} entrées · sauvegardé {new Date(last.savedAt).toLocaleString("fr-CA")}</div>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" onClick={() => resume(last.id)}>Reprendre</button>
            <button className="btn" onClick={() => review(last.id)}>Revue (passe 2)</button>
          </div>
        </section>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={onNew}>Nouveau match</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>↑ Importer un export (JSON)</button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
      </div>
      {msg && <p className="mt-3 text-sm text-warn">{msg}</p>}
      {matches.length > 1 && (
        <section className="mt-10">
          <div className="label">Matchs enregistrés</div>
          <ul className="mt-2 divide-y divide-rule rounded border border-rule bg-paper">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{m.date} · {m.opponent} <span className="text-ink-3">({m.n})</span></span>
                <span className="flex gap-2">
                  <button className="btn" onClick={() => resume(m.id)}>Reprendre</button>
                  <button className="btn" onClick={() => review(m.id)}>Revue</button>
                  <button className="btn" onClick={() => exportOne(m.id)}>Exporter</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

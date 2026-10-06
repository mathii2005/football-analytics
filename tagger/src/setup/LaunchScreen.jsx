import { useEffect, useRef, useState } from "react";
import { parseRoster, rosterText, loadRoster, saveRoster } from "../core/roster.js";
import { parseImport, buildBundle, bundleFileName, mergeExports, defaultPick, halfStats } from "../core/bundle.js";
import { download } from "../ui/util.js";

// "Reprendre ou nouveau ?": resume, review, import (live or straight to the
// review). Importing a match that already exists asks what to do instead of
// silently replacing it.
// The squad: pasted once, kept on this computer, used by the review to answer « qui ? »
function RosterEditor() {
  const [text, setText] = useState(() => rosterText(loadRoster()));
  const [saved, setSaved] = useState(null);
  const parsed = parseRoster(text);
  const save = () => { saveRoster(parsed); setText(rosterText(parsed)); setSaved(`${parsed.length} joueurs enregistrés`); };
  return (
    <section className="mt-10">
      <div className="label">Effectif</div>
      <p className="mt-1 text-xs text-ink-3">Un joueur par ligne, numéro d'abord (ex. « 10 Léo Tremblay »). Gardé sur cet ordinateur seulement.</p>
      <textarea className="field mt-2 h-40 font-mono text-sm" value={text} onChange={(e) => { setText(e.target.value); setSaved(null); }} />
      <div className="mt-2 flex items-center gap-3">
        <button className="btn" onClick={save}>Enregistrer l'effectif</button>
        <span className="text-sm text-ink-3">{saved ?? `${parsed.length} joueurs reconnus`}</span>
      </div>
    </section>
  );
}

function ImportDialog({ existing, incoming, onDone, onCancel }) {
  const [pick, setPick] = useState(defaultPick(existing, incoming));
  const se = halfStats(existing), si = halfStats(incoming);
  const Opt = ({ half, side, n }) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="radio" name={`h${half}`} checked={pick[half] === side} onChange={() => setPick({ ...pick, [half]: side })} />
      {side === "a" ? "Version enregistrée" : "Fichier importé"} · {n} entrées
    </label>
  );
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/50">
      <div className="w-[min(560px,94vw)] rounded bg-paper p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Ce match existe déjà dans le tagger</h2>
        <p className="mt-1 text-sm text-ink-3">{incoming.meta.opponent} · {incoming.meta.date}. Choisis quelle version garder pour chaque mi-temps (par défaut : la plus complète).</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {[1, 2].map((h) => (
            <div key={h} className="rounded border border-rule p-3">
              <div className="label">MT{h}</div>
              <Opt half={h} side="a" n={se[h]} />
              <Opt half={h} side="b" n={si[h]} />
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => onDone("merge", pick)}>Fusionner</button>
          <button className="btn" onClick={() => { if (window.confirm("Remplacer la version enregistrée par le fichier importé ?")) onDone("replace"); }}>Remplacer</button>
          <button className="btn" onClick={() => onDone("copy")}>Importer comme copie</button>
          <button className="btn" onClick={onCancel}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

export default function LaunchScreen({ store, onNew, onOpenStored }) {
  const [matches, setMatches] = useState([]);
  const [msg, setMsg] = useState(null);
  const [dialog, setDialog] = useState(null);       // {existing, incoming, target}
  const fileRef = useRef(null);
  const target = useRef("live");
  useEffect(() => { store.listMatches().then(setMatches); }, [store]);

  const exportOne = async (id) => {
    const m = await store.loadMatch(id);
    if (m) download(bundleFileName(m.meta), buildBundle(m.meta, m.ops, m.reviewed || []));
  };
  const saveAndOpen = async (meta, events, reviewed, to, force = true) => {
    const current = await store.loadMatch(meta.id);
    await store.saveMatch(meta, events, reviewed, current?.clock ?? null, force ? undefined : current?.rev);
    onOpenStored(meta.id, to);
  };
  const pickFile = (to) => { target.current = to; fileRef.current?.click(); };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    const r = parseImport(await file.text());
    e.target.value = "";
    if (r.kind === "v0") return setMsg("Export de l'ancien tagger (v0) : il se lit dans le tableau de bord. La revue (passe 2) a besoin d'un match tagué avec ce tagger.");
    if (r.kind !== "v1") return setMsg(r.error);
    const incoming = { meta: r.meta, events: r.events, reviewed: r.reviewed };
    const stored = await store.loadMatch(r.meta.id);
    if (!stored) return saveAndOpen(r.meta, r.events, r.reviewed, target.current);
    setDialog({ existing: { meta: stored.meta, events: stored.ops, reviewed: stored.reviewed || [] }, incoming, to: target.current });
  };
  const resolve = async (choice, pick) => {
    const { existing, incoming, to } = dialog;
    setDialog(null);
    if (choice === "merge") {
      const m = mergeExports(existing, incoming, pick);
      return saveAndOpen(m.meta, m.events, m.reviewed, to);
    }
    if (choice === "replace") return saveAndOpen(incoming.meta, incoming.events, incoming.reviewed, to);
    let n = 2;
    while (matches.some((x) => x.id === `${incoming.meta.id}_copie${n}`)) n++;
    const meta = { ...incoming.meta, id: `${incoming.meta.id}_copie${n}`, opponent: `${incoming.meta.opponent} (copie ${n})` };
    return saveAndOpen(meta, incoming.events, incoming.reviewed, to);
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
            <button className="btn btn-primary" onClick={() => onOpenStored(last.id, "live")}>Reprendre</button>
            <button className="btn" onClick={() => onOpenStored(last.id, "review")}>Revue (passe 2)</button>
          </div>
        </section>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={onNew}>Nouveau match</button>
        <button className="btn" onClick={() => pickFile("live")}>↑ Importer un match</button>
        <button className="btn" onClick={() => pickFile("review")}>↑ Importer pour la revue (passe 2)</button>
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
                  <button className="btn" onClick={() => onOpenStored(m.id, "live")}>Reprendre</button>
                  <button className="btn" onClick={() => onOpenStored(m.id, "review")}>Revue</button>
                  <button className="btn" onClick={() => exportOne(m.id)}>Exporter</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <RosterEditor />
      {dialog && <ImportDialog existing={dialog.existing} incoming={dialog.incoming} onDone={resolve} onCancel={() => setDialog(null)} />}
    </main>
  );
}

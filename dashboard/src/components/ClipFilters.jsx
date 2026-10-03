// Filter row for the clip library. All state lives in ClipsView.
const selectCls = "rounded border border-rule bg-paper px-2.5 py-1.5 text-sm text-ink";

export default function ClipFilters({ categories, f, set, reset }) {
  const toggle = (k) => set({ ...f, cats: f.cats.includes(k) ? f.cats.filter((c) => c !== k) : [...f.cats, k] });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Catégories">
        {categories.map((c) => {
          const on = f.cats.includes(c.key);
          return (
            <button key={c.key} type="button" aria-pressed={on} onClick={() => toggle(c.key)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "border-ink bg-ink text-paper" : "border-rule text-ink-2 hover:border-ink-3"}`}>
              {c.label} <span className={on ? "text-paper/70" : "text-ink-3"}>{c.n}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select aria-label="Mi-temps" className={selectCls} value={f.half} onChange={(e) => set({ ...f, half: e.target.value })}>
          <option value="">Toute la rencontre</option><option value="1">1re mi-temps</option><option value="2">2e mi-temps</option>
        </select>
        <select aria-label="Zone" className={selectCls} value={f.zone} onChange={(e) => set({ ...f, zone: e.target.value })}>
          <option value="">Toutes les zones</option><option value="1">Zone 1</option><option value="2">Zone 2</option>
          <option value="3">Zone 3</option><option value="4">Zone 4</option><option value="BOX">Surface</option>
        </select>
        <select aria-label="Score" className={selectCls} value={f.state} onChange={(e) => set({ ...f, state: e.target.value })}>
          <option value="">Tout score</option><option value="menée">Menés</option><option value="égalité">À égalité</option><option value="en avance">En avance</option>
        </select>
        <select aria-label="Type" className={selectCls} value={f.tone} onChange={(e) => set({ ...f, tone: e.target.value })}>
          <option value="">Positif et à corriger</option><option value="pos">À répéter</option><option value="neg">À corriger</option>
        </select>
        <select aria-label="Tri" className={selectCls} value={f.sort} onChange={(e) => set({ ...f, sort: e.target.value })}>
          <option value="time">Ordre du match</option><option value="priority">Priorité</option>
        </select>
        <button type="button" onClick={reset} className="px-2 py-1.5 text-sm text-gold-deep hover:text-ink">Réinitialiser</button>
      </div>
    </div>
  );
}

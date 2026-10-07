import { useState } from "react";
import { CB_VERSION } from "../core/codebook.js";
import { parseMmSs, fmtMmSs, matchId, localDate } from "../ui/util.js";
import { loadRoster } from "../core/roster.js";
import { checkLineup, subFromForm } from "../core/lineup.js";

// Starters and substitutions: they give each player's minutes played.
function LineupEditor({ roster, lineup, setLineup }) {
  const [form, setForm] = useState({ in: "", out: "", half: 2, at: "" });
  const [err, setErr] = useState(null);
  const starters = new Set(lineup.starters);
  const name = (n) => roster.find((p) => p.num === n)?.name ?? "";
  const toggle = (n) => setLineup({ ...lineup, starters: starters.has(n) ? lineup.starters.filter((x) => x !== n) : [...lineup.starters, n] });
  const addSub = () => {
    const s = subFromForm(form);
    if (s.error) return setErr(s.error);
    setErr(null); setLineup({ ...lineup, subs: [...lineup.subs, s] }); setForm({ ...form, in: "", out: "", at: "" });
  };
  const problems = checkLineup(lineup);
  if (!roster.length) return <p className="col-span-2 text-sm text-ink-3">Ajoute l'effectif sur l'écran d'accueil pour choisir la composition.</p>;
  const opts = roster.map((p) => <option key={p.num} value={p.num}>#{p.num} {p.name}</option>);
  return (
    <div className="col-span-2 space-y-3 rounded border border-rule p-3">
      <div className="label">Titulaires ({lineup.starters.length}/11)</div>
      <div className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
        {roster.map((p) => (
          <label key={p.num} className="flex items-center gap-1"><input type="checkbox" checked={starters.has(p.num)} onChange={() => toggle(p.num)} /> #{p.num} {p.name}</label>
        ))}
      </div>
      <div className="label">Changements</div>
      <ul className="text-sm">{lineup.subs.map((s, i) => (
        <li key={i} className="flex items-center justify-between">
          <span>MT{s.half} · {fmtMmSs(s.t)} · entre #{s.in} {name(s.in)} · sort #{s.out} {name(s.out)}</span>
          <button type="button" className="btn" onClick={() => setLineup({ ...lineup, subs: lineup.subs.filter((_, j) => j !== i) })}>Retirer</button>
        </li>
      ))}</ul>
      <div className="flex flex-wrap items-center gap-2">
        <select className="field mt-0 w-44" value={form.in} onChange={(e) => setForm({ ...form, in: e.target.value })}><option value="">Entre…</option>{opts}</select>
        <select className="field mt-0 w-44" value={form.out} onChange={(e) => setForm({ ...form, out: e.target.value })}><option value="">Sort…</option>{opts}</select>
        <select className="field mt-0 w-20" value={form.half} onChange={(e) => setForm({ ...form, half: Number(e.target.value) })}><option value={1}>MT1</option><option value={2}>MT2</option></select>
        <input className="field mt-0 w-24 text-center" placeholder="63:30" value={form.at} onChange={(e) => setForm({ ...form, at: e.target.value })} />
        <button type="button" className="btn" onClick={addSub}>Ajouter</button>
      </div>
      <p className="text-xs text-ink-3">Temps du match : la 2e mi-temps commence à 45:00.</p>
      {err && <p className="text-sm text-warn">{err}</p>}
      {problems.length > 0 && <ul className="text-xs text-warn">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
    </div>
  );
}

// Match sheet. Every field can be filled later (Veo offsets usually are).
export default function SetupScreen({ meta, onSave, onCancel }) {
  const m = meta || {};
  const [f, setF] = useState({
    opponent: m.opponent || "", date: m.date || localDate(), venue: m.venue || "home",
    opponent_tier: m.opponent_tier || "mid", veoUrl: m.veo?.url || "",
    off1: fmtMmSs(m.veo?.offset_h1_ms), off2: fmtMmSs(m.veo?.offset_h2_ms), flip: m.flip_from_h2 ?? true,
  });
  const [err, setErr] = useState(null);
  const [roster] = useState(() => (m.roster?.length ? m.roster : loadRoster()));
  const [lineup, setLineup] = useState(m.lineup || { starters: [], subs: [] });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const save = (e) => {
    e.preventDefault();
    const o1 = parseMmSs(f.off1), o2 = parseMmSs(f.off2);
    if ((f.off1 && o1 === null) || (f.off2 && o2 === null)) return setErr("Format des décalages : mm:ss (ex. 12:59).");
    const history = [...(m.history || [])];
    const veo = { url: f.veoUrl.trim(), offset_h1_ms: o1, offset_h2_ms: o2, checked: m.veo?.checked ?? false };
    if (meta && JSON.stringify(veo) !== JSON.stringify(m.veo)) history.push({ at: new Date().toISOString(), field: "veo", from: m.veo, to: veo });
    onSave({
      ...m, id: m.id || matchId(f.date, f.opponent), date: f.date, opponent: f.opponent.trim(), venue: f.venue,
      opponent_tier: f.opponent_tier, veo, flip_from_h2: f.flip, lineup, roster: roster.length ? roster : m.roster,
      codebook_version: m.codebook_version || CB_VERSION, tagger_version: "two-pass@1.0.0", history,
    });
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-xl font-semibold">Feuille de match</h1>
      <form className="mt-6 grid grid-cols-2 gap-4" onSubmit={save}>
        <label className="col-span-2"><span className="label">Adversaire</span><input className="field" value={f.opponent} onChange={set("opponent")} autoFocus /></label>
        <label><span className="label">Date</span><input type="date" className="field" value={f.date} onChange={set("date")} /></label>
        <label><span className="label">Lieu</span>
          <select className="field" value={f.venue} onChange={set("venue")}><option value="home">Domicile</option><option value="away">Extérieur</option></select></label>
        <label><span className="label">Niveau adverse</span>
          <select className="field" value={f.opponent_tier} onChange={set("opponent_tier")}><option value="top">Haut</option><option value="mid">Milieu</option><option value="bottom">Bas</option></select></label>
        <label className="col-span-2"><span className="label">Lien Veo</span><input className="field" value={f.veoUrl} onChange={set("veoUrl")} placeholder="https://app.veo.co/matches/…" /></label>
        <label><span className="label">Coup d'envoi MT1 dans Veo (mm:ss)</span><input className="field" value={f.off1} onChange={set("off1")} placeholder="12:59" /></label>
        <label><span className="label">Coup d'envoi MT2 dans Veo (mm:ss)</span><input className="field" value={f.off2} onChange={set("off2")} placeholder="70:13" /></label>
        <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.flip} onChange={set("flip")} /> Proposer d'inverser les zones à la mi-temps (le bouton Inverser marche dans les deux mi-temps : à activer quand on attaque de droite à gauche à l'écran)</label>
        <div className="col-span-2 mt-2 text-sm font-semibold">Composition</div>
        <LineupEditor roster={roster} lineup={lineup} setLineup={setLineup} />
        {err && <p className="col-span-2 text-sm text-warn">{err}</p>}
        <div className="col-span-2 flex gap-2">
          <button type="submit" className="btn btn-primary">{meta ? "Enregistrer" : "Commencer"}</button>
          <button type="button" className="btn" onClick={onCancel}>Annuler</button>
        </div>
        <p className="col-span-2 text-xs text-ink-3">Les décalages Veo peuvent être ajoutés après le match.</p>
      </form>
    </main>
  );
}

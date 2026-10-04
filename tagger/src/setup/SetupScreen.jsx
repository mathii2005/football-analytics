import { useState } from "react";
import { CB_VERSION } from "../core/codebook.js";
import { parseMmSs, fmtMmSs, matchId, localDate } from "../ui/util.js";

// Match sheet. Every field can be filled later (Veo offsets usually are).
export default function SetupScreen({ meta, onSave, onCancel }) {
  const m = meta || {};
  const [f, setF] = useState({
    opponent: m.opponent || "", date: m.date || localDate(), venue: m.venue || "home",
    opponent_tier: m.opponent_tier || "mid", veoUrl: m.veo?.url || "",
    off1: fmtMmSs(m.veo?.offset_h1_ms), off2: fmtMmSs(m.veo?.offset_h2_ms), flip: m.flip_from_h2 ?? true,
  });
  const [err, setErr] = useState(null);
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
      opponent_tier: f.opponent_tier, veo, flip_from_h2: f.flip,
      codebook_version: m.codebook_version || CB_VERSION, tagger_version: "two-pass@1.0.0", history,
    });
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
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

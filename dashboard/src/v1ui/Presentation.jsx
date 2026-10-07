import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";
import { fmtValue } from "./format.js";
import StatusChip from "./StatusChip.jsx";
import { clock } from "../format.js";

// Monday recap (PIPELINE §9): 5 slides, about 10 minutes, arrows to move,
// Esc to leave. The numbers come from /matches/{id}/recap; the sentence of the
// last slide is typed by the analyst (kept in this browser).
const NOTE_KEY = (id) => `recap-note:${id}`;
const TEN_MIN = 10 * 60;

function readNote(id) { try { return localStorage.getItem(NOTE_KEY(id)) || ""; } catch { return ""; } }
function saveNote(id, v) { try { localStorage.setItem(NOTE_KEY(id), v); } catch { /* private window */ } }

function ClipLinks({ clips }) {
  if (!clips?.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {clips.map((c) => c.url ? (
        <a key={`${c.half}-${c.t}`} href={c.url} target="veo" rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded bg-gold px-3 py-1.5 text-base font-semibold text-ink hover:bg-gold-lift">
          <Play size={16} /> MT{c.half} · {clock(c.t)}
        </a>
      ) : null)}
    </div>
  );
}

function Item({ it, sentence }) {
  const fmt = (v) => fmtValue({ value: v, unit: it.unit });
  return (
    <div className="rounded-sm border border-band-rule bg-band-2 p-6">
      <div className="text-2xl leading-snug text-paper">{sentence || it.label_fr}</div>
      <div className="mt-2 flex items-baseline gap-6">
        <span className="display text-6xl font-bold text-gold tabular">{fmt(it.value)}</span>
        <span className="text-2xl text-band-ink-2">vs {it.compare.label} <span className="font-semibold text-paper tabular">{fmt(it.compare.value)}</span></span>
      </div>
      <div className="mt-1 text-sm text-band-ink-2">n = {it.n}</div>
      <ClipLinks clips={it.clips} />
    </div>
  );
}

export default function Presentation({ recap, texts = {}, info, matchId, onClose }) {
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(TEN_MIN);
  const [note, setNote] = useState(() => readNote(matchId));
  const B = recap.brief;
  const modeNote = recap.mode === "vs_season" ? `Comparé à la moyenne de nos ${recap.n_other_matches} autres matchs.` : `Comparé à ${info.opponent}.`;
  const slides = [
    { title: "Le match en bref", body: (
      <div>
      {texts["recap.headline"] && <p className="mb-6 max-w-5xl text-3xl leading-snug text-paper [text-wrap:balance]">{texts["recap.headline"]}</p>}
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
        {[["Score", `${B.goals_for?.value ?? "–"}–${B.goals_against?.value ?? "–"}`], ["xG pour", fmtValue(B.xg_for)], ["xG contre", fmtValue(B.xg_against)],
          ["Occasions", fmtValue(B.chances_for)], ["Territoire (temps)", fmtValue(B.field_tilt_time)]].map(([l, v]) => (
          <div key={l} className="rounded-sm border border-band-rule bg-band-2 p-6"><div className="text-xl text-band-ink-2">{l}</div><div className="display mt-2 text-6xl font-bold text-gold tabular">{v}</div></div>
        ))}
      </div></div>) },
    recap.best.length > 0 && { title: "Ce qui a bien marché", body: <div className="space-y-5">{recap.best.map((it) => <Item key={it.id} it={it} sentence={texts[`recap.best.${it.id}`]} />)}</div> },
    recap.worst.length > 0 && { title: "À travailler", body: <div className="space-y-5">{recap.worst.map((it) => <Item key={it.id} it={it} sentence={texts[`recap.worst.${it.id}`]} />)}</div> },
    recap.trend && recap.trend.status !== "TROP TÔT" && { title: "La tendance", body: (
      <div className="rounded-sm border border-band-rule bg-band-2 p-6">
        <div className="text-2xl">{recap.trend.label_fr}</div>
        <div className="mt-3"><StatusChip status={recap.trend.status} /></div>
      </div>) },
    texts["recap.focus"] && { title: "À travailler cette semaine", body: <p className="max-w-5xl text-4xl font-semibold leading-snug text-paper [text-wrap:balance]">{texts["recap.focus"]}</p> },
    { title: "À surveiller", body: (
      <textarea value={note} onChange={(e) => { setNote(e.target.value); saveNote(matchId, e.target.value); }}
        aria-label="À surveiller"
        className="h-48 w-full resize-none rounded-sm border border-band-rule bg-band-2 p-5 text-3xl leading-snug text-paper placeholder:text-band-ink-2 focus:outline-none" />) },
  ].filter(Boolean);

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    const onKey = (e) => {
      if (e.target.tagName === "TEXTAREA") { if (e.key === "Escape") e.target.blur(); return; }
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); setI((x) => Math.min(slides.length - 1, x + 1)); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => { clearInterval(id); window.removeEventListener("keydown", onKey); };
  }, [onClose, slides.length]);

  const s = slides[i];
  return (
    <div className="band fixed inset-0 z-50 flex flex-col bg-band text-paper">
      <div className="flex items-center justify-between px-8 py-4 text-band-ink-2">
        <span className="display text-xl uppercase tracking-wider">Lauréats · {info.opponent} · {i + 1}/{slides.length}</span>
        <span className="flex items-center gap-4">
          <span className={`tabular ${left < 0 ? "text-gold" : ""}`}>{left < 0 ? "+" : ""}{clock(Math.abs(left) * 1000)}</span>
          <button type="button" aria-label="Quitter" onClick={onClose} className="rounded p-1 hover:bg-band-2"><X size={22} /></button>
        </span>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-8 pb-8">
        <h2 className="display mb-6 text-5xl font-bold uppercase tracking-wide">{s.title}</h2>
        <div className="flex-1">{s.body}</div>
        <p className="mt-6 text-sm text-band-ink-2">{modeNote}</p>
      </div>
    </div>
  );
}

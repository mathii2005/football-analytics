import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CODEBOOK, CB_VERSION } from "../core/codebook.js";
import { buildCards, cardQuestions } from "../core/cards.js";
import { latestAnswers, answerLine, isAnswered, coverage } from "../core/review.js";
import { veoLink, liveFromVideo } from "../core/video.js";
import { editOps, retractedSet } from "../core/session.js";
import { fmtClock } from "../core/clock.js";
import { buildBundle, bundleFileName } from "../core/bundle.js";
import { download, parseMmSs } from "../ui/util.js";
import { useSaver } from "../store/useSaver.js";

// Pass 2: the quiz (PIPELINE §5). One card per moment the live log selected,
// answered with number keys while Veo plays in a reused window.
const BUDGET_MS = CODEBOOK.review.budget_minutes * 60000;
const TIER_MIN = Object.fromEntries(CODEBOOK.review.tiers.map((t) => [t.tier, t.minutes]));
const THEMES = CODEBOOK.review.tiers.find((t) => t.tier === 3).rotation;
const VL = CODEBOOK.value_labels_fr;
const CL = CODEBOOK.card_labels_fr;
const HINTS = CODEBOOK.review_hints_fr;
const CHANCE_DEF = CODEBOOK.cards.find((c) => c.id === "FLAG").definitions.CHANCE_NO_SHOT;

function GapForm({ card, veo, onFill, onUnknown, disabled }) {
  const [lines, setLines] = useState([]);
  const [key, setKey] = useState("Q");
  const [at, setAt] = useState("");
  const useVeo = veo?.offset_h1_ms != null;
  const add = () => {
    const ms = parseMmSs(at);
    if (ms === null) return;
    const t = useVeo ? liveFromVideo(veo, card.half, ms) : ms;
    setLines([...lines, { key, t }].sort((a, b) => a.t - b.t));
    setAt("");
  };
  const KEYS = [["Q", "Notre ballon"], ["W", "Leur ballon"], ["E", "Ballon mort"], ...[0, 1, 2, 3, 4, 5].map((n) => [String(n), `Zone ${n}`])];
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-2">Fenêtre MT{card.half} {fmtClock(card.window[0])} → {fmtClock(card.window[1])}. Ajoute les états et zones vus sur la vidéo{useVeo ? " (temps Veo)" : " (temps du chrono)"}.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select className="field mt-0 w-40" value={key} onChange={(e) => setKey(e.target.value)}>{KEYS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input className="field mt-0 w-24 text-center" placeholder="mm:ss" value={at} onChange={(e) => setAt(e.target.value)} />
        <button className="btn" onClick={add}>Ajouter</button>
      </div>
      <ul className="text-sm">{lines.map((l, i) => <li key={i}>{KEYS.find(([k]) => k === l.key)[1]} · {fmtClock(l.t)}</li>)}</ul>
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={disabled || !lines.length} onClick={() => onFill(lines)}>Valider le remplissage</button>
        <button className="btn" disabled={disabled} onClick={onUnknown}>Laisser inconnu</button>
      </div>
    </div>
  );
}

export default function ReviewScreen({ store, match, onSave, onBack, onReload }) {
  const [ops, setOps] = useState(match.ops);
  const [reviewed, setReviewed] = useState(match.reviewed || []);
  const [meta, setMeta] = useState(match.meta);
  const theme = meta.review?.theme || THEMES[0];
  const [elapsed, setElapsed] = useState(meta.review?.elapsed_ms || 0);
  const [paused, setPaused] = useState(false);
  const [idx, setIdx] = useState(0);
  const [qi, setQi] = useState(0);
  const [autoVeo, setAutoVeo] = useState(true);
  const [toast, setToast] = useState(null);
  const { save, conflict } = useSaver(store, match.rev);
  const ref = useRef({ ops, reviewed, meta, elapsed });
  ref.current = { ops, reviewed, meta, elapsed };

  const cards = useMemo(() => buildCards(ops, reviewed, { theme, matchId: meta.id }), [ops, reviewed, theme, meta.id]);
  const answers = useMemo(() => latestAnswers(reviewed), [reviewed]);
  const cov = useMemo(() => coverage(cards, answers), [cards, answers]);
  const card = cards[Math.min(idx, cards.length - 1)];
  const over = elapsed >= BUDGET_MS;     // the 60 min is a guide: past it, the timer turns red and answering goes on
  const locked = false;
  const questions = card ? cardQuestions(card.kind) : [];
  const draft = card ? { ...card.prefill, ...(answers.get(card.id) || {}) } : {};

  const say = (text) => { setToast(text); setTimeout(() => setToast(null), 1800); };
  const persist = useCallback((next = {}) => {
    const s = { ...ref.current, ...next };
    const m = { ...s.meta, review: { ...(s.meta.review || {}), theme: s.meta.review?.theme || THEMES[0], elapsed_ms: s.elapsed } };
    save(() => [m, s.ops, s.reviewed, match.clock]);
    onSave({ ...match, meta: m, ops: s.ops, reviewed: s.reviewed });
  }, [save, match, onSave]);

  // timer: runs while the screen is open, not paused, under the budget
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setElapsed((e) => e + 1000), 1000);
    return () => clearInterval(id);
  }, [paused]);
  useEffect(() => { if (elapsed % 10000 === 0) persist(); }, [elapsed, persist]);

  const openVeo = (c = card) => {
    const url = c && veoLink(meta.veo, c.half, c.t);
    if (url) window.open(url, "veo");
    else say("Ajoute le lien Veo et le coup d'envoi dans la feuille de match");
  };
  const go = (i, open = autoVeo) => {
    const n = Math.max(0, Math.min(cards.length - 1, i));
    setIdx(n); setQi(0);
    if (open) openVeo(cards[n]);
  };

  const answer = (qid, value) => {
    if (locked || !card) return;
    const q = { ...draft, [qid]: value };
    const line = answerLine(card, q, new Date().toISOString());
    const next = [...ref.current.reviewed, line];
    setReviewed(next); persist({ reviewed: next });
    const nextQ = questions.findIndex((x, i) => i > questions.findIndex((y) => y.id === qid) && q[x.id] === undefined);
    if (nextQ >= 0) setQi(nextQ);
    else if (isAnswered(card, q)) go(idx + 1);
  };

  // « erreur de tag »: the live press was a mistake (every card but GAP)
  const invalidOpt = card ? CODEBOOK.cards.find((c) => c.id === card.kind)?.invalid_option : null;
  const markInvalid = (undo = false) => {
    if (!card || !invalidOpt) return;
    const line = answerLine(card, undo ? {} : { invalid: invalidOpt.value }, new Date().toISOString());
    const next = [...ref.current.reviewed, line];
    setReviewed(next); persist({ reviewed: next });
    if (!undo) go(idx + 1);
  };

  const moveMoment = () => {
    if (!card?.opSeq) return;
    const s = window.prompt("Temps Veo du bon moment (mm:ss)");
    const v = parseMmSs(s);
    if (v === null) return;
    const t = liveFromVideo(meta.veo, card.half, v);
    if (t === null) return say("Il faut le coup d'envoi Veo dans la feuille de match");
    const r = editOps(ref.current.ops, card.opSeq, { t }, new Date().toISOString());
    if (r.error) return say(r.error);
    const next = ref.current.ops.concat(r.ops);
    setOps(next); persist({ ops: next }); say("Moment déplacé");
  };

  const fillGap = (lines) => {
    let seq = ref.current.ops.reduce((m, o) => Math.max(m, o.seq), 0) + 1;
    const wall = new Date().toISOString();
    const out = [];
    if (card.seq != null && !retractedSet(ref.current.ops).has(card.seq)) out.push({ seq: seq++, t: card.t, half: card.half, k: "U", v: card.seq, wall, cb: CB_VERSION });
    for (const l of lines) {
      const isZone = /^\d$/.test(l.key);
      out.push({ seq: seq++, t: l.t, half: card.half, k: isZone ? "Z" : "S", v: isZone ? Number(l.key) : { Q: "US", W: "THEM", E: "DEAD" }[l.key], wall, cb: CB_VERSION, gap_fill: true });
    }
    const nextOps = ref.current.ops.concat(out);
    const nextRev = [...ref.current.reviewed, answerLine(card, { result: "FILLED" }, wall)];
    setOps(nextOps); setReviewed(nextRev); persist({ ops: nextOps, reviewed: nextRev });
    go(idx + 1);
  };
  const gapUnknown = () => {
    const nextRev = [...ref.current.reviewed, answerLine(card, { result: "UNKNOWN" }, new Date().toISOString())];
    setReviewed(nextRev); persist({ reviewed: nextRev }); go(idx + 1);
  };

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (!card) return;
      const q = questions[qi];
      if (/^Digit[0-9]$|^Numpad[0-9]$/.test(e.code) && q && card.kind !== "GAP") {
        const n = Number(e.code.slice(-1));
        if (n === 0) answer(q.id, "CANT_SEE");
        else if (n <= q.values.length) answer(q.id, q.values[n - 1]);
        e.preventDefault(); return;
      }
      const map = { Enter: () => go(idx + 1), ArrowRight: () => go(idx + 1), ArrowLeft: () => go(idx - 1),
                    KeyK: () => go(idx + 1, false), KeyO: () => openVeo(), KeyV: () => moveMoment(), KeyN: () => markInvalid(),
                    ArrowDown: () => setQi((i) => Math.min(questions.length - 1, i + 1)), ArrowUp: () => setQi((i) => Math.max(0, i - 1)) };
      if (map[e.code]) { e.preventDefault(); map[e.code](); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => () => persist(), []);   // save the timer when leaving

  const setTheme = (t) => { const m = { ...meta, review: { ...(meta.review || {}), theme: t } }; setMeta(m); ref.current.meta = m; persist({ meta: m }); setIdx(0); };
  const exportNow = () => download(bundleFileName(meta), buildBundle(meta, ref.current.ops, ref.current.reviewed));
  const tierNow = elapsed < TIER_MIN[1] * 60000 ? 1 : elapsed < (TIER_MIN[1] + TIER_MIN[2]) * 60000 ? 2 : 3;
  const totalAnswered = Object.values(cov).reduce((s, c) => s + c.answered, 0);
  const contextLine = (c) => {
    if (c.kind === "ENTRY" || c.kind === "OPP_ENTRY") return `Zone ${c.from} → ${c.to}`;
    if (c.kind === "LOSS") return `Perte en zone ${c.band}`;
    if (c.kind === "SHOT" || c.kind === "GOAL") return c.team === "US" ? "Lauréats" : c.team === "THEM" ? "Adversaire" : "";
    if (c.kind === "SET_PIECE") return `${c.type === "CORNER" ? "Corner" : "Coup franc"} · ${c.team === "US" ? "Lauréats" : "Adversaire"}`;
    if (c.lowFidelity) return "Bloc de 15 min trop chargé";
    return "";
  };

  return (
    <div className="flex h-screen flex-col" onClickCapture={(e) => { if (e.target.closest("button")) setTimeout(() => document.activeElement?.blur?.(), 0); }}>
      <header className="flex flex-wrap items-center gap-3 border-b border-rule bg-paper px-4 py-2">
        <button className="btn" onClick={() => { persist(); onBack(); }}>← Retour</button>
        <div className="font-semibold">Revue · {meta.opponent} · {meta.date}</div>
        <div className={`text-2xl font-semibold tabular-nums ${over ? "text-warn" : ""}`}>{fmtClock(elapsed)} <span className="text-sm text-ink-3">/ {fmtClock(BUDGET_MS)}{over ? " · temps dépassé" : ""}</span></div>
        <button className="btn" onClick={() => setPaused((p) => !p)}>{paused ? "Reprendre" : "Pause"}</button>
        <span className="rounded bg-paper-2 px-2 py-0.5 text-sm">Palier {tierNow}</span>
        <label className="text-sm">Thème <select className="field mt-0 ml-1 inline-block w-36" value={theme} onChange={(e) => setTheme(e.target.value)}>{THEMES.map((t) => <option key={t} value={t}>{CL[t]}</option>)}</select></label>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={autoVeo} onChange={(e) => setAutoVeo(e.target.checked)} /> Ouvrir Veo à chaque carte</label>
        <div className="ml-auto flex gap-2 text-sm text-ink-3">{totalAnswered}/{cards.length} cartes <button className="btn" onClick={exportNow}>Exporter</button></div>
      </header>
      {conflict && <div className="flex items-center justify-between bg-warn px-4 py-1 text-sm font-semibold text-paper">Ce match a été modifié ailleurs (autre onglet ou import) : cet écran n'enregistre plus. <button className="btn" onClick={onReload}>Recharger</button></div>}
      {!meta.veo?.url || meta.veo?.offset_h1_ms == null ? <div className="bg-us/15 px-4 py-1 text-sm text-us-deep">Sans lien Veo ni coup d'envoi MT1 dans la feuille de match, les cartes ne peuvent pas ouvrir la vidéo.</div> : null}

      <div className="grid min-h-0 flex-1 grid-cols-[18rem_1fr] gap-4 p-4">
        <aside className="min-h-0 overflow-y-auto rounded border border-rule bg-paper p-2 text-sm">
          {[1, 2, 3].map((tier) => (
            <div key={tier} className="mb-2">
              <div className="label px-1">Palier {tier} · {TIER_MIN[tier]} min</div>
              {cards.map((c, i) => c.tier !== tier ? null : (
                <button key={c.id} onClick={() => go(i)} className={`flex w-full justify-between rounded px-1 py-0.5 text-left hover:bg-paper-2 ${i === idx ? "bg-paper-2 font-semibold" : ""}`}>
                  <span>{isAnswered(c, answers.get(c.id)) ? "✓ " : answers.get(c.id) ? "• " : "  "}{CL[c.kind]}</span>
                  <span className="tabular-nums text-ink-3">MT{c.half} {fmtClock(c.t)}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="mt-3 border-t border-rule px-1 pt-2">
            <div className="label">Couverture</div>
            {Object.entries(cov).map(([k, v]) => <div key={k} className="flex justify-between"><span>{CL[k]}</span><span className="tabular-nums">{v.answered}/{v.total}</span></div>)}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto rounded border border-rule bg-paper p-5">
          {!card ? <p className="text-ink-3">Aucune carte : le journal ne contient rien à revoir.</p> : (
            <>
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-2xl font-semibold">{CL[card.kind]} <span className="text-ink-3">{idx + 1}/{cards.length}</span></h2>
                <span className="tabular-nums text-ink-2">MT{card.half} · {fmtClock(card.t)}</span>
                <span className="text-ink-2">{contextLine(card)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={() => openVeo()}>▶ Ouvrir dans Veo (O)</button>
                {card.opSeq && <button className="btn" onClick={moveMoment}>Déplacer le moment (V)</button>}
                {invalidOpt && <button className="btn" onClick={() => markInvalid()}>{invalidOpt.label_fr} ({invalidOpt.key})</button>}
              </div>
              {invalidOpt && draft.invalid && (
                <div className="mt-3 flex items-center justify-between rounded border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
                  <span>Marquée « {invalidOpt.label_fr.replace(" (erreur de tag)", "").toLowerCase()} » : exclue des statistiques. Corrige le journal si besoin.</span>
                  <button className="btn" onClick={() => markInvalid(true)}>Annuler</button>
                </div>
              )}

              {card.kind === "GAP" ? (
                <div className="mt-5"><GapForm card={card} veo={meta.veo} onFill={fillGap} onUnknown={gapUnknown} disabled={locked} /></div>
              ) : (
                <div className="mt-5 space-y-4">
                  {questions.map((q, i) => (
                    <div key={q.id} className={`rounded border p-3 ${i === qi ? "border-ink" : "border-rule"}`} onClick={() => setQi(i)}>
                      <div className="flex items-baseline justify-between">
                        <div className="font-medium">{q.label_fr}</div>
                        {card.prefill[q.id] && <div className="text-xs text-ink-3">prérempli : {VL[card.prefill[q.id]]}</div>}
                      </div>
                      {HINTS[q.id] && <div className="mt-0.5 text-xs text-ink-3">{q.id === "type" ? CHANCE_DEF : HINTS[q.id]}</div>}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {q.values.map((v, n) => (
                          <button key={v} disabled={locked} onClick={(e) => { e.stopPropagation(); answer(q.id, v); }}
                            className={`btn ${draft[q.id] === v ? "btn-primary" : ""}`}><kbd className="mr-1">{n + 1}</kbd>{VL[v] ?? v}</button>
                        ))}
                        <button disabled={locked} onClick={(e) => { e.stopPropagation(); answer(q.id, "CANT_SEE"); }}
                          className={`btn ${draft[q.id] === "CANT_SEE" ? "btn-primary" : ""}`}><kbd className="mr-1">0</kbd>{VL.CANT_SEE}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-5 text-xs text-ink-3">Chiffres = répondre · 0 = je ne vois pas · ↑↓ = question · Entrée / → = carte suivante · ← = précédente · K = passer · O = Veo · V = déplacer le moment{invalidOpt ? ` · N = ${invalidOpt.label_fr.replace(" (erreur de tag)", "").toLowerCase()}` : ""}</p>
            </>
          )}
        </main>
      </div>
      {toast && <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded bg-ink px-4 py-2 text-sm text-paper shadow">{toast}</div>}
    </div>
  );
}

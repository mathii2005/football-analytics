import { useCallback, useEffect, useRef, useState } from "react";
import { keyToAction } from "../core/keymap.js";
import { clockMs, startClock, pauseClock, nudgeClock, halfTime, fmtClock } from "../core/clock.js";
import { deriveLive, opsForAction, editOps, pressesPerMinute } from "../core/session.js";
import { CB_VERSION, CODEBOOK } from "../core/codebook.js";
import { buildBundle, bundleFileName } from "../core/bundle.js";
import { download } from "../ui/util.js";
import HelpOverlay from "./HelpOverlay.jsx";
import Pitch from "./Pitch.jsx";
import Journal from "./Journal.jsx";

const STATE_UI = {
  US: { label: "Notre ballon", cls: "bg-us text-paper" },
  THEM: { label: "Leur ballon", cls: "bg-them text-paper" },
  DEAD: { label: "Ballon mort", cls: "bg-dead text-paper" },
};
const RESTART_FR = { KICKOFF: "Engagement", THROW: "Touche", CORNER: "Corner", FK: "Coup franc", GK: "Dégagement", PEN: "Penalty" };
const SNAPSHOT_MS = 5 * 60 * 1000;
const LOAD = CODEBOOK.load;

export default function LiveScreen({ store, match, onEditMeta, onQuit }) {
  const [ops, setOps] = useState(match.ops);
  const [clock, setClock] = useState(match.clock);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const [help, setHelp] = useState(false);
  const [flipPrompt, setFlipPrompt] = useState(false);
  const [saved, setSaved] = useState(store.ok);
  const opsRef = useRef(ops), clockRef = useRef(clock);
  opsRef.current = ops; clockRef.current = clock;
  const meta = match.meta;

  const say = useCallback((text, kind = "info") => {
    setToast({ text, kind, id: Date.now() });
  }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 1800); return () => clearTimeout(id); }, [toast]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id); }, []);

  const persist = useCallback(async (nextOps, nextClock) => {
    await store.saveMatch(meta, nextOps, match.reviewed || [], nextClock);
    setSaved(store.ok);
  }, [store, meta, match.reviewed]);

  const commit = useCallback((newOps, nextClock = clockRef.current) => {
    const next = opsRef.current.concat(newOps);
    opsRef.current = next; clockRef.current = nextClock;
    setOps(next); setClock(nextClock);
    persist(next, nextClock);
  }, [persist]);

  const exportNow = useCallback(() => {
    download(bundleFileName(meta), buildBundle(meta, opsRef.current, match.reviewed || []));
    say("Exporté ✓", "ok");
  }, [meta, match.reviewed, say]);

  // snapshots, and export reminders when storage failed
  useEffect(() => {
    const id = setInterval(() => {
      store.snapshot(meta, opsRef.current, match.reviewed || []);
      if (!store.ok) say("Stockage indisponible : exporte maintenant (Ctrl+S)", "warn");
    }, SNAPSHOT_MS);
    return () => clearInterval(id);
  }, [store, meta, match.reviewed, say]);

  // System lines (clock, half, flip), numbered after the current log.
  const sysOps = (...specs) => {
    let seq = opsRef.current.reduce((m, o) => Math.max(m, o.seq), 0) + 1;
    return specs.map(([k, v, t, half, extra = {}]) => ({ seq: seq++, t, half, k, v, wall: new Date().toISOString(), cb: CB_VERSION, ...extra }));
  };
  const sysOp = (k, v, t, half, extra) => sysOps([k, v, t, half, extra])[0];
  const hasHalfStart = (half) => opsRef.current.some((o) => o.k === "H" && o.v === "START" && o.half === half);

  const handle = useCallback((action) => {
    const c = clockRef.current, nowMs = Date.now(), t = clockMs(c, nowMs);
    const live = deriveLive(opsRef.current);
    switch (action.type) {
      case "help": setHelp((h) => !h); return;
      case "escape": setHelp(false); return;
      case "export": exportNow(); return;
      case "clock": {
        if (action.op === "nudge") {
          const nc = nudgeClock(c, action.ms, nowMs);
          commit([sysOp("CLOCK", "NUDGE", clockMs(nc, nowMs), c.half, { d: action.ms })], nc);
          say(`Chrono ${action.ms > 0 ? "+" : "−"}${Math.abs(action.ms) >= 60000 ? Math.abs(action.ms) / 60000 + " min" : Math.abs(action.ms) / 1000 + " s"}`);
          return;
        }
        if (c.running) { const nc = pauseClock(c, nowMs); commit([sysOp("CLOCK", "PAUSE", t, c.half)], nc); say("Pause", "warn"); return; }
        const nc = startClock(c, nowMs);
        const add = hasHalfStart(c.half)
          ? sysOps(["CLOCK", "START", t, c.half])
          : sysOps(["H", "START", t, c.half], ["CLOCK", "START", t, c.half]);
        commit(add, nc);
        say(c.half === 2 && add.length > 1 ? "MT2 lancée" : "Chrono lancé", "ok");
        return;
      }
      case "halftime": {
        if (c.half === 2) { say("Déjà en MT2", "warn"); return; }
        const nc = halfTime(c, nowMs);
        commit([sysOp("H", "END", t, 1)], nc);
        download(bundleFileName(meta), buildBundle(meta, opsRef.current, match.reviewed || []));
        if (meta.flip_from_h2) setFlipPrompt(true);
        say("Mi-temps : MT2 commence à 45:00. Export fait. Espace pour relancer.", "warn");
        return;
      }
      default: break;
    }
    const r = opsForAction(opsRef.current, action, { t, half: c.half, wall: new Date().toISOString(), flip: live.flip });
    if (r.error) { say(r.error, "warn"); return; }
    if (r.ops.length) commit(r.ops);
    if (r.warning) say(r.warning, "warn");
    else if (!c.running && action.type === "op") say("Chrono en pause (Espace pour lancer)", "warn");
  }, [commit, exportNow, meta, match.reviewed, say]);

  const editLine = (seq, change) => {
    const r = editOps(opsRef.current, seq, change, new Date().toISOString());
    if (r.error) { say(r.error, "warn"); return r; }
    if (r.ops.length) { commit(r.ops); say(change.delete ? "Supprimé" : change.restore ? "Restauré" : "Modifié", "ok"); }
    return r;
  };
  const setFlip = (on) => { commit([sysOp("FLIP", on ? "ON" : "OFF", clockMs(clockRef.current, Date.now()), clockRef.current.half)]); setFlipPrompt(false); };
  const endMatch = () => {
    const c = clockRef.current, nowMs = Date.now();
    commit([sysOp("H", "END", clockMs(c, nowMs), c.half)], pauseClock(c, nowMs));
    setTimeout(exportNow, 50);
  };

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (flipPrompt) {
        if (e.key === "Enter") { e.preventDefault(); setFlip(true); }
        if (e.key === "Escape") { e.preventDefault(); setFlipPrompt(false); }
        return;
      }
      const action = keyToAction(e);
      if (!action) return;
      e.preventDefault();
      handle(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const live = deriveLive(ops);
  const t = clockMs(clock, now);
  const ui = STATE_UI[live.state] || { label: "Avant le coup d'envoi", cls: "bg-paper text-ink-3 border border-rule" };
  const load5 = pressesPerMinute(ops, t, Math.min(300000, Math.max(60000, t - (clock.half === 2 ? 2700000 : 0))));
  const loadAll = pressesPerMinute(ops, t, Math.max(60000, t));
  const quiet = clock.running && live.lastPlayT != null ? Math.max(0, Math.floor((t - live.lastPlayT) / 1000)) : 0;
  const loadCls = (v) => (v > LOAD.block_alarm_per_min ? "text-warn" : v > LOAD.cap_per_min ? "text-us-deep" : "text-ink");

  return (
    <div className="flex min-h-screen flex-col" onClickCapture={(e) => { if (e.target.closest("button")) setTimeout(() => document.activeElement?.blur?.(), 0); }}>
      <header className="flex flex-wrap items-center gap-4 border-b border-rule bg-paper px-4 py-2">
        <div className="text-sm text-ink-3">{meta.opponent || "—"} · {meta.date}</div>
        <div className="text-2xl font-semibold tabular-nums">LAU {live.score.us} – {live.score.them} OPP</div>
        <div className="flex items-center gap-1">
          <button className="btn" onClick={() => handle({ type: "clock", op: "nudge", ms: -60000 })}>−1m</button>
          <button className="btn" onClick={() => handle({ type: "clock", op: "nudge", ms: -10000 })}>−10s</button>
          <span className="mx-2 text-4xl font-semibold tabular-nums">{fmtClock(t)}</span>
          <button className="btn" onClick={() => handle({ type: "clock", op: "nudge", ms: 10000 })}>+10s</button>
          <button className="btn" onClick={() => handle({ type: "clock", op: "nudge", ms: 60000 })}>+1m</button>
        </div>
        <span className="rounded bg-paper-2 px-2 py-0.5 text-sm font-medium">MT{clock.half}</span>
        <span className={`text-sm font-medium ${clock.running ? "text-us-deep" : "text-warn"}`}>{clock.running ? "En cours" : "Pause"}</span>
        <span className={`text-xs ${saved ? "text-ink-3" : "font-semibold text-warn"}`}>{saved ? "Sauvegardé ✓" : "Non sauvegardé ✗"}</span>
        <div className="ml-auto flex gap-2">
          <button className={`btn ${live.flip ? "btn-primary" : ""}`} onClick={() => setFlip(!live.flip)}>Inverser · {live.flip ? "ON" : "OFF"}</button>
          <button className="btn" onClick={onEditMeta}>Feuille de match</button>
          <button className="btn" onClick={exportNow}>Exporter</button>
          <button className="btn" onClick={() => setHelp(true)}>?</button>
          <button className="btn" onClick={onQuit}>Quitter</button>
        </div>
      </header>

      <section className={`mx-4 mt-4 flex items-center justify-between rounded px-6 py-6 ${ui.cls}`}>
        <span className="text-5xl font-semibold">{ui.label}</span>
        <span className="text-xl">
          {live.pendingRestart && live.state === "DEAD" ? `Reprise : ${RESTART_FR[live.pendingRestart]}` : ""}
          {live.flip ? "  · Zones inversées" : ""}
        </span>
      </section>

      <section className="mx-4 mt-3">
        <Pitch band={live.band} flip={live.flip}
          ask={live.needsRestartBand ? (live.pendingRestart === "THROW" ? "Zone de la touche ?" : "Zone du coup franc ?") : null}
          onBand={(v) => handle({ type: "op", k: "Z", v, absolute: true })} />
      </section>

      <section className="mx-4 mt-4 grid flex-1 grid-cols-3 gap-4 pb-4">
        <div className="col-span-2 flex min-h-0 flex-col">
          <Journal entries={live.recent} onEdit={editLine} />
        </div>
        <div className="space-y-3">
          <div className="rounded border border-rule bg-paper p-3">
            <div className="label">Charge (appuis / min)</div>
            <div className="mt-1 flex justify-between text-sm"><span>5 dernières min</span><span className={`font-semibold tabular-nums ${loadCls(load5)}`}>{load5}</span></div>
            <div className="flex justify-between text-sm"><span>Depuis le début</span><span className={`font-semibold tabular-nums ${loadCls(loadAll)}`}>{loadAll}</span></div>
            <div className="mt-1 text-xs text-ink-3">Cible ≤ {LOAD.cap_per_min}</div>
          </div>
          <div className={`rounded border p-3 ${quiet > 90 ? "animate-pulse border-warn bg-warn/10" : "border-rule bg-paper"}`}>
            <div className="label">Depuis le dernier état / zone</div>
            <div className="text-2xl font-semibold tabular-nums">{quiet} s</div>
          </div>
          {live.lostOpen && <div className="rounded border border-warn bg-warn/10 p-3 text-sm font-semibold text-warn">Fil perdu : reprends au prochain ballon mort (T ou Q/W/E pour fermer)</div>}
          <div className="flex gap-2">
            <button className="btn flex-1" onClick={() => handle({ type: "halftime" })} disabled={clock.half === 2}>Mi-temps (M)</button>
            <button className="btn flex-1" onClick={endMatch}>Fin du match</button>
          </div>
        </div>
      </section>

      {flipPrompt && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/50">
          <div className="rounded bg-paper p-6 shadow-lg">
            <p className="text-lg font-medium">Inverser les zones pour la 2e mi-temps ?</p>
            <p className="mt-1 text-sm text-ink-3">Tu tagues les zones telles que tu les vois ; on enregistre la zone réelle.</p>
            <div className="mt-4 flex gap-2"><button className="btn btn-primary" onClick={() => setFlip(true)}>Oui (Entrée)</button><button className="btn" onClick={() => setFlipPrompt(false)}>Non (Échap)</button></div>
          </div>
        </div>
      )}
      {help && <HelpOverlay onClose={() => setHelp(false)} />}
      {toast && (
        <div key={toast.id} className={`fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded px-4 py-2 text-sm font-medium shadow ${toast.kind === "warn" ? "bg-warn text-paper" : toast.kind === "ok" ? "bg-us text-paper" : "bg-ink text-paper"}`}>{toast.text}</div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { makeStore, memoryBackend } from "./store/store.js";
import { idbBackend } from "./store/idb.js";
import { newClock } from "./core/clock.js";
import LaunchScreen from "./setup/LaunchScreen.jsx";
import SetupScreen from "./setup/SetupScreen.jsx";
import LiveScreen from "./live/LiveScreen.jsx";
import ReviewScreen from "./review/ReviewScreen.jsx";

// Screens: launch ("Reprendre ou nouveau ?") -> match sheet -> live.
export default function App() {
  const [store, setStore] = useState(null);
  const [screen, setScreen] = useState("launch");
  const [match, setMatch] = useState(null);   // {meta, ops, reviewed, clock}

  useEffect(() => {
    idbBackend().then((b) => setStore(makeStore(b))).catch(() => {
      const s = makeStore(memoryBackend()); s.ok = false; setStore(s);
    });
  }, []);

  if (!store) return <p className="p-8 text-ink-3">Chargement…</p>;

  const open = (m, to) => { setMatch({ reviewed: [], clock: newClock(), ...m }); setScreen(to); };
  // switch screens from what is saved (each screen persists every change)
  const reopen = async (id, to) => {
    const m = await store.loadMatch(id);
    if (m) open({ meta: m.meta, ops: m.ops, reviewed: m.reviewed || [], clock: m.clock || newClock(), rev: m.rev }, to);
  };

  if (screen === "setup")
    return <SetupScreen meta={match?.meta} onCancel={() => setScreen(match?.ops?.length ? "live" : "launch")}
      onSave={async (meta) => {
        const m = { ops: [], reviewed: [], clock: newClock(), ...match, meta };
        const r = await store.saveMatch(m.meta, m.ops, m.reviewed, m.clock, match?.rev);
        if (r.conflict) return reopen(meta.id, "live");
        open({ ...m, rev: r.rev }, "live");
      }} />;
  if (screen === "live" && match)
    return <LiveScreen store={store} match={match} onEditMeta={() => reopen(match.meta.id, "setup")}
      onReview={() => reopen(match.meta.id, "review")} onReload={() => reopen(match.meta.id, "live")}
      onQuit={() => { setMatch(null); setScreen("launch"); }} />;
  if (screen === "review" && match)
    return <ReviewScreen store={store} match={match} onSave={setMatch} onReload={() => reopen(match.meta.id, "review")}
      onBack={() => { setMatch(null); setScreen("launch"); }} />;
  return <LaunchScreen store={store} onNew={() => { setMatch(null); setScreen("setup"); }} onOpenStored={reopen}
    onOpen={(m) => open(m, "live")} onReview={(m) => open(m, "review")} />;
}

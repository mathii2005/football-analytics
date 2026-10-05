// Saving: IndexedDB when available, in-memory otherwise. Every write is
// mirrored in memory first, so a failing backend never loses a press.
// Each saved match carries a revision: a save made from an out-of-date copy
// (another tab, an import in between) is refused instead of overwriting.
const SNAPSHOTS_KEPT = 3;

export function memoryBackend() {
  const m = new Map();
  return { get: async (k) => m.get(k), set: async (k, v) => { m.set(k, structuredClone(v)); } };
}

export function makeStore(backend) {
  const mem = memoryBackend();
  const store = { ok: true };
  async function put(key, value) {
    await mem.set(key, value);
    try { await backend.set(key, value); } catch { store.ok = false; }
  }
  async function get(key) {
    let b;
    try { b = await backend.get(key); } catch { store.ok = false; }
    const m = await mem.get(key);
    // both copies of a match carry a revision: the newest wins (a failed
    // backend write leaves the backend behind the memory copy)
    if (b?.rev !== undefined && m?.rev !== undefined) return m.rev > b.rev ? m : b;
    return b !== undefined ? b : m;
  }

  // Returns {rev} when saved, {conflict: true, rev} when someone saved a newer
  // revision since `expectRev` (nothing is written then).
  store.saveMatch = async (meta, ops, reviewed, clock = null, expectRev) => {
    const current = await get(`match:${meta.id}`);
    const currentRev = current?.rev ?? 0;
    if (expectRev !== undefined && currentRev > expectRev) return { conflict: true, rev: currentRev };
    const rev = currentRev + 1;
    await put(`match:${meta.id}`, { meta, ops, reviewed, clock, rev, savedAt: Date.now() });
    const index = (await get("matches")) || [];
    const entry = { id: meta.id, opponent: meta.opponent, date: meta.date, n: ops.length, savedAt: Date.now() };
    await put("matches", [entry, ...index.filter((x) => x.id !== meta.id)]);
    return { rev };
  };
  store.loadMatch = (id) => get(`match:${id}`);
  store.listMatches = async () => (await get("matches")) || [];
  store.snapshot = async (meta, ops, reviewed) => {
    const list = (await get(`snap:${meta.id}`)) || [];
    await put(`snap:${meta.id}`, [...list, { at: Date.now(), ops, reviewed }].slice(-SNAPSHOTS_KEPT));
  };
  store.snapshots = async (id) => (await get(`snap:${id}`)) || [];
  return store;
}

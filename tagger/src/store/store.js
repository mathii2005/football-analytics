// Saving: IndexedDB when available, in-memory otherwise. Every write is
// mirrored in memory first, so a failing backend never loses a press.
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
    try { const v = await backend.get(key); if (v !== undefined) return v; } catch { store.ok = false; }
    return mem.get(key);
  }
  store.saveMatch = async (meta, ops, reviewed, clock = null) => {
    await put(`match:${meta.id}`, { meta, ops, reviewed, clock, savedAt: Date.now() });
    const index = (await get("matches")) || [];
    const entry = { id: meta.id, opponent: meta.opponent, date: meta.date, n: ops.length, savedAt: Date.now() };
    await put("matches", [entry, ...index.filter((x) => x.id !== meta.id)]);
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

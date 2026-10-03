// Real backend: one IndexedDB object store of key -> value.
import { openDB } from "idb";

export async function idbBackend() {
  const db = await openDB("laureats-tagger", 1, { upgrade(d) { d.createObjectStore("kv"); } });
  return { get: (k) => db.get("kv", k), set: (k, v) => db.put("kv", v, k) };
}

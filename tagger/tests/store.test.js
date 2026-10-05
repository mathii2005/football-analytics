import { test } from "node:test";
import assert from "node:assert/strict";
import { makeStore, memoryBackend } from "../src/store/store.js";

test("saves and reads back a match", async () => {
  const s = makeStore(memoryBackend());
  await s.saveMatch({ id: "m1", opponent: "X" }, [{ seq: 1 }], []);
  const m = await s.loadMatch("m1");
  assert.equal(m.ops.length, 1);
  assert.deepEqual((await s.listMatches()).map((x) => x.id), ["m1"]);
  assert.equal(s.ok, true);
});

test("a failing backend keeps the data in memory and flags the store", async () => {
  const broken = { get: async () => { throw new Error("no idb"); }, set: async () => { throw new Error("no idb"); } };
  const s = makeStore(broken);
  await s.saveMatch({ id: "m1" }, [{ seq: 1 }, { seq: 2 }], []);
  assert.equal(s.ok, false);
  assert.equal((await s.loadMatch("m1")).ops.length, 2);
});

test("snapshots keep the last three", async () => {
  const s = makeStore(memoryBackend());
  for (let i = 0; i < 5; i++) await s.snapshot({ id: "m1" }, [{ seq: i }], []);
  assert.equal((await s.snapshots("m1")).length, 3);
});

test("a save from a stale copy is refused instead of overwriting newer work", async () => {
  const s = makeStore(memoryBackend());
  const r1 = await s.saveMatch({ id: "m1" }, [{ seq: 1 }], [], null, undefined);
  const r2 = await s.saveMatch({ id: "m1" }, [{ seq: 1 }, { seq: 2 }], [], null, r1.rev);   // tab B, up to date
  const stale = await s.saveMatch({ id: "m1" }, [{ seq: 1 }, { seq: 9 }], [], null, r1.rev); // tab A, old copy
  assert.equal(stale.conflict, true);
  assert.equal((await s.loadMatch("m1")).ops.length, 2);
  assert.equal((await s.loadMatch("m1")).rev, r2.rev);
});

test("reads prefer the newest copy between memory and the backend", async () => {
  let fail = false;
  const inner = memoryBackend();
  const flaky = { get: inner.get, set: async (k, v) => { if (fail) throw new Error("quota"); return inner.set(k, v); } };
  const s = makeStore(flaky);
  const r1 = await s.saveMatch({ id: "m1" }, [{ seq: 1 }], [], null);
  fail = true;
  await s.saveMatch({ id: "m1" }, [{ seq: 1 }, { seq: 2 }], [], null, r1.rev);
  assert.equal((await s.loadMatch("m1")).ops.length, 2);
});

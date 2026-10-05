import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBundle, bundleFileName, parseImport } from "../src/core/bundle.js";
import { CB_VERSION } from "../src/core/codebook.js";

const meta = { id: "m_2026-10-04_bois", date: "2026-10-04", opponent: "Bois de Boulogne", venue: "home" };

test("bundle has the v1 shape and file name", () => {
  const b = buildBundle(meta, [{ seq: 1, t: 0, half: 1, k: "H", v: "START" }], [], new Date("2026-10-04T20:00:00Z"));
  assert.equal(b.schema_version, "1.0");
  assert.equal(b.codebook_version, CB_VERSION);
  assert.equal(b.events.length, 1);
  assert.equal(bundleFileName(meta), "laureats_2026-10-04_Bois-de-Boulogne_v1.json");
});

test("import recognises v1 bundles and old v0 exports", () => {
  const b = buildBundle(meta, [], [], new Date());
  assert.equal(parseImport(JSON.stringify(b)).kind, "v1");
  assert.equal(parseImport(JSON.stringify({ schema_version: "0.7", events: [], match: {} })).kind, "v0");
  assert.equal(parseImport("not json").kind, "error");
});

import { mergeExports, defaultPick, halfStats } from "../src/core/bundle.js";
const ev = (seq, t, half, k, v, extra = {}) => ({ seq, t, half, k, v, ...extra });
const A = { meta: { id: "m", veo: { url: "u", offset_h1_ms: 100, offset_h2_ms: null }, history: [] },
  events: [ev(1, 0, 1, "H", "START"), ev(2, 1000, 1, "S", "US"), ev(3, 1000, 1, "Z", 2, { auto: true, src: 2 }), ev(4, 2000, 1, "Z", 3), ev(5, 3000, 1, "Z", 4), ev(6, 4000, 1, "H", "END")],
  reviewed: [{ card: "ENTRY:5", seq: 5, q: { lane: "C" } }] };
const B = { meta: { id: "m", veo: { url: "u", offset_h1_ms: 100, offset_h2_ms: 5000 }, history: [] },
  events: [ev(1, 0, 1, "H", "START"), ev(2, 1000, 1, "S", "US"), ev(3, 1000, 1, "Z", 2, { auto: true, src: 2 }),
           ev(4, 2700000, 2, "H", "START"), ev(5, 2701000, 2, "S", "THEM"), ev(6, 2701000, 2, "Z", 3, { auto: true, src: 5 }),
           ev(7, 2702000, 2, "Z", 1), ev(8, 2703000, 2, "U", 7), ev(9, 2703500, 2, "Z", 0, { edit_of: 7 })],
  reviewed: [{ card: "OPP_ENTRY:7", seq: 7, q: { lane: "L" } }] };

test("the default pick takes, for each half, the export with more presses", () => {
  assert.deepEqual(halfStats(A), { 1: 3, 2: 0 });
  assert.deepEqual(defaultPick(A, B), { 1: "a", 2: "b" });
});

test("merging keeps A's first half and B's second half, renumbering B without breaking its links", () => {
  const m = mergeExports(A, B, { 1: "a", 2: "b" });
  const h2 = m.events.filter((o) => o.half === 2);
  assert.ok(Math.min(...h2.map((o) => o.seq)) > Math.max(...A.events.map((o) => o.seq)));
  const bySeq = new Map(m.events.map((o) => [o.seq, o]));
  const auto = h2.find((o) => o.auto);
  assert.equal(bySeq.get(auto.src).k, "S");
  const u = h2.find((o) => o.k === "U");
  assert.equal(bySeq.get(u.v).v, 1);
  assert.equal(bySeq.get(h2.find((o) => o.edit_of).edit_of).v, 1);
  assert.equal(m.events.filter((o) => o.half === 1).length, 6);
  assert.equal(m.meta.veo.offset_h2_ms, 5000);
  assert.deepEqual(m.reviewed.map((r) => r.card).sort(), ["ENTRY:5", `OPP_ENTRY:${u.v}`].sort());
  assert.equal(m.meta.history.at(-1).field, "merge");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBundle, bundleFileName, parseImport } from "../src/core/bundle.js";

const meta = { id: "m_2026-10-04_bois", date: "2026-10-04", opponent: "Bois de Boulogne", venue: "home" };

test("bundle has the v1 shape and file name", () => {
  const b = buildBundle(meta, [{ seq: 1, t: 0, half: 1, k: "H", v: "START" }], [], new Date("2026-10-04T20:00:00Z"));
  assert.equal(b.schema_version, "1.0");
  assert.equal(b.codebook_version, "1.0.0");
  assert.equal(b.events.length, 1);
  assert.equal(bundleFileName(meta), "laureats_2026-10-04_Bois-de-Boulogne_v1.json");
});

test("import recognises v1 bundles and old v0 exports", () => {
  const b = buildBundle(meta, [], [], new Date());
  assert.equal(parseImport(JSON.stringify(b)).kind, "v1");
  assert.equal(parseImport(JSON.stringify({ schema_version: "0.7", events: [], match: {} })).kind, "v0");
  assert.equal(parseImport("not json").kind, "error");
});

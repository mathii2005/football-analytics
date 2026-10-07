import { test } from "node:test";
import assert from "node:assert/strict";
import { lookup } from "../src/snapshot.js";

test("a snapshot answers the API paths it holds, ignoring parameter order", () => {
  const snap = { paths: { "/matches": [1], "/season/v1?tier=top&venue=home": { ok: 1 }, "/matches/m/metrics?half=2": { half: 2 } } };
  assert.deepEqual(lookup(snap, "/matches"), [1]);
  assert.deepEqual(lookup(snap, "/season/v1?venue=home&tier=top"), { ok: 1 });
  assert.deepEqual(lookup(snap, "/matches/m/metrics?half=2"), { half: 2 });
  assert.throws(() => lookup(snap, "/matches/m/texts"), /pas dans cet export/);
});

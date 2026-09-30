// Pure link/preset logic of the dashboard, run with Node's built-in runner:
//   node --test dashboard/tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { FUNNEL_CLIPS, counterPressPreset, funnelStep, nextPreset } from "../src/links.js";

test("funnel 'Cadrés' opens on-target shots only", () => {
  assert.deepEqual(FUNNEL_CLIPS["Cadrés"], ["shot_on_target"]);
});

test("counter-press zone opens every loss of that zone", () => {
  assert.deepEqual(counterPressPreset("3"), { cats: ["loss"], zone: "3" });
});

test("funnel step text", () => {
  assert.equal(funnelStep(0, 0), "–");                 // nothing to convert from
  assert.equal(funnelStep(6, 8), "des tirs arrivent sans entrée surface taguée");
  assert.equal(funnelStep(8, 5), "63 %");
});

test("preset is cleared by plain navigation and match change, kept by openClips", () => {
  const p = { cats: ["loss"], zone: "3", key: 1 };
  assert.equal(nextPreset(p, { type: "tab" }), null);
  assert.equal(nextPreset(p, { type: "match" }), null);
  assert.deepEqual(nextPreset(null, { type: "open", preset: { zone: "4" }, key: 2 }), { zone: "4", key: 2 });
});

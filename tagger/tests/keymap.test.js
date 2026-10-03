import { test } from "node:test";
import assert from "node:assert/strict";
import { keyToAction } from "../src/core/keymap.js";

const k = (code, key, extra = {}) => keyToAction({ code, key, shiftKey: false, ctrlKey: false, metaKey: false, ...extra });

test("match keys come from the codebook, read by physical position", () => {
  assert.deepEqual(k("KeyQ", "q"), { type: "op", k: "S", v: "US" });
  assert.deepEqual(k("KeyW", "z"), { type: "op", k: "S", v: "THEM" });   // AZERTY label, same position
  assert.deepEqual(k("KeyE", "e"), { type: "op", k: "S", v: "DEAD" });
  assert.deepEqual(k("KeyD", "d"), { type: "op", k: "R", v: "FK" });
  assert.deepEqual(k("KeyD", "D", { shiftKey: true }), { type: "op", k: "R", v: "PEN" });
  assert.deepEqual(k("KeyC", "c"), { type: "op", k: "SH", v: "GOAL" });
  assert.deepEqual(k("KeyR", "r"), { type: "op", k: "F", v: null });
  assert.deepEqual(k("KeyT", "t"), { type: "op", k: "LOST", v: null });
  assert.deepEqual(k("Digit5", "5"), { type: "op", k: "Z", v: 5 });
  assert.deepEqual(k("Numpad0", "0"), { type: "op", k: "Z", v: 0 });
});

test("comfort keys", () => {
  assert.deepEqual(k("Space", " "), { type: "clock", op: "toggle" });
  assert.deepEqual(k("BracketLeft", "["), { type: "clock", op: "nudge", ms: -10000 });
  assert.deepEqual(k("BracketRight", "}", { shiftKey: true }), { type: "clock", op: "nudge", ms: 60000 });
  assert.deepEqual(k("KeyM", "m"), { type: "halftime" });
  assert.deepEqual(k("Equal", "+", { shiftKey: true }), { type: "score", v: "US+1" });
  assert.deepEqual(k("Minus", "-"), { type: "score", v: "US-1" });
  assert.deepEqual(k("Digit0", ")", { shiftKey: true }), { type: "score", v: "THEM+1" });
  assert.deepEqual(k("Minus", "_", { shiftKey: true }), { type: "score", v: "THEM-1" });
  assert.deepEqual(k("Backspace", "Backspace"), { type: "undo" });
  assert.deepEqual(k("KeyZ", "z", { metaKey: true }), { type: "undo" });
  assert.deepEqual(k("KeyS", "s", { ctrlKey: true }), { type: "export" });
  assert.deepEqual(k("Slash", "?", { shiftKey: true }), { type: "help" });
  assert.deepEqual(k("Escape", "Escape"), { type: "escape" });
});

test("unmapped keys do nothing", () => {
  assert.equal(k("KeyP", "p"), null);
  assert.equal(k("Digit7", "7"), null);
});

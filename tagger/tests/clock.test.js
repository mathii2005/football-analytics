import { test } from "node:test";
import assert from "node:assert/strict";
import { newClock, clockMs, startClock, pauseClock, nudgeClock, halfTime } from "../src/core/clock.js";

test("start, run, pause", () => {
  let c = startClock(newClock(), 1000);
  assert.equal(clockMs(c, 6000), 5000);
  c = pauseClock(c, 6000);
  assert.equal(clockMs(c, 60000), 5000);
  assert.equal(c.running, false);
});

test("nudges work running or paused and never go below the half start", () => {
  let c = nudgeClock(newClock(), 10000, 0);
  assert.equal(clockMs(c, 0), 10000);
  c = nudgeClock(c, -60000, 0);
  assert.equal(clockMs(c, 0), 0);
  c = startClock(c, 100);
  c = nudgeClock(c, 60000, 1100);
  assert.equal(clockMs(c, 1100), 61000);
});

test("half time jumps to 45:00 paused, and the floor becomes 45:00", () => {
  let c = startClock(newClock(), 0);
  c = halfTime(c, 3000000);
  assert.deepEqual([c.half, c.running, clockMs(c, 9e9)], [2, false, 2700000]);
  c = nudgeClock(c, -10000, 0);
  assert.equal(clockMs(c, 0), 2700000);
});

test("a running clock survives a reload: it is plain data", () => {
  const c = JSON.parse(JSON.stringify(startClock(newClock(), 1000)));
  assert.equal(clockMs(c, 4000), 3000);
});

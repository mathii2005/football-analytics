import { test } from "node:test";
import assert from "node:assert/strict";
import { locFromPoint, toShooter, goalResult } from "../src/core/points.js";

// pitch points are absolute metres: x from our goal line (0..105), y from the
// left touchline in our attacking direction (0..68)
test("a shot position gives the shot zone, seen from the shooter", () => {
  assert.equal(locFromPoint({ x: 102, y: 34 }, "US"), "SIX");
  assert.equal(locFromPoint({ x: 94, y: 30 }, "US"), "CENTRAL_BOX");
  assert.equal(locFromPoint({ x: 94, y: 18 }, "US"), "WIDE_BOX");
  assert.equal(locFromPoint({ x: 80, y: 30 }, "US"), "CENTRAL_OUT");
  assert.equal(locFromPoint({ x: 85, y: 5 }, "US"), "WIDE_OUT");
  assert.equal(locFromPoint({ x: 3, y: 34 }, "THEM"), "SIX");             // their shot at our goal
  assert.deepEqual(toShooter({ x: 3, y: 30 }, "THEM"), { x: 102, y: 38 });
});

test("where the shot went: inside the frame is on target, outside says where it missed", () => {
  assert.equal(goalResult({ gy: 3.6, gz: 1.0 }), "ON_TARGET");
  assert.equal(goalResult({ gy: -0.8, gz: 0.5 }), "WIDE_LEFT");
  assert.equal(goalResult({ gy: 8.1, gz: 0.5 }), "WIDE_RIGHT");
  assert.equal(goalResult({ gy: 4, gz: 2.9 }), "OVER");
  assert.equal(goalResult({ blocked: true }), "BLOCKED");
});

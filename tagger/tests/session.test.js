import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveLive, opsForAction, pressesPerMinute } from "../src/core/session.js";

const ctx = (t, extra = {}) => ({ t, half: 1, wall: "w", flip: false, ...extra });
function play(actions) {
  let ops = [{ seq: 1, t: 0, half: 1, k: "H", v: "START", wall: "w", cb: "1.0.0" }];
  const errors = [];
  for (const [t, action, extra] of actions) {
    const r = opsForAction(ops, action, ctx(t, extra));
    if (r.error) errors.push(r.error); else ops = ops.concat(r.ops);
  }
  return { ops, live: deriveLive(ops), errors };
}
const op = (k, v) => ({ type: "op", k, v });

test("kick-off: pending restart, then Q applies the automatic band", () => {
  const { live, ops } = play([[2000, op("S", "US")]]);
  assert.equal(live.state, "US");
  assert.equal(live.band, 2);
  const auto = ops.find((o) => o.k === "Z" && o.auto);
  assert.equal(auto.src, ops.find((o) => o.k === "S").seq);
});

test("restart keys only while the ball is dead", () => {
  const { errors, live } = play([[2000, op("S", "US")], [3000, op("R", "CORNER")], [4000, op("S", "DEAD")], [5000, op("R", "CORNER")], [6000, op("S", "US")]]);
  assert.equal(errors.length, 1);
  assert.equal(live.band, 4);
});

test("a goal scores for the team in possession and restarts with the other team's kick-off", () => {
  const { live } = play([[2000, op("S", "US")], [9000, op("SH", "GOAL")]]);
  assert.deepEqual(live.score, { us: 1, them: 0 });
  assert.equal(live.state, "DEAD");
  assert.equal(live.pendingRestart, "KICKOFF");
});

test("a goal while dead (penalty) belongs to the team that last had the ball", () => {
  const { live } = play([[2000, op("S", "THEM")], [5000, op("S", "DEAD")], [6000, op("R", "PEN")], [9000, op("SH", "GOAL")]]);
  assert.deepEqual(live.score, { us: 0, them: 1 });
});

test("undo retracts the last match press and its automatic children, never deletes", () => {
  const { ops, live } = play([[2000, op("S", "US")], [3000, op("Z", 3)], [4000, { type: "undo" }], [5000, { type: "undo" }]]);
  assert.equal(ops.filter((o) => o.k === "U").length, 2);
  assert.equal(live.state, "DEAD");
  assert.equal(live.band, null);
  assert.ok(live.recent.some((r) => r.retracted));
});

test("flip stores the absolute band", () => {
  const { live } = play([[2000, op("S", "US")], [3000, op("Z", 1), { flip: true }]]);
  assert.equal(live.band, 4);
});

test("lost-the-thread opens a window that the next state press closes", () => {
  const a = play([[2000, op("S", "US")], [3000, op("LOST", null)]]);
  assert.equal(a.live.lostOpen, true);
  const b = play([[2000, op("S", "US")], [3000, op("LOST", null)], [9000, op("S", "THEM")]]);
  assert.equal(b.live.lostOpen, false);
});

test("manual score corrections", () => {
  const { live } = play([[1000, { type: "score", v: "US+1" }], [1000, { type: "score", v: "THEM+1" }], [1000, { type: "score", v: "US-1" }]]);
  assert.deepEqual(live.score, { us: 0, them: 1 });
});

test("presses per minute count match presses, not automatic ones", () => {
  const actions = Array.from({ length: 30 }, (_, i) => [i * 10000 + 1000, op("S", i % 2 ? "THEM" : "US")]);
  const { ops } = play(actions);
  assert.equal(pressesPerMinute(ops, 300000, 300000), 6);
});

test("a click on the pitch records the absolute band, even with the flip on", () => {
  const { live } = play([[2000, op("S", "US")], [3000, { type: "op", k: "Z", v: 1, absolute: true }, { flip: true }]]);
  assert.equal(live.band, 1);
});

test("throw-ins and free kicks ask for the band of the restart", () => {
  const a = play([[2000, op("S", "US")], [3000, op("S", "DEAD")], [4000, op("R", "THROW")]]);
  assert.equal(a.live.needsRestartBand, true);
  const b = play([[2000, op("S", "US")], [3000, op("S", "DEAD")], [4000, op("R", "FK")], [5000, op("Z", 3)]]);
  assert.equal(b.live.needsRestartBand, false);
  assert.equal(b.live.band, 3);
  const c = play([[2000, op("S", "US")], [3000, op("S", "DEAD")], [4000, op("R", "CORNER")]]);
  assert.equal(c.live.needsRestartBand, false);
});

test("taking a throw-in without its band is accepted but flagged", () => {
  let ops = [{ seq: 1, t: 0, half: 1, k: "H", v: "START" }];
  for (const [t, a] of [[2000, op("S", "US")], [3000, op("S", "DEAD")], [4000, op("R", "THROW")]]) ops = ops.concat(opsForAction(ops, a, ctx(t)).ops);
  const r = opsForAction(ops, op("S", "THEM"), ctx(5000));
  assert.equal(r.warning, "Zone de la reprise non indiquée");
  assert.equal(r.ops.length, 1);
});

// ---- editable log (append-only: an edit = retraction + corrected line) ----
import { editOps } from "../src/core/session.js";
const seqOf = (ops, k, v) => ops.find((o) => o.k === k && o.v === v && !o.auto).seq;
const apply = (ops, extra) => ops.concat(extra);

test("editing a value retracts the original and adds a corrected line", () => {
  const { ops } = play([[2000, op("S", "US")], [5000, op("S", "THEM")]]);
  const r = editOps(ops, seqOf(ops, "S", "THEM"), { v: "DEAD" }, "w");
  const next = apply(ops, r.ops);
  assert.equal(r.ops[0].k, "U");
  assert.equal(r.ops[1].edit_of, seqOf(ops, "S", "THEM"));
  assert.equal(deriveLive(next).state, "DEAD");
  assert.ok(deriveLive(next).recent.some((x) => x.edited));
});

test("editing the time re-orders the log by match time", () => {
  const { ops } = play([[2000, op("S", "US")], [3000, op("Z", 3)], [4000, op("Z", 4)]]);
  const next = apply(ops, editOps(ops, seqOf(ops, "Z", 3), { t: 6000 }, "w").ops);
  assert.equal(deriveLive(next).band, 3);
  assert.deepEqual(deriveLive(next).recent.filter((x) => !x.retracted).map((x) => x.t).slice(0, 2), [6000, 4000]);
});

test("changing the team taking a corner recomputes its automatic band", () => {
  const { ops } = play([[2000, op("S", "US")], [3000, op("S", "DEAD")], [4000, op("R", "CORNER")], [5000, op("S", "US")]]);
  const corner = ops.filter((o) => o.k === "S" && o.v === "US" && !o.auto).at(-1).seq;
  const next = apply(ops, editOps(ops, corner, { v: "THEM" }, "w").ops);
  assert.equal(deriveLive(next).band, 1);
});

test("deleting a goal removes the score and its automatic restart; restoring brings it back", () => {
  const { ops } = play([[2000, op("S", "US")], [9000, op("SH", "GOAL")]]);
  const goal = seqOf(ops, "SH", "GOAL");
  const deleted = apply(ops, editOps(ops, goal, { delete: true }, "w").ops);
  assert.deepEqual(deriveLive(deleted).score, { us: 0, them: 0 });
  assert.equal(deriveLive(deleted).state, "US");
  const restored = apply(deleted, editOps(deleted, goal, { restore: true }, "w").ops);
  assert.deepEqual(deriveLive(restored).score, { us: 1, them: 0 });
  assert.equal(deriveLive(restored).state, "DEAD");
});

test("changing a goal into a shot on target removes the goal consequences", () => {
  const { ops } = play([[2000, op("S", "US")], [9000, op("SH", "GOAL")]]);
  const next = apply(ops, editOps(ops, seqOf(ops, "SH", "GOAL"), { v: "ON" }, "w").ops);
  assert.deepEqual(deriveLive(next).score, { us: 0, them: 0 });
  assert.equal(deriveLive(next).state, "US");
});

test("an edit can't move a line out of its half", () => {
  const { ops } = play([[2000, op("S", "US")]]);
  const r = editOps(ops, seqOf(ops, "S", "US"), { t: -5000 }, "w");
  assert.equal(r.error, "Temps hors de la mi-temps");
});

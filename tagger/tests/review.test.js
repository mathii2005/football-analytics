import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCards, cardQuestions } from "../src/core/cards.js";
import { veoLink, videoMs, liveFromVideo } from "../src/core/video.js";
import { latestAnswers, answerLine, coverage, isAnswered } from "../src/core/review.js";

const ahuntsic = JSON.parse(fs.readFileSync(new URL("../../tests/fixtures/ahuntsic_2026-10-02_h1_v1.json", import.meta.url)));
const count = (cards) => cards.reduce((m, c) => ({ ...m, [c.kind]: (m[c.kind] || 0) + 1 }), {});

test("cards on the Ahuntsic half match the engine's counts", () => {
  const cards = buildCards(ahuntsic.events, [], { theme: "SET_PIECE", matchId: ahuntsic.meta.id });
  assert.deepEqual(count(cards), { SHOT: 9, GOAL: 2, FLAG: 5, ENTRY: 14, LOSS: 28, SET_PIECE: 4 });   // 3 throw-ins in the attacking zones
  const opp = buildCards(ahuntsic.events, [], { theme: "OPP_ENTRY", matchId: ahuntsic.meta.id });
  assert.equal(count(opp).OPP_ENTRY, 6);
});

test("cards come in tier order, then match time", () => {
  const cards = buildCards(ahuntsic.events, [], { theme: "SET_PIECE", matchId: "m" });
  const tiers = cards.map((c) => c.tier);
  assert.deepEqual(tiers, [...tiers].sort((a, b) => a - b));
  const t1 = cards.filter((c) => c.tier === 1).map((c) => c.t);
  assert.deepEqual(t1, [...t1].sort((a, b) => a - b));
  assert.deepEqual([...new Set(cards.filter((c) => c.tier === 2).map((c) => c.kind))], ["ENTRY", "LOSS"]);
});

const op = (seq, t, k, v, extra = {}) => ({ seq, t, half: 1, k, v, ...extra });
const base = [op(1, 0, "H", "START"), op(2, 1000, "S", "US"), op(3, 1000, "Z", 2, { auto: true, src: 2 })];

test("loss cards pre-fill whether we won the ball back within 5 s", () => {
  const ops = [...base, op(4, 2000, "Z", 3), op(5, 3000, "S", "THEM"), op(6, 6500, "S", "US"),
               op(7, 9000, "Z", 4), op(8, 10000, "S", "THEM"), op(9, 20000, "S", "US")];
  const losses = buildCards(ops, [], { theme: "SET_PIECE", matchId: "m" }).filter((c) => c.kind === "LOSS");
  assert.deepEqual(losses.map((c) => [c.seq, c.prefill.regain_5s]), [[5, "Y"], [8, "N"]]);
});

test("a goal card pre-fills the computed phase", () => {
  const ops = [...base, op(4, 2000, "Z", 3), op(5, 3000, "S", "THEM"), op(6, 9000, "S", "US"), op(7, 10000, "Z", 5),
               op(8, 12000, "SH", "GOAL", { team: "US" }), op(9, 12000, "S", "DEAD", { auto: true, src: 8 })];
  const goal = buildCards(ops, [], { theme: "SET_PIECE", matchId: "m" }).find((c) => c.kind === "GOAL");
  assert.equal(goal.prefill.phase_check, "TRANSITION");
});

test("an edited line keeps its card (and its answers): cards key on the original press", () => {
  const ops = [...base, op(4, 2000, "Z", 3), op(5, 3000, "Z", 4), op(6, 9000, "U", 5), op(7, 3500, "Z", 4, { edit_of: 5 })];
  const entry = buildCards(ops, [], { theme: "SET_PIECE", matchId: "m" }).find((c) => c.kind === "ENTRY");
  assert.equal(entry.id, "ENTRY:5");
  assert.equal(entry.t, 3500);
});

test("duel cards appear once a flag is answered KEY_DUEL", () => {
  const ops = [...base, op(4, 5000, "F", null)];
  const reviewed = [answerLine({ id: "FLAG:4", seq: 4 }, { type: "KEY_DUEL", lane: "C" }, "w")];
  const duel = buildCards(ops, reviewed, { theme: "DUEL", matchId: "m" }).filter((c) => c.kind === "DUEL");
  assert.deepEqual(duel.map((c) => c.id), ["DUEL:4"]);
});

test("goal cards ask the shot questions plus their own", () => {
  assert.deepEqual(cardQuestions("GOAL").map((q) => q.id), ["pos", "loc", "body", "situation", "assist", "last_pass_lane", "end", "shooter", "assister", "phase_check", "box_lane"]);
});

test("Veo links: 5 s lead, per-half offsets, and the reverse for moving a moment", () => {
  const veo = { url: "https://app.veo.co/matches/x/", offset_h1_ms: 1394000, offset_h2_ms: 4500000 };
  assert.equal(videoMs(veo, 1, 60000), 1454000);
  assert.equal(veoLink(veo, 1, 60000), "https://app.veo.co/matches/x/#t=24:09");
  assert.equal(videoMs(veo, 2, 2_760_000), 4_560_000);
  assert.equal(liveFromVideo(veo, 2, 4_560_000), 2_760_000);
  assert.equal(veoLink({ url: "", offset_h1_ms: 1 }, 1, 0), null);
  assert.equal(veoLink({ url: "u", offset_h1_ms: null }, 1, 0), null);
});

test("answers: latest wins, coverage per kind, CANT_SEE counts as answered", () => {
  const card = { id: "LOSS:5", seq: 5, kind: "LOSS" };
  const lines = [answerLine(card, { cause: "TACKLED" }, "w1"), answerLine(card, { intent: "THROUGH", intent_lane: "C", cause: "INTERCEPTED", closing_3s: "2", regain_5s: "N", lost_by: "8", first_presser: "NONE" }, "w2")];
  const answers = latestAnswers(lines);
  assert.equal(answers.get("LOSS:5").cause, "INTERCEPTED");
  assert.equal(isAnswered(card, answers.get("LOSS:5")), true);
  assert.equal(isAnswered(card, { cause: "CANT_SEE" }), false);
  assert.equal(isAnswered(card, { intent: "CANT_SEE", intent_lane: "CANT_SEE", cause: "CANT_SEE", closing_3s: "CANT_SEE", regain_5s: "CANT_SEE", lost_by: "CANT_SEE", first_presser: "CANT_SEE" }), true);
  assert.deepEqual(coverage([card, { id: "LOSS:9", seq: 9, kind: "LOSS" }], answers).LOSS, { answered: 1, total: 2 });
});

test("an entry marked « pas une entrée » counts as answered", () => {
  const card = { id: "ENTRY:5", seq: 5, kind: "ENTRY" };
  assert.equal(isAnswered(card, { invalid: "NOT_AN_ENTRY" }), true);
  assert.equal(isAnswered({ id: "GAP:block:1:0", kind: "GAP" }, { invalid: "NOT_AN_ENTRY" }), false);
});

test("every card but GAP can be marked as a tag error", () => {
  for (const kind of ["SHOT", "GOAL", "FLAG", "LOSS", "SET_PIECE", "DUEL"]) {
    assert.equal(isAnswered({ kind }, { invalid: "TAG_ERROR" }), true, kind);
  }
  assert.equal(isAnswered({ kind: "GAP" }, { invalid: "TAG_ERROR" }), false);
});

test("player questions are asked only on our own actions", () => {
  const ids = (card) => cardQuestions(card.kind, card).map((q) => q.id);
  assert.ok(ids({ kind: "SHOT", team: "US" }).includes("shooter"));
  assert.ok(!ids({ kind: "SHOT", team: "THEM" }).includes("shooter"));
  assert.ok(ids({ kind: "GOAL", team: "US" }).includes("assister"));
  assert.ok(ids({ kind: "LOSS" }).includes("lost_by") && ids({ kind: "LOSS" }).includes("first_presser"));
  assert.ok(ids({ kind: "ENTRY" }).includes("entry_player"));
});

test("in description mode a card needs a description to count as answered", () => {
  const card = { kind: "FLAG" };
  const q = { type: "ERROR", lane: "C" };
  assert.equal(isAnswered(card, q), true);
  assert.equal(isAnswered(card, q, { describe: true }), false);
  assert.equal(isAnswered(card, { ...q, note: "  " }, { describe: true }), false);
  assert.equal(isAnswered(card, { ...q, note: "Perte au milieu, contre adverse" }, { describe: true }), true);
  assert.equal(isAnswered(card, { invalid: "TAG_ERROR" }, { describe: true }), true);
});

test("a throw-in in the attacking zones gets a set-piece card, like corners and free kicks", () => {
  const ops = [op(1, 0, "H", "START"), op(2, 1000, "S", "US"), op(3, 1000, "Z", 2, { auto: true, src: 2 }),
    op(4, 3000, "Z", 4), op(5, 5000, "S", "DEAD"), op(6, 6000, "R", "THROW"), op(7, 6500, "Z", 4), op(8, 8000, "S", "US"),
    op(9, 12000, "Z", 3), op(10, 14000, "S", "DEAD"), op(11, 15000, "R", "THROW"), op(12, 15500, "Z", 3), op(13, 17000, "S", "US")];
  const sp = buildCards(ops, [], { theme: "SET_PIECE", matchId: "m" }).filter((c) => c.kind === "SET_PIECE");
  assert.deepEqual(sp.map((c) => [c.type, c.seq]), [["THROW", 6]]);
});

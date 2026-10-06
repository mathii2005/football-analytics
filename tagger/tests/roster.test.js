import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRoster, searchRoster, playerLabel } from "../src/core/roster.js";

test("a pasted list becomes a roster: one player per line, number first", () => {
  const r = parseRoster("10 Léo Tremblay\n7, Samuel Côté\n 4 - Marc-André Roy \n\nGK1 rien\n10 Doublon");
  assert.deepEqual(r, [{ num: "4", name: "Marc-André Roy" }, { num: "7", name: "Samuel Côté" }, { num: "10", name: "Léo Tremblay" }]);
});

test("search finds a player by exact number first, then by name without accents", () => {
  const r = parseRoster("1 Alex Gagnon\n10 Léo Tremblay\n11 Lea Côté\n17 Kevin Leon");
  assert.deepEqual(searchRoster(r, "10").map((p) => p.num), ["10"]);
  assert.deepEqual(searchRoster(r, "1").map((p) => p.num), ["1", "10", "11", "17"]);
  assert.deepEqual(searchRoster(r, "le").map((p) => p.num), ["1", "10", "11", "17"]);   // « Alex » contains « le »
  assert.deepEqual(searchRoster(r, "tremb").map((p) => p.num), ["10"]);
  assert.deepEqual(searchRoster(r, "cote").map((p) => p.num), ["11"]);
  assert.deepEqual(searchRoster(r, ""), r);
});

test("an answer shows as « #10 Léo Tremblay », a number missing from the roster as « #23 »", () => {
  const r = parseRoster("10 Léo Tremblay");
  assert.equal(playerLabel(r, "10"), "#10 Léo Tremblay");
  assert.equal(playerLabel(r, "23"), "#23");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLineup, subFromForm } from "../src/core/lineup.js";

test("a substitution is typed as match time; second-half times start at 45:00", () => {
  assert.deepEqual(subFromForm({ in: "15", out: "9", half: 2, at: "63:30" }), { in: "15", out: "9", half: 2, t: 3810000 });
  assert.equal(subFromForm({ in: "15", out: "9", half: 2, at: "12:00" }).error, "En 2e mi-temps, le temps commence à 45:00");
  assert.equal(subFromForm({ in: "15", out: "", half: 1, at: "30:00" }).error, "Indique qui entre et qui sort");
});

test("the lineup check flags what would break the minutes played", () => {
  assert.deepEqual(checkLineup({ starters: ["1", "2"], subs: [] }), ["2 titulaires (11 attendus)"]);
  const eleven = ["1", "2", "3", "4", "5", "6", "8", "9", "10", "11", "12"];
  assert.deepEqual(checkLineup({ starters: eleven, subs: [{ in: "15", out: "9", half: 2, t: 3810000 }] }), []);
  assert.deepEqual(checkLineup({ starters: eleven, subs: [{ in: "9", out: "15", half: 2, t: 3810000 }] }),
    ["#15 sort sans être sur le terrain (63:30)", "#9 entre alors qu'il est déjà sur le terrain (63:30)"]);
});

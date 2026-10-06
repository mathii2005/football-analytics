import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVeo } from "../src/veo.js";

test("Veo links are removed everywhere in an API payload while they are switched off", () => {
  const data = { match: { veo_url: "https://veo/x", opponent: "A" },
                 metrics: { shots: { value: 2, clips: { all: [{ t: 1, url: "https://veo/x#t=1" }] } } },
                 clips: { selection: [{ t: 2, video_url: "https://veo/x#t=2" }] } };
  const out = stripVeo(data, false);
  assert.equal(out.match.veo_url, undefined);
  assert.equal(out.match.opponent, "A");
  assert.equal(out.metrics.shots.clips.all[0].url, undefined);
  assert.equal(out.metrics.shots.clips.all[0].t, 1);
  assert.equal(out.clips.selection[0].video_url, undefined);
  assert.deepEqual(stripVeo(data, true), data);
});

// The review quiz (CODEBOOK §5): one card per moment of the live log that
// matches a trigger. Cards key on the original press (an edited line keeps
// its card and its answers). Tier 1 is chronological; tier 2 is all entries,
// then all losses; tier 3 is the theme of the week only.
import { CODEBOOK } from "./codebook.js";
import { retractedSet, shotTeam } from "./session.js";

const CARD = Object.fromEntries(CODEBOOK.cards.map((c) => [c.id, c]));
const LIVE = new Set(["US", "THEM"]);
const PHASES = Object.fromEntries(CODEBOOK.derived.phases.map((p) => [p.id, p]));
const SP_MS = PHASES.SET_PIECE.window_s * 1000;
const TR_MS = PHASES.TRANSITION.window_s * 1000;
const ATTACKING = { US: [4, 5], THEM: [0, 1] };
const LOAD = CODEBOOK.load;
const CARD_SECONDS = 20;                 // estimate used to decide entry sampling
const SAMPLE_ABOVE_MIN = 50;             // tiers 1 + 2 above this -> sample 3->4 entries at 50 %

export function cardQuestions(kind) {
  const c = CARD[kind];
  if (!c) return [];
  return c.inherits ? [...cardQuestions(c.inherits), ...c.questions] : c.questions;
}

function seeded(str) {                   // deterministic 0..1 generator from the match id
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

export function buildCards(ops, reviewed, { theme, matchId }) {
  const gone = retractedSet(ops);
  const bySeq = new Map(ops.map((o) => [o.seq, o]));
  const root = (o) => (o.edit_of !== undefined && bySeq.has(o.edit_of) ? root(bySeq.get(o.edit_of)) : o.seq);
  const eff = ops.filter((o) => o.k !== "U" && !gone.has(o.seq)).sort((a, b) => a.half - b.half || a.t - b.t || a.seq - b.seq);
  const answers = new Map(reviewed.map((l) => [l.card, l.q]));
  const bandAt = (half, t) => {
    let b = null;
    for (const o of eff) if (o.k === "Z" && o.half === half && o.t <= t) b = o.v;
    return b;
  };

  const cards = [];
  const add = (kind, o, extra = {}) => {
    const seq = root(o);
    cards.push({ id: `${kind}:${seq}`, kind, tier: CARD[kind].tier, seq, opSeq: o.seq, half: o.half, t: o.t, prefill: {}, ...extra });
  };
  let state = null, band = null, lastLive = null, pending = null, pendingSeq = null;
  const lastRegain = {}, lastRestart = {}, restarts = [];
  let lostOpen = null;

  eff.forEach((o, i) => {
    const before = { state, lastLive, band, pendingRestart: pending };
    switch (o.k) {
      case "H":
        if (o.v === "START") { state = "DEAD"; pending = "KICKOFF"; pendingSeq = null; }
        break;
      case "R":
        if (state === "DEAD") { pending = o.v; pendingSeq = o.seq; }
        break;
      case "Z":
        if (!o.auto && band !== null) {
          if (state === "US" && ((band <= 3 && o.v >= 4) || (o.v === 5 && band <= 4))) add("ENTRY", o, { from: band, to: o.v });
          if (state === "THEM" && o.v === 0 && band >= 1) add("OPP_ENTRY", o, { from: band, to: o.v });
        }
        band = o.v;
        break;
      case "S": {
        if (lostOpen) { lostOpen.end = o.t; lostOpen = null; }
        if (o.v === "THEM" && state === "US" && band !== null && band >= 3) {
          const next = eff.slice(i + 1).find((x) => x.k === "S" && x.v !== "THEM");
          const won = next && next.v === "US" && next.t - o.t <= CODEBOOK.derived.counterpress_window_s * 1000;
          add("LOSS", o, { band, prefill: { regain_5s: won ? "Y" : "N" } });
        }
        if (LIVE.has(o.v) && LIVE.has(state) && o.v !== state) lastRegain[o.v] = o.t;
        if (LIVE.has(o.v) && state === "DEAD" && pending) {
          const r = { type: pending, team: o.v, t: o.t, half: o.half, rseq: pendingSeq, op: pendingSeq != null ? bySeq.get(pendingSeq) : null };
          restarts.push(r);
          lastRestart[o.v] = r;
          pending = null;
        }
        if (o.v !== state) state = o.v;
        if (LIVE.has(o.v)) lastLive = o.v;
        break;
      }
      case "SH": {
        const team = o.team ?? shotTeam(before).team;
        if (o.v === "GOAL") add("GOAL", o, { team, prefill: { phase_check: phaseAt(team, o) } });
        else add("SHOT", o, { team });
        break;
      }
      case "F": {
        add("FLAG", o);
        if (answers.get(`FLAG:${root(o)}`)?.type === "KEY_DUEL") add("DUEL", o);
        break;
      }
      case "LOST":
        if (lostOpen) { lostOpen.end = o.t; lostOpen = null; }
        else { add("GAP", o, { window: [o.t, null] }); lostOpen = cards.at(-1); lostOpen.end = null; }
        break;
      default: break;
    }
  });
  for (const c of cards) if (c.kind === "GAP") c.window = [c.t, c.end ?? Math.max(...eff.filter((o) => o.half === c.half).map((o) => o.t))];

  function phaseAt(team, o) {
    const r = lastRestart[team];
    if (r && o.t - r.t <= SP_MS) {
      if (r.type === "PEN") return "PENALTY";
      if (["CORNER", "FK"].includes(r.type) || (r.type === "THROW" && ATTACKING[team].includes(bandAt(r.half, r.t)))) return "SET_PIECE";
    }
    if (lastRegain[team] !== undefined && o.t - lastRegain[team] <= TR_MS) return "TRANSITION";
    const b = bandAt(o.half, o.t);
    const own = b === null || (team === "US" ? b <= 2 : b >= 3);
    return own ? "BUILD_UP" : "SETTLED";
  }

  for (const r of restarts) {
    if (!["CORNER", "FK"].includes(r.type) || !r.op) continue;
    if (ATTACKING[r.team].includes(bandAt(r.half, r.t))) add("SET_PIECE", r.op, { t: r.t, team: r.team, type: r.type });
  }

  // low-fidelity blocks (more than the alarm load over 15 minutes) become gap cards
  const blockMs = LOAD.block_minutes * 60000;
  const blocks = new Map();
  for (const o of eff) if (["S", "Z", "R", "SH", "F", "LOST"].includes(o.k) && !o.auto) {
    const key = `${o.half}:${Math.floor(o.t / blockMs)}`;
    blocks.set(key, (blocks.get(key) || 0) + 1);
  }
  for (const [key, n] of blocks) if (n / LOAD.block_minutes > LOAD.block_alarm_per_min) {
    const [half, i] = key.split(":").map(Number);
    cards.push({ id: `GAP:block:${key}`, kind: "GAP", tier: 1, seq: null, half, t: i * blockMs, window: [i * blockMs, (i + 1) * blockMs], prefill: {}, lowFidelity: true });
  }

  // tier 3 = the theme of the week only
  let out = cards.filter((c) => c.tier !== 3 || c.kind === theme);
  // sampling of 3 -> 4 entries when tiers 1 + 2 would not fit
  const t12 = out.filter((c) => c.tier <= 2).length;
  if ((t12 * CARD_SECONDS) / 60 > SAMPLE_ABOVE_MIN) {
    const rnd = seeded(matchId || "match");
    out = out.filter((c) => c.kind !== "ENTRY" || c.to === 5 || rnd() < 0.5);
  }
  const kindOrder = { ENTRY: 0, LOSS: 1 };
  return out.sort((a, b) => a.tier - b.tier || (a.tier === 2 ? kindOrder[a.kind] - kindOrder[b.kind] : 0) || a.half - b.half || a.t - b.t);
}

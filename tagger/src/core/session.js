// Live session: the log is the only state. deriveLive() reads it in match-time
// order, opsForAction() turns a key press into new log lines, and editOps()
// turns an edit into new log lines. Old lines are never changed.
import { CODEBOOK, CB_VERSION, MATCH_KINDS, opLabel } from "./codebook.js";

const AUTO = CODEBOOK.auto_bands;
const ASK_BAND = new Set(CODEBOOK.restart_band_prompt);
const RETRACT_IGNORED = new Set(CODEBOOK.log.retraction_ignored_for);
const HALF_START = { 1: 0, 2: CODEBOOK.clock.half2_start_ms };

const byTime = (a, b) => a.half - b.half || a.t - b.t || a.seq - b.seq;
const nextSeq = (ops) => ops.reduce((m, o) => Math.max(m, o.seq), 0) + 1;

export function retractedSet(ops) {
  const bySeq = new Map(ops.map((o) => [o.seq, o]));
  const out = new Set();
  for (const o of ops) {
    if (o.k !== "U") continue;
    const target = bySeq.get(o.v);
    if (!target || RETRACT_IGNORED.has(target.k)) continue;
    out.add(target.seq);
  }
  for (const o of ops) if (o.src !== undefined && out.has(o.src)) out.add(o.seq);   // automatic children
  return out;
}

export function deriveLive(ops) {
  const retracted = retractedSet(ops);
  const live = { state: null, lastLive: null, band: null, pendingRestart: null, score: { us: 0, them: 0 },
                 lostOpen: false, flip: false, half: 1, lastPlayT: null, needsRestartBand: false, recent: [] };
  for (const o of [...ops].sort(byTime)) {
    if (o.k === "SCORE") {
      const [team, d] = [o.v.startsWith("US") ? "us" : "them", o.v.endsWith("+1") ? 1 : -1];
      live.score[team] = Math.max(0, live.score[team] + d);
      continue;
    }
    if (o.k === "FLIP") { live.flip = o.v === "ON"; continue; }
    if (o.k === "H") {
      live.half = o.half;
      if (o.v === "START") { live.state = "DEAD"; live.pendingRestart = "KICKOFF"; }
      continue;
    }
    if (!MATCH_KINDS.has(o.k)) continue;
    if (!o.auto) live.recent.push({ seq: o.seq, t: o.t, half: o.half, k: o.k, v: o.v, label: opLabel(o),
                                    retracted: retracted.has(o.seq), edited: o.edit_of !== undefined });
    if (retracted.has(o.seq)) continue;
    switch (o.k) {
      case "S":
        live.state = o.v;
        if (o.v !== "DEAD") { live.lastLive = o.v; live.pendingRestart = null; live.needsRestartBand = false; }
        live.lostOpen = false;
        live.lastPlayT = o.t;
        break;
      case "Z": live.band = o.v; live.lastPlayT = o.t; live.needsRestartBand = false; break;
      case "R": live.pendingRestart = o.v; live.needsRestartBand = ASK_BAND.has(o.v); break;
      case "LOST": live.lostOpen = !live.lostOpen; break;
      case "SH":
        if (o.v === "GOAL") {
          const team = live.state === "US" || live.state === "THEM" ? live.state : live.lastLive;
          if (team === "US") live.score.us += 1; else if (team === "THEM") live.score.them += 1;
        }
        break;
      default: break;
    }
  }
  live.recent.reverse();   // newest (by match time) first; the whole journal
  return live;
}

// The new line(s) a match press produces, given the state just before it.
function linesFor(before, k, v, mk) {
  if (k === "S") {
    const s = mk("S", v);
    const out = [s];
    const auto = AUTO[before.pendingRestart];
    if (before.state === "DEAD" && v !== "DEAD" && auto) out.push(mk("Z", auto[v], { auto: true, src: s.seq }));
    return out;
  }
  if (k === "SH" && v === "GOAL") {
    const g = mk("SH", "GOAL");
    return [g, mk("S", "DEAD", { auto: true, src: g.seq }), mk("R", "KICKOFF", { auto: true, src: g.seq })];
  }
  return [mk(k, v)];
}

export function opsForAction(ops, action, { t, half, wall, flip }) {
  const live = deriveLive(ops);
  let seq = nextSeq(ops);
  const mk = (k, v, extra = {}) => ({ seq: seq++, t, half, k, v, wall, cb: CB_VERSION, ...extra });

  if (action.type === "score") return { ops: [mk("SCORE", action.v)] };
  if (action.type === "undo") {
    const retracted = retractedSet(ops);
    const target = [...ops].reverse().find((o) => MATCH_KINDS.has(o.k) && !o.auto && !retracted.has(o.seq));
    return target ? { ops: [mk("U", target.seq)] } : { error: "Rien à annuler" };
  }
  if (action.type !== "op") return { ops: [] };

  const { k, v } = action;
  if (k === "R" && live.state !== "DEAD") return { error: "Reprise seulement quand le ballon est mort (E)" };
  // Keyboard bands follow the flip; a click on the pitch is already absolute.
  if (k === "Z") return { ops: [mk("Z", flip && !action.absolute ? 5 - v : v)] };
  const warning = k === "S" && live.needsRestartBand && v !== "DEAD" ? "Zone de la reprise non indiquée" : undefined;
  return { ops: linesFor(live, k, v, mk), warning };
}

// Edit a line of the journal: {v} new value, {t} new time, {delete: true}, or
// {restore: true}. Produces a retraction of the original (unless restoring)
// and a corrected copy marked edit_of, with its automatic children recomputed
// from the state just before the new time.
export function editOps(ops, targetSeq, change, wall) {
  const target = ops.find((o) => o.seq === targetSeq);
  if (!target || !MATCH_KINDS.has(target.k) || target.auto) return { error: "Entrée non modifiable" };
  const retracted = retractedSet(ops);
  let seq = nextSeq(ops);
  const base = { wall, cb: CB_VERSION };

  if (change.delete) return retracted.has(targetSeq) ? { ops: [] } : { ops: [{ seq: seq++, t: target.t, half: target.half, k: "U", v: targetSeq, ...base }] };

  const t = change.t ?? target.t;
  const half = target.half;
  const end = half === 1 ? HALF_START[2] : Infinity;
  if (t < HALF_START[half] || t >= end) return { error: "Temps hors de la mi-temps" };
  const v = change.v !== undefined ? change.v : target.v;

  const out = [];
  if (!retracted.has(targetSeq)) out.push({ seq: seq++, t: target.t, half, k: "U", v: targetSeq, ...base });
  else if (!change.restore && change.v === undefined && change.t === undefined) return { ops: [] };
  const withoutTarget = ops.concat(out);
  const before = deriveLive(withoutTarget.filter((o) => byTime(o, { half, t, seq: Infinity }) < 0 || o.k === "U"));
  const mk = (k, val, extra = {}) => ({ seq: seq++, t, half, k, v: val, ...base, ...extra });
  const lines = linesFor(before, target.k, v, mk);
  lines[0].edit_of = targetSeq;
  return { ops: out.concat(lines) };
}

// Match presses (not automatic, not clock/score) per minute over the window.
export function pressesPerMinute(ops, nowT, windowMs) {
  const from = nowT - windowMs;
  const n = ops.filter((o) => MATCH_KINDS.has(o.k) && !o.auto && o.edit_of === undefined && o.t > from && o.t <= nowT).length;
  return Math.round((n / (windowMs / 60000)) * 10) / 10;
}

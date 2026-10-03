// Live session: the log is the only state. deriveLive() reads it, and
// opsForAction() turns a key press into new log lines (never edits old ones).
import { CODEBOOK, CB_VERSION, MATCH_KINDS, opLabel } from "./codebook.js";

const AUTO = CODEBOOK.auto_bands;
const ASK_BAND = new Set(CODEBOOK.restart_band_prompt);
const RETRACT_IGNORED = new Set(CODEBOOK.log.retraction_ignored_for);

function retractedSet(ops) {
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
  for (const o of ops) {
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
    if (!o.auto) live.recent.push({ seq: o.seq, t: o.t, label: opLabel(o), retracted: retracted.has(o.seq) });
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
  live.recent = live.recent.slice(-8).reverse();
  return live;
}

const nextSeq = (ops) => ops.reduce((m, o) => Math.max(m, o.seq), 0) + 1;

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
  if (k === "S") {
    const s = mk("S", v);
    const out = [s];
    const auto = AUTO[live.pendingRestart];
    if (live.state === "DEAD" && v !== "DEAD" && auto) out.push(mk("Z", auto[v], { auto: true, src: s.seq }));
    const warning = live.needsRestartBand && v !== "DEAD" ? "Zone de la reprise non indiquée" : undefined;
    return { ops: out, warning };
  }
  if (k === "SH" && v === "GOAL") {
    const g = mk("SH", "GOAL");
    return { ops: [g, mk("S", "DEAD", { auto: true, src: g.seq }), mk("R", "KICKOFF", { auto: true, src: g.seq })] };
  }
  return { ops: [mk(k, v)] };
}

// Match presses (not automatic, not clock/score) per minute over the window.
export function pressesPerMinute(ops, nowT, windowMs) {
  const from = nowT - windowMs;
  const n = ops.filter((o) => MATCH_KINDS.has(o.k) && !o.auto && o.t > from && o.t <= nowT).length;
  return Math.round((n / (windowMs / 60000)) * 10) / 10;
}

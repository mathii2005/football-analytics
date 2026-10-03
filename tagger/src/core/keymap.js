import { MATCH_KEYS } from "./codebook.js";

// Letters and digits are read by physical position (event.code) so the layout
// works on any keyboard; score symbols by the character typed (event.key),
// like the old tagger.
const LETTERS = { KeyQ: "Q", KeyW: "W", KeyE: "E", KeyA: "A", KeyS: "S", KeyD: "D", KeyF: "F",
  KeyZ: "Z", KeyX: "X", KeyC: "C", KeyR: "R", KeyT: "T" };
const SCORE = { "+": "US+1", "=": "US+1", "-": "US-1", "*": "THEM+1", ")": "THEM+1", "_": "THEM-1" };

export function keyToAction(e) {
  if (e.ctrlKey || e.metaKey) {
    if (e.code === "KeyZ") return { type: "undo" };
    if (e.code === "KeyS") return { type: "export" };
    return null;
  }
  if (e.code === "Space") return { type: "clock", op: "toggle" };
  if (e.code === "BracketLeft") return { type: "clock", op: "nudge", ms: e.shiftKey ? -60000 : -10000 };
  if (e.code === "BracketRight") return { type: "clock", op: "nudge", ms: e.shiftKey ? 60000 : 10000 };
  if (e.key === "?") return { type: "help" };
  if (e.code === "Escape") return { type: "escape" };
  if (e.code === "Backspace") return { type: "undo" };
  if (SCORE[e.key]) return { type: "score", v: SCORE[e.key] };
  if (e.code === "KeyM") return { type: "halftime" };

  let name = LETTERS[e.code];
  const digit = /^(Digit|Numpad)([0-9])$/.exec(e.code);
  if (digit) name = digit[2];
  if (!name) return null;
  if (e.shiftKey) name = `Shift+${name}`;
  const m = MATCH_KEYS[name];
  return m ? { type: "op", k: m.k, v: m.v } : null;
}

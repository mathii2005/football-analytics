// Review answers (CODEBOOK §5): reviewed.jsonl is append-only, the latest line
// of a card wins. CANT_SEE is an answer; a missing question is not.
import { CB_VERSION } from "./codebook.js";
import { cardQuestions } from "./cards.js";
import { CODEBOOK as CB } from "./codebook.js";

const CARD_INVALID = new Set(CB.cards.filter((c) => c.invalid_option).map((c) => c.id));

export function latestAnswers(reviewed) {
  const m = new Map();
  for (const line of reviewed) m.set(line.card, line.q);
  return m;
}

export const answerLine = (card, q, wall) => ({ card: card.id, seq: card.seq ?? null, q, at: wall, by: "analyst", cb: CB_VERSION });

// describe: description mode (CODEBOOK §5), every card also needs a free description
export function isAnswered(card, q, { describe = false } = {}) {
  if (!q) return false;
  if (q.invalid && CARD_INVALID.has(card.kind)) return true;     // « erreur de tag »
  const qs = cardQuestions(card.kind, card);
  if (!qs.length) return q.result !== undefined;          // GAP
  if (describe && !q.note?.trim()) return false;
  return qs.every((x) => q[x.id] !== undefined && q[x.id] !== null && q[x.id] !== "");
}

export function coverage(cards, answers, opts) {
  const out = {};
  for (const c of cards) {
    out[c.kind] ??= { answered: 0, total: 0 };
    out[c.kind].total += 1;
    if (isAnswered(c, answers.get(c.id), opts)) out[c.kind].answered += 1;
  }
  return out;
}

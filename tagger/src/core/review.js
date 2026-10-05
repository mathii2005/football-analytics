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

export function isAnswered(card, q) {
  if (!q) return false;
  if (q.invalid && CARD_INVALID.has(card.kind)) return true;     // « pas une entrée »
  const qs = cardQuestions(card.kind);
  if (!qs.length) return q.result !== undefined;          // GAP
  return qs.every((x) => q[x.id] !== undefined && q[x.id] !== null);
}

export function coverage(cards, answers) {
  const out = {};
  for (const c of cards) {
    out[c.kind] ??= { answered: 0, total: 0 };
    out[c.kind].total += 1;
    if (isAnswered(c, answers.get(c.id))) out[c.kind].answered += 1;
  }
  return out;
}

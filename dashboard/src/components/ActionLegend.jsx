// The four dangerous-action types share one fixed colour order across every
// chart (ink, gold-deep, grey, light grey) so a type keeps its colour.
import { ACTION_TYPES, ACTION_LABELS } from "../format.js";

export const ACTION_COLORS = { PASSE_PROF: "var(--ink)", CONDUITE: "var(--gold-deep)", CENTRE: "var(--them)", SWITCH: "#cfcbc3" };
export const ACTION_HEX = { PASSE_PROF: "#0a0a0a", CONDUITE: "#85601a", CENTRE: "#9a968e", SWITCH: "#cfcbc3" };

export default function ActionLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {ACTION_TYPES.map((t) => (
        <span key={t} className="flex items-center gap-1.5">
          <span className="h-2.5 w-3 rounded-sm" style={{ background: ACTION_COLORS[t] }} />{ACTION_LABELS[t]}
        </span>
      ))}
    </div>
  );
}

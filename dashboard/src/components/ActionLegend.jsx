// The four dangerous-action types share one fixed colour order across every
// chart (four ink steps, light to dark by type) so a type keeps its colour;
// gold is not used here because it means "positive / in the box" elsewhere.
import { ACTION_TYPES, ACTION_LABELS } from "../format.js";

export const ACTION_COLORS = { PASSE_PROF: "#0a0a0a", CONDUITE: "#5c5a55", CENTRE: "#a8a49c", SWITCH: "#dcd8d0" };

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

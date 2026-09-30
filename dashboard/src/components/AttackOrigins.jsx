import { COULOIR_LABELS } from "../format.js";

// Dangerous actions by couloir (column) and zone (row), attack upward.
// One-hue gold ramp from white; the count is always printed.
const ROWS = ["BOX", "4", "3", "2", "1"];
const ROW_LABEL = { BOX: "Surf.", 4: "Z4", 3: "Z3", 2: "Z2", 1: "Z1" };

function mix(t) {
  // white -> gold-deep (#85601a)
  const a = [255, 255, 255], b = [133, 96, 26];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
}

export default function AttackOrigins({ grid }) {
  const cols = ["left", "center", "right"];
  const max = Math.max(1, ...cols.flatMap((c) => ROWS.map((r) => grid[c][r])));
  const total = cols.reduce((s, c) => s + ROWS.reduce((t, r) => t + grid[c][r], 0), 0);
  return (
    <div>
      <div className="grid grid-cols-[2.5rem_repeat(3,1fr)] gap-0.5">
        <span />
        {cols.map((c) => <span key={c} className="pb-1 text-center text-xs font-medium uppercase tracking-wider text-ink-3">{COULOIR_LABELS[c]}</span>)}
        {ROWS.map((r) => [
          <span key={r} className="flex items-center text-xs text-ink-3">{ROW_LABEL[r]}</span>,
          ...cols.map((c) => {
            const n = grid[c][r];
            const t = n / max;
            return (
              <div key={c + r} className="flex h-11 items-center justify-center rounded-sm text-sm font-semibold tabular"
                style={{ background: n ? mix(0.15 + 0.85 * t) : "var(--paper-2)", color: t > 0.55 ? "#fff" : "var(--ink)" }}
                title={`${COULOIR_LABELS[c]}, ${ROW_LABEL[r]} : ${n}`}>
                {n || ""}
              </div>
            );
          }),
        ])}
      </div>
      <p className="mt-2 text-xs text-ink-3">{total} actions dangereuses avec couloir tagué.</p>
    </div>
  );
}

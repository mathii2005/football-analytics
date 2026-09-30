import { OUTCOME_LABELS } from "../format.js";

// Heat table: rows = how/where a possession started, columns = how it ended.
// Grey ramp for counts; goal and shot columns tinted gold (positive outcomes).
const COLS = ["goal", "shot", "box_entry", "cheap_loss", "loss_opp_half", "loss_own_half", "ball_out", "unknown"];
const SHORT = { goal: "But", shot: "Tir", box_entry: "Surface", cheap_loss: "Perte < 5 s", loss_opp_half: "Perte leur ½",
  loss_own_half: "Perte notre ½", ball_out: "Sortie", unknown: "?" };

export default function StartOutcomeMatrix({ cells, rowKey, rows }) {
  const get = (r, o) => cells.find((c) => c[rowKey] === r.key && c.outcome === o)?.n ?? 0;
  const max = Math.max(1, ...cells.map((c) => c.n));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-xs tabular">
        <thead>
          <tr className="text-ink-3">
            <th className="pb-2 text-left font-medium" />
            {COLS.map((o) => <th key={o} className="pb-2 font-medium" title={OUTCOME_LABELS[o]}>{SHORT[o]}</th>)}
            <th className="pb-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const total = COLS.reduce((s, o) => s + get(r, o), 0);
            return (
              <tr key={r.key}>
                <td className="py-0.5 pr-3 text-sm text-ink-2">{r.label}</td>
                {COLS.map((o) => {
                  const n = get(r, o), t = n / max;
                  const good = o === "goal" || o === "shot";
                  return (
                    <td key={o} className="p-0.5">
                      <div className="flex h-8 items-center justify-center rounded-sm text-sm font-semibold"
                        title={`${r.label} → ${OUTCOME_LABELS[o]} : ${n}`}
                        style={{ background: n ? (good ? `rgba(133,96,26,${0.2 + 0.8 * t})` : `rgba(10,10,10,${0.08 + 0.8 * t})`) : "var(--paper-2)",
                          color: t > 0.5 ? "#fff" : "var(--ink)" }}>{n || ""}</div>
                    </td>
                  );
                })}
                <td className="pl-2 text-right text-sm text-ink">{total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

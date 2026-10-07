// The match in 15-minute blocks: their xG to the left (blue), ours to the right
// (gold), on one scale; possession and our red-zone entries written beside.
export default function Momentum({ blocks = [] }) {
  if (!blocks.length) return null;
  const max = Math.max(0.05, ...blocks.flatMap((b) => [b.xg.US, b.xg.THEM]));
  const label = (b) => (b.stoppage ? `${b.start_min}+'` : `${b.start_min}–${b.start_min + 15}'`);
  return (
    <div>
      <div className="mb-1 grid grid-cols-[4rem_1fr_1fr_8rem] gap-2 text-[11px] text-ink-3">
        <span /><span className="text-right">xG adverse</span><span>xG Lauréats</span><span className="text-right">possession · entrées</span>
      </div>
      <ul className="space-y-1">
        {blocks.map((b) => (
          <li key={`${b.half}-${b.block}`} className={`grid grid-cols-[4rem_1fr_1fr_8rem] items-center gap-2 text-[12px] ${b.half === 2 && b.block === 0 ? "mt-2 border-t border-rule pt-2" : ""}`}>
            <span className="tabular text-ink-2">{label(b)}</span>
            <span className="flex items-center justify-end gap-1.5">
              <span className="tabular text-ink-3">{b.xg.THEM ? b.xg.THEM.toFixed(2).replace(".", ",") : ""}</span>
              <span className="h-3 rounded-l-[3px]" style={{ width: `${(b.xg.THEM / max) * 100}%`, background: "var(--them)", minWidth: b.xg.THEM ? 2 : 0 }}
                title={`Adversaire : ${b.shots.THEM} tirs, ${b.xg.THEM.toFixed(2)} xG`} />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 rounded-r-[3px]" style={{ width: `${(b.xg.US / max) * 100}%`, background: "var(--us)", minWidth: b.xg.US ? 2 : 0 }}
                title={`Lauréats : ${b.shots.US} tirs, ${b.xg.US.toFixed(2)} xG`} />
              <span className="tabular text-ink-3">{b.xg.US ? b.xg.US.toFixed(2).replace(".", ",") : ""}</span>
            </span>
            <span className="text-right tabular text-ink-2">{b.possession == null ? "" : `${Math.round(b.possession * 100)} %`} · {b.entries}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

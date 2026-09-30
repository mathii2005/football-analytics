import { pct } from "../format.js";

// Share of possessions through each couloir that reached the box / produced a shot.
function RateBar({ value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="hidden h-1.5 w-20 rounded-full bg-line sm:block">
        <div className="h-1.5 rounded-full bg-us" style={{ width: `${(value ?? 0) * 100}%` }} />
      </div>
      <span className="w-9 text-right text-ink tabular">{pct(value)}</span>
    </div>
  );
}

export default function CouloirTable({ couloirs }) {
  const rows = [["left", "Left"], ["center", "Center"], ["right", "Right"]];
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted">
          <th className="pb-2 font-medium">Couloir</th>
          <th className="pb-2 text-right font-medium">n</th>
          <th className="pb-2 pl-4 font-medium">Reached box</th>
          <th className="pb-2 pl-4 font-medium">Shot</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([k, label]) => {
          const r = couloirs[k];
          return (
            <tr key={k} className="border-t border-line">
              <td className="py-2 text-ink">{label}</td>
              <td className="py-2 text-right text-ink tabular">{r.possessions}</td>
              <td className="py-2 pl-4"><RateBar value={r.box_rate} /></td>
              <td className="py-2 pl-4"><RateBar value={r.shot_rate} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

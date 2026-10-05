import StatusChip from "./StatusChip.jsx";
import { fmtValue, subline } from "./format.js";

// A compact table of metrics: label, value, n / coverage / status, season status;
// a row opens its clips.
export default function MetricRows({ ids, metrics, season, openClips }) {
  return (
    <table className="w-full text-[13px]">
      <tbody>
        {ids.filter((id) => metrics[id]).map((id) => {
          const m = metrics[id];
          return (
            <tr key={id} className="border-b border-rule last:border-0">
              <td className="py-1.5 pr-2 text-ink-2">
                <button type="button" className="text-left hover:text-ink hover:underline disabled:no-underline" disabled={!m.clips?.all?.length} onClick={() => openClips(m)}>{m.label_fr}</button>
              </td>
              <td className="py-1.5 pr-2 text-right font-semibold tabular text-ink">{fmtValue(m)}</td>
              <td className="py-1.5 pr-2 text-right text-[11px] text-ink-3">{subline(m)}</td>
              {season && <td className="py-1.5 text-right">{season[id] ? <StatusChip status={season[id].status} /> : null}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

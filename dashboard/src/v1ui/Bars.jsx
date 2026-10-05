import { US, THEM } from "../charts/palette.js";

// Horizontal bars for a small breakdown {key: value}: thin marks, the value
// written in ink next to the bar, keys in a fixed order (never sorted by rank
// so colours and positions stay stable across matches).
export default function Bars({ data, labels = {}, order, format = (v) => v, color = US, compare, compareColor = THEM, empty = "Pas encore de données." }) {
  const keys = (order || Object.keys(data || {})).filter((k) => (data && data[k] != null) || (compare && compare[k] != null));
  if (!keys.length) return <p className="text-sm text-ink-3">{empty}</p>;
  const max = Math.max(...keys.map((k) => Math.max(data?.[k] || 0, compare?.[k] || 0)), 1e-9);
  return (
    <ul className="space-y-2">
      {keys.map((k) => (
        <li key={k} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-2 text-[12px]">
          <span className="truncate text-ink-2">{labels[k] ?? k}</span>
          <span className="space-y-0.5">
            <span className="block h-2.5 rounded-r-[4px]" style={{ width: `${((data?.[k] || 0) / max) * 100}%`, background: color, minWidth: data?.[k] ? 2 : 0 }} title={`${labels[k] ?? k} : ${format(data?.[k] || 0)}`} />
            {compare && <span className="block h-2.5 rounded-r-[4px]" style={{ width: `${((compare[k] || 0) / max) * 100}%`, background: compareColor, minWidth: compare[k] ? 2 : 0 }} title={`${labels[k] ?? k} (adversaire) : ${format(compare[k] || 0)}`} />}
          </span>
          <span className="text-right tabular text-ink">{format(data?.[k] || 0)}{compare ? <span className="block text-ink-3">{format(compare[k] || 0)}</span> : null}</span>
        </li>
      ))}
    </ul>
  );
}

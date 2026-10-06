import { STATUS } from "./format.js";

// Improvement status against the baseline: always an icon + a word, never colour alone.
export default function StatusChip({ status }) {
  const s = STATUS[status];
  if (!s || status === "TROP TÔT") return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      <span aria-hidden="true">{s.icon}</span>{s.label}
    </span>
  );
}

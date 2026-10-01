// A dashboard tile: the title is the question the chart answers, a one-line
// note says how to read it (and n when samples are small).
export default function Tile({ title, note, children, className = "", aside }) {
  return (
    <section className={`min-w-0 rounded-sm border border-rule bg-paper p-3 sm:p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[13px] font-semibold leading-tight text-ink">{title}</h3>
        {aside}
      </div>
      {note && <p className="mt-0.5 text-[11px] leading-snug text-ink-3">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

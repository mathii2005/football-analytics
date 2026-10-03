// A titled block on the white page, separated by a hairline rather than a card.
export default function Section({ title, note, children, className = "", aside }) {
  return (
    <section className={`min-w-0 border-t border-rule pt-5 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="display text-xl font-semibold uppercase tracking-wide text-ink">{title}</h2>
        {aside}
      </div>
      {note && <p className="mt-1 max-w-[70ch] text-sm text-ink-3">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

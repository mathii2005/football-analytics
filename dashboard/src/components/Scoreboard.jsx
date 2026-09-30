// The stadium-board row inside the black band: the few numbers that matter
// for the current tab, in gold. `boardKey` replays the flip when it changes.
export default function Scoreboard({ figures, boardKey }) {
  return (
    <dl className="grid grid-cols-2 border-t border-band-rule sm:grid-cols-3 lg:grid-cols-5">
      {figures.map((f, i) => (
        <div key={f.label} className="min-w-0 border-b border-band-rule px-4 py-4 max-sm:[&:last-child:nth-child(odd)]:col-span-2 sm:px-5 lg:border-b-0 lg:border-l lg:first:border-l-0">
          <dt className="text-xs font-medium uppercase tracking-wider text-band-ink-2">{f.label}</dt>
          <dd className="mt-1 overflow-hidden">
            <span key={boardKey} className="board-in display block text-5xl font-semibold leading-none text-gold tabular"
              style={{ animationDelay: `${i * 45}ms` }}>
              {f.value}
            </span>
          </dd>
          {f.sub && <dd className="mt-1.5 text-xs leading-snug text-band-ink-2 tabular [text-wrap:balance]">{f.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}

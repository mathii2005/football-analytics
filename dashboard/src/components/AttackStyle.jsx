import { pct } from "../format.js";

// Vertical (deep passes + carries) vs lateral (switches + crosses), and
// how one-sided our attacks were between the left and right couloirs.
export default function AttackStyle({ s }) {
  const v = s.vertical_pct ?? 0;
  return (
    <div>
      <div className="flex justify-between text-xs uppercase tracking-wider text-ink-3"><span>Vertical</span><span>Latéral</span></div>
      <div className="mt-1 flex h-5 gap-0.5 overflow-hidden rounded-sm">
        <div className="bg-ink" style={{ width: `${v * 100}%` }} />
        <div className="bg-them" style={{ width: `${(1 - v) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-sm text-ink tabular">
        <span>{s.vertical} · {pct(s.vertical_pct)}</span><span>{s.lateral} · {pct(s.vertical_pct == null ? null : 1 - v)}</span>
      </div>
      {s.lateral === 0 && (
        <p className="mt-2 text-[12px] text-ink-2">0 centre et 0 changement de jeu tagués : ratio non interprétable comme un style.</p>
      )}
      <p className="mt-4 text-sm text-ink-2">
        Asymétrie gauche / droite : <span className="font-semibold text-ink tabular">{pct(s.side_asymmetry)}</span>
        <span className="text-ink-3"> (0 % = équilibré, 100 % = un seul côté)</span>
      </p>
    </div>
  );
}

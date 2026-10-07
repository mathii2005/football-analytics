import { useState } from "react";

// Players page pieces. Counts are "sur le match" until minutes come from the
// lineup; then the cards also show minutes and the per-90 rates.
const short = (p) => (p.name ? p.name.split(" ")[0] : `#${p.num}`);
const dec = (x) => x.toFixed(2).replace(".", ",");
const forward = (p) => p.entries + p.shots + p.assists;

function Bar({ v, max, color = "var(--us)" }) {
  return <span className="block h-1.5 rounded-r-[2px]" style={{ width: `${max ? (v / max) * 100 : 0}%`, background: color, minWidth: v ? 2 : 0 }} />;
}

export function PlayerCards({ players = [] }) {
  const active = players.filter((p) => forward(p) + p.losses + p.first_presses > 0);
  const m = { create: Math.max(...active.map((p) => p.xg + p.xa), 0.01), ent: Math.max(...active.map((p) => p.entries), 1),
              loss: Math.max(...active.map((p) => p.losses), 1), press: Math.max(...active.map((p) => p.first_presses), 1) };
  const rows = (p) => [["Création (xG + xA)", p.xg + p.xa, m.create, dec(p.xg + p.xa), "var(--us)"],
    ["Entrées zone rouge", p.entries, m.ent, p.entries_to_danger ? `${p.entries} (${p.entries_to_danger} dangereuses)` : p.entries, "var(--us)"],
    ["Pertes", p.losses, m.loss, p.losses, "var(--them)"],
    ["1er pressing", p.first_presses, m.press, p.reactions ? `${p.first_presses} (${p.reactions} sur sa propre perte)` : p.first_presses, "var(--us)"]];
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {[...active].sort((a, b) => forward(b) - forward(a)).map((p) => (
        <div key={p.num} className="rounded-sm border border-rule bg-paper p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-ink">{p.name ?? `#${p.num}`}</span>
            <span className="tabular text-[11px] text-ink-3">#{p.num}{p.minutes != null ? ` · ${Math.round(p.minutes)}'` : ""}</span>
          </div>
          <div className="mt-1 text-[11px] text-ink-2">{p.shots} tirs · {p.goals} buts · {p.assists} passes déc.</div>
          <dl className="mt-2 space-y-1.5">
            {rows(p).map(([label, v, max, shown, color]) => (
              <div key={label}>
                <div className="flex justify-between text-[11px]"><dt className="text-ink-3">{label}</dt><dd className="tabular text-ink">{shown}</dd></div>
                <Bar v={v} max={max} color={color} />
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

// x = actions that move us forward (entries + shots + assists), y = losses
export function PlayerScatter({ players = [] }) {
  const pts = players.filter((p) => forward(p) + p.losses > 0);
  if (pts.length < 2) return null;
  const W = 520, H = 300, L = 36, B = 262, R = 500, T = 14;
  const mx = Math.max(...pts.map(forward), 1), my = Math.max(...pts.map((p) => p.losses), 1);
  const x = (v) => L + (v / mx) * (R - L), y = (v) => B - (v / my) * (B - T);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Création et prise de risque par joueur">
      <line x1={L} y1={B} x2={R} y2={B} stroke="var(--rule)" /><line x1={L} y1={T} x2={L} y2={B} stroke="var(--rule)" />
      <line x1={x(mx / 2)} y1={T} x2={x(mx / 2)} y2={B} stroke="var(--rule)" strokeDasharray="3 4" />
      <line x1={L} y1={y(my / 2)} x2={R} y2={y(my / 2)} stroke="var(--rule)" strokeDasharray="3 4" />
      <text x={R} y={B + 22} textAnchor="end" fontSize="11" fill="var(--ink-3)">fait avancer l'équipe (entrées + tirs + passes déc.) →</text>
      <text x={L - 4} y={T + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)" transform={`rotate(-90 ${L - 22} ${T + 60})`}>pertes →</text>
      <text x={R - 4} y={T + 12} textAnchor="end" fontSize="10" fill="var(--ink-3)">porte et risque</text>
      <text x={R - 4} y={B - 6} textAnchor="end" fontSize="10" fill="var(--ink-3)">porte, perd peu</text>
      {pts.map((p) => (
        <g key={p.num}>
          <circle cx={x(forward(p))} cy={y(p.losses)} r={5} fill="var(--us)" stroke="var(--paper)" strokeWidth="1.5">
            <title>{`${p.name ?? "#" + p.num} : ${forward(p)} actions vers l'avant, ${p.losses} pertes`}</title>
          </circle>
          {(forward(p) >= mx * 0.3 || p.losses >= my * 0.5) && <text x={x(forward(p)) + 8} y={y(p.losses) + 4} fontSize="11" fill="var(--ink)">{short(p)}</text>}
        </g>
      ))}
    </svg>
  );
}

export function DuoList({ duos = [], players = [] }) {
  const name = Object.fromEntries(players.map((p) => [p.num, short(p)]));
  if (!duos.length) return null;
  const max = Math.max(...duos.map((d) => d.xg), 0.01);
  return (
    <ul className="space-y-2">
      {duos.slice(0, 6).map((d) => (
        <li key={`${d.from}-${d.to}`} className="grid grid-cols-[1fr_6rem] items-center gap-2 text-[12px]">
          <div>
            <div className="text-ink"><span className="font-semibold">{name[d.from] ?? `#${d.from}`}</span> → <span className="font-semibold">{name[d.to] ?? `#${d.to}`}</span>
              <span className="ml-2 text-ink-3">{d.shots} tir{d.shots > 1 ? "s" : ""}{d.goals ? ` · ${d.goals} but${d.goals > 1 ? "s" : ""}` : ""}</span></div>
            <Bar v={d.xg} max={max} />
          </div>
          <span className="text-right tabular text-ink-2">{dec(d.xg)} xG</span>
        </li>
      ))}
    </ul>
  );
}

const COLS = [["shots", "Tirs"], ["goals", "Buts"], ["xg", "xG"], ["assists", "Passes déc."], ["xa", "xA"], ["entries", "Entrées"],
  ["entries_to_danger", "Entrées dangereuses"], ["losses", "Pertes"], ["first_presses", "1er pressing"], ["reactions", "Réaction perte"], ["set_pieces", "CPA"], ["minutes", "Min."]];
export function PlayerTable({ players = [] }) {
  const [sort, setSort] = useState({ k: "entries", dir: -1 });
  const rows = [...players].sort((a, b) => ((a[sort.k] ?? -1) - (b[sort.k] ?? -1)) * sort.dir);
  const fmt = (k, v) => (v == null ? "·" : ["xg", "xa"].includes(k) ? (v ? dec(v) : "·") : k === "minutes" ? Math.round(v) : v || "·");
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] text-[12px]">
        <thead><tr className="border-b border-rule text-left text-ink-3"><th className="py-1 font-medium">Joueur</th>
          {COLS.map(([k, l]) => <th key={k} className="py-1 text-right font-medium"><button type="button" className="hover:text-ink" onClick={() => setSort((s) => ({ k, dir: s.k === k ? -s.dir : -1 }))}>{l}{sort.k === k ? (sort.dir < 0 ? " ↓" : " ↑") : ""}</button></th>)}</tr></thead>
        <tbody>{rows.map((p) => (
          <tr key={p.num} className="border-b border-rule last:border-0">
            <td className="py-1"><span className="tabular text-ink-3">#{p.num}</span> {p.name ?? ""}</td>
            {COLS.map(([k]) => <td key={k} className={`py-1 text-right tabular ${p[k] ? "text-ink" : "text-ink-3"}`}>{fmt(k, p[k])}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

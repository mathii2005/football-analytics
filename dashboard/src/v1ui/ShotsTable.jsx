import { useState } from "react";
import { clock } from "../format.js";
import { ASSIST_FR, LOC_FR, SITUATION_FR, BODY_FR, SHOT_V_FR, PHASE_FR } from "./format.js";

// Every shot of the match, sortable: time, team, outcome, xG, and what the
// review card says (location, body part, situation, how it was created).
const COLS = [
  ["t", "Temps", (s) => `MT${s.half} · ${clock(s.t)}`, (s) => s.half * 1e8 + s.t],
  ["team", "Équipe", (s) => (s.team === "US" ? "Lauréats" : "Adversaire")],
  ["v", "Issue", (s) => SHOT_V_FR[s.v] ?? s.v],
  ["xg", "xG", (s) => s.xg.toFixed(2), (s) => s.xg],
  ["loc", "Lieu", (s) => LOC_FR[s.loc] ?? "–"],
  ["body", "Corps", (s) => BODY_FR[s.body] ?? "–"],
  ["situation", "Situation", (s) => SITUATION_FR[s.situation] ?? "–"],
  ["assist", "Création", (s) => ASSIST_FR[s.assist] ?? "–"],
  ["phase", "Phase", (s) => PHASE_FR[s.phase] ?? "–"],
];

export default function ShotsTable({ shots }) {
  const [sort, setSort] = useState({ key: "t", dir: 1 });
  const [team, setTeam] = useState("ALL");
  if (!shots?.length) return null;
  const col = COLS.find((c) => c[0] === sort.key);
  const keyOf = col[3] || ((s) => col[2](s));
  const rows = shots.filter((s) => team === "ALL" || s.team === team)
    .sort((a, b) => (keyOf(a) > keyOf(b) ? 1 : keyOf(a) < keyOf(b) ? -1 : 0) * sort.dir);
  return (
    <div>
      <div className="mb-2 flex gap-1 text-[12px]">
        {[["ALL", "Tous"], ["US", "Lauréats"], ["THEM", "Adversaire"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTeam(k)}
            className={`rounded-sm border px-2 py-0.5 ${team === k ? "border-ink bg-ink text-paper" : "border-rule text-ink-2 hover:text-ink"}`}>{l}</button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-[12px]">
          <thead><tr className="border-b border-rule text-left text-ink-3">
            {COLS.map(([k, label]) => (
              <th key={k} className="py-1 pr-2 font-medium">
                <button type="button" className="hover:text-ink" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : 1 }))}>
                  {label}{sort.key === k ? (sort.dir > 0 ? " ↑" : " ↓") : ""}</button>
              </th>
            ))}
          </tr></thead>
          <tbody>{rows.map((s) => (
            <tr key={`${s.half}-${s.t}`} className={`border-b border-rule last:border-0 ${s.v === "GOAL" ? "font-semibold" : ""}`}>
              {COLS.map(([k, , show]) => (
                <td key={k} className={`py-1 pr-2 tabular ${k === "team" ? (s.team === "US" ? "text-[var(--us)]" : "text-[var(--them)]") : "text-ink"}`}>{show(s)}</td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="mt-1 text-[11px] text-ink-3">Cliquer un en-tête pour trier.</p>
    </div>
  );
}

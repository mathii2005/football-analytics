import Pitch, { W, ZONE_Y, BOX } from "../components/Pitch.jsx";
import { inkOn } from "./palette.js";

// Vertical pitch heat at the data's true resolution: 4 zone bands (attack
// up) plus the box inside zone 4. rows: {zone, t (0..1 colour position),
// big (main label), small (second line)}; color(t) maps to a ramp.
const TEXT_Y = { 4: [88, 101], 3: [150, 165], 2: [272, 287], 1: [335, 349] };

export default function BandPitch({ rows, color, onZone, label }) {
  const by = Object.fromEntries(rows.map((r) => [r.zone, r]));
  const click = (z) => (onZone ? { role: "button", tabIndex: 0, className: "cursor-pointer hover:opacity-85 focus:outline-none",
    onClick: () => onZone(z), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") onZone(z); } } : {});
  return (
    <Pitch label={label}>
      {["4", "3", "2", "1"].map((z) => {
        const r = by[z]; if (!r) return null;
        const [y0, y1] = ZONE_Y[z], [ty, sy] = TEXT_Y[z];
        return (
          <g key={z}>
            <rect x={0} y={y0} width={W} height={y1 - y0} fill={color(r.t)} {...click(z)}><title>{`Zone ${z} : ${r.big} ${r.small ?? ""}`}</title></rect>
            <text pointerEvents="none" x={W / 2} y={ty} textAnchor="middle" fontFamily="Barlow Condensed" fontWeight={600} fontSize={26} fill={inkOn(r.t)}>{r.big}</text>
            {r.small && <text pointerEvents="none" x={W / 2} y={sy} textAnchor="middle" fontSize={10} fill={inkOn(r.t)}>{r.small}</text>}
          </g>
        );
      })}
      {by.BOX && (
        <g>
          <rect x={BOX.x} y={0} width={BOX.w} height={BOX.h} fill={color(by.BOX.t)} {...click("BOX")}><title>{`Surface : ${by.BOX.big} ${by.BOX.small ?? ""}`}</title></rect>
          <text pointerEvents="none" x={BOX.x + BOX.w / 2} y={38} textAnchor="middle" fontFamily="Barlow Condensed" fontWeight={600} fontSize={18} fill={inkOn(by.BOX.t)}>{by.BOX.big}</text>
          {by.BOX.small && <text pointerEvents="none" x={BOX.x + BOX.w / 2} y={52} textAnchor="middle" fontSize={9} fill={inkOn(by.BOX.t)}>{by.BOX.small}</text>}
        </g>
      )}
    </Pitch>
  );
}

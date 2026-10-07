import { useRef, useState } from "react";
import { PITCH, GOAL, goalResult } from "../core/points.js";

// Click an exact position. Points are stored as absolute metres (x from our goal
// line, y from the left touchline in our attacking direction). The drawing shows
// the half the team attacks; « Comme à l'écran » turns it round when the footage
// shows the attack going right to left, so the click matches what is seen.
function svgPoint(svg, evt) {
  const p = svg.createSVGPoint();
  p.x = evt.clientX; p.y = evt.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}

const LINE = { fill: "none", stroke: "#6f6c66", strokeWidth: 0.3 };

export function PitchPicker({ team = "US", value, onPick }) {
  const [turned, setTurned] = useState(false);
  const svg = useRef(null);
  // drawing coordinates: always the attacked goal on the right, our attacking direction left -> right
  const attacksRight = team !== "THEM";
  const toAbs = (dx, dy) => {
    let x = dx, y = dy;                                  // dx in 52.5..105, dy 0..68 in the drawing
    if (turned) { x = 157.5 - x; y = PITCH.W - y; }      // turned: the goal is on the left of the drawing
    if (!attacksRight) { x = PITCH.L - x; y = PITCH.W - y; }
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  };
  const toDraw = (p) => {
    let x = p.x, y = p.y;
    if (!attacksRight) { x = PITCH.L - x; y = PITCH.W - y; }
    if (turned) { x = 157.5 - x; y = PITCH.W - y; }
    return { x, y };
  };
  const click = (e) => {
    const p = svgPoint(svg.current, e);
    if (p.x < 52.5 || p.x > 105 || p.y < 0 || p.y > 68) return;
    onPick(toAbs(p.x, p.y));
  };
  const v = value && value !== "CANT_SEE" ? toDraw(value) : null;
  const gx = turned ? 52.5 : 105, dir = turned ? 1 : -1;     // goal line x and the direction into the pitch
  const box = (depth, width) => <rect x={turned ? 52.5 : 105 - depth} y={34 - width / 2} width={depth} height={width} {...LINE} />;
  return (
    <div className="mt-2">
      <svg ref={svg} viewBox="51 -2 56 72" className="h-64 w-auto cursor-crosshair rounded border border-rule bg-[#f4f6f1]" onClick={click} role="img" aria-label="Cliquer la position">
        <rect x={52.5} y={0} width={52.5} height={68} {...LINE} />
        {box(16.5, 40.32)}{box(5.5, 18.32)}
        <circle cx={gx + dir * 11} cy={34} r={0.4} fill="#6f6c66" />
        <path d={turned ? "M 69 26.7 A 9.15 9.15 0 0 1 69 41.3" : "M 88.5 26.7 A 9.15 9.15 0 0 0 88.5 41.3"} {...LINE} />
        <rect x={turned ? 51.3 : 105} y={30.34} width={1.2} height={7.32} fill="#45433f" />
        {[13.84, 24.84, 43.16, 54.16].map((y) => <line key={y} x1={52.5} x2={105} y1={y} y2={y} stroke="#6f6c66" strokeWidth={0.15} strokeDasharray="1 1" />)}
        <text x={turned ? 104 : 53.5} y={3.5} fontSize={2.6} fill="#6f6c66" textAnchor={turned ? "end" : "start"}>{attacksRight ? "on attaque →" : "ils attaquent →"}</text>
        {v && <circle cx={v.x} cy={v.y} r={1.3} fill="#b8862e" stroke="#fff" strokeWidth={0.4} />}
      </svg>
      <div className="mt-1 flex items-center gap-2 text-xs text-ink-3">
        <button type="button" className="btn" onClick={(e) => { e.stopPropagation(); setTurned((t) => !t); }}>↻ Comme à l'écran</button>
        {value && value !== "CANT_SEE" && <span>x {value.x} m · y {value.y} m</span>}
      </div>
    </div>
  );
}

const M = 2.5, TOP = 1.4;   // margin around the frame for misses (metres)
const RESULT_FR = { ON_TARGET: "Cadré", WIDE_LEFT: "À côté (gauche)", WIDE_RIGHT: "À côté (droite)", OVER: "Au-dessus", BLOCKED: "Contré" };

export function GoalPicker({ value, onPick }) {
  const svg = useRef(null);
  const click = (e) => {
    const p = svgPoint(svg.current, e);                  // drawing: x = gy, y = height from the top of the view
    const gy = Math.round(p.x * 100) / 100, gz = Math.round((GOAL.H + TOP - p.y) * 100) / 100;
    if (gz < 0) return;
    onPick({ gy, gz });
  };
  const v = value && value !== "CANT_SEE" && !value.blocked ? value : null;
  const res = value && value !== "CANT_SEE" ? goalResult(value) : null;
  return (
    <div className="mt-2">
      <svg ref={svg} viewBox={`${-M} 0 ${GOAL.W + 2 * M} ${GOAL.H + TOP + 0.3}`} className="h-36 w-auto cursor-crosshair rounded border border-rule bg-[#f4f6f1]" onClick={click} role="img" aria-label="Cliquer où va le tir">
        <line x1={-M} x2={GOAL.W + M} y1={GOAL.H + TOP} y2={GOAL.H + TOP} stroke="#6f6c66" strokeWidth={0.04} />
        <rect x={0} y={TOP} width={GOAL.W} height={GOAL.H} fill="#fff" stroke="#45433f" strokeWidth={0.12} />
        {[1, 2].map((i) => <line key={i} x1={(GOAL.W * i) / 3} x2={(GOAL.W * i) / 3} y1={TOP} y2={TOP + GOAL.H} stroke="#e5e3de" strokeWidth={0.03} />)}
        <line x1={0} x2={GOAL.W} y1={TOP + GOAL.H / 2} y2={TOP + GOAL.H / 2} stroke="#e5e3de" strokeWidth={0.03} />
        <text x={0} y={TOP - 0.25} fontSize={0.38} fill="#6f6c66">vu du tireur</text>
        {v && <circle cx={v.gy} cy={GOAL.H + TOP - v.gz} r={0.18} fill="#b8862e" stroke="#fff" strokeWidth={0.05} />}
      </svg>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <button type="button" className={`btn ${value?.blocked ? "btn-primary" : ""}`} onClick={(e) => { e.stopPropagation(); onPick({ blocked: true }); }}>Contré</button>
        {res && <span className="rounded bg-paper-2 px-2 py-1 font-semibold">{RESULT_FR[res]}</span>}
      </div>
    </div>
  );
}

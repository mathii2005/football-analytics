// Our own pitch, drawn on the tagger's grid (CODEBOOK §1): 6 depth bands x 5 lanes
// from the pitch markings, our attack left to right, left lane at the top.
// Coordinates in metres on a 105 x 68 pitch; open-source pitch kits assume x/y
// events, our data is zonal, so the zones are the drawing.
const W = 105, H = 68;
const LANE_Y = { L: [0, 13.84], HS_L: [13.84, 24.84], C: [24.84, 43.16], HS_R: [43.16, 54.16], R: [54.16, 68] };
const BOX_LANES = new Set(["HS_L", "C", "HS_R"]);

// the rectangle of a (band, lane) cell; null when the cell does not exist (wide lanes in a box)
export function cell(band, lane) {
  const [y0, y1] = LANE_Y[lane];
  const inBox = BOX_LANES.has(lane);
  const x = { 0: inBox ? [0, 16.5] : null, 1: inBox ? [16.5, 26.25] : [0, 26.25], 2: [26.25, 52.5], 3: [52.5, 78.75],
              4: inBox ? [78.75, 88.5] : [78.75, 105], 5: inBox ? [88.5, 105] : null }[band];
  return x ? { x: x[0], y: y0, w: x[1] - x[0], h: y1 - y0 } : null;
}

export function PitchLines({ half = false }) {
  const s = { fill: "none", stroke: "var(--ink-3)", strokeWidth: 0.35, opacity: 0.7 };
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} {...s} />
      {!half && <line x1={52.5} y1={0} x2={52.5} y2={H} {...s} />}
      {!half && <circle cx={52.5} cy={34} r={9.15} {...s} />}
      {[0, 1].map((side) => {
        const x0 = side ? W - 16.5 : 0, x6 = side ? W - 5.5 : 0;
        return (
          <g key={side}>
            <rect x={x0} y={13.84} width={16.5} height={40.32} {...s} />
            <rect x={x6} y={24.84} width={5.5} height={18.32} {...s} />
            <rect x={side ? W : -1.5} y={30.34} width={1.5} height={7.32} {...s} />
          </g>
        );
      })}
    </g>
  );
}

// values: {"HS_L:4": n} or {"*:3": n} for a whole band. Colour = team, opacity = value / max.
export function PitchGrid({ values = {}, bands = [0, 1, 2, 3, 4, 5], team = "us", format = (v) => v, title }) {
  const color = team === "us" ? "var(--us)" : "var(--them)";
  const lanes = Object.keys(LANE_Y);
  const val = (b, l) => values[`${l}:${b}`] ?? values[`*:${b}`] ?? 0;
  const max = Math.max(1e-9, ...bands.flatMap((b) => lanes.map((l) => val(b, l))));
  const x0 = Math.min(...bands.map((b) => Math.min(...lanes.map((l) => cell(b, l)?.x ?? 999))));
  const half = x0 >= 52.5;
  return (
    <svg viewBox={`${half ? 50 : -2} -2 ${half ? 57 : 109} 72`} className={half ? "mx-auto block h-[300px] w-auto max-w-full" : "h-auto w-full"} role="img" aria-label={title}>
      {bands.flatMap((b) => lanes.map((l) => {
        const c = cell(b, l);
        if (!c) return null;
        const v = val(b, l), whole = values[`*:${b}`] !== undefined;
        const showText = v && (!whole || l === "C" || (b !== 5 && b !== 0 && l === "C"));
        return (
          <g key={`${b}${l}`}>
            <rect x={c.x} y={c.y} width={c.w} height={c.h} fill={color} fillOpacity={v ? 0.12 + 0.78 * (v / max) : 0.03}
              stroke="var(--paper)" strokeWidth={0.4}><title>{`Zone ${b} · ${l} : ${format(v)}`}</title></rect>
            {showText && <text x={c.x + c.w / 2} y={c.y + c.h / 2 + 1.6} textAnchor="middle" fontSize={4.4} fontWeight={700}
              fill={v / max > 0.55 ? "var(--paper)" : "var(--ink)"}>{format(v)}</text>}
          </g>
        );
      }))}
      <PitchLines half={half} />
      <text x={half ? 103 : 103} y={71} textAnchor="end" fontSize={3} fill="var(--ink-3)">sens de l'attaque →</text>
    </svg>
  );
}

// Shot zones on the attacking half: count (big) and xG (small) per zone, goals as dots.
const SHOT_ZONES = {
  SIX: [[99.5, 24.84, 5.5, 18.32]],
  CENTRAL_BOX: [[88.5, 24.84, 11, 18.32]],
  WIDE_BOX: [[88.5, 13.84, 16.5, 11], [88.5, 43.16, 16.5, 11]],
  CENTRAL_OUT: [[75, 13.84, 13.5, 40.32]],
  WIDE_OUT: [[75, 0, 30, 13.84], [75, 54.16, 30, 13.84]],
};
export function ShotZoneMap({ shots = [], team = "US", title }) {
  const color = team === "US" ? "var(--us)" : "var(--them)";
  const mine = shots.filter((s) => s.team === team);
  const by = Object.fromEntries(Object.keys(SHOT_ZONES).map((z) => {
    const sel = mine.filter((s) => s.loc === z);
    return [z, { n: sel.length, xg: sel.reduce((a, s) => a + s.xg, 0), goals: sel.filter((s) => s.v === "GOAL").length }];
  }));
  const max = Math.max(1, ...Object.values(by).map((z) => z.n));
  return (
    <svg viewBox="70 -2 37 72" className="mx-auto block h-[320px] w-auto max-w-full" role="img" aria-label={title}>
      {Object.entries(SHOT_ZONES).map(([z, rects]) => rects.map(([x, y, w, h], i) => {
        const d = by[z];
        return (
          <g key={`${z}${i}`}>
            <rect x={x} y={y} width={w} height={h} fill={color} fillOpacity={d.n ? 0.12 + 0.78 * (d.n / max) : 0.03} stroke="var(--paper)" strokeWidth={0.4}>
              <title>{`${z} : ${d.n} tirs, ${d.xg.toFixed(2)} xG, ${d.goals} buts`}</title>
            </rect>
            {i === 0 && d.n > 0 && (
              <g fill={d.n / max > 0.55 ? "var(--paper)" : "var(--ink)"} textAnchor="middle">
                <text x={x + w / 2} y={y + h / 2 + 0.6} fontSize={z === "SIX" ? 3.6 : 4.6} fontWeight={700}>{d.n}</text>
                {z !== "SIX" && <text x={x + w / 2} y={y + h / 2 + 4.4} fontSize={2.4}>{d.xg.toFixed(2).replace(".", ",")} xG</text>}
              </g>
            )}
            {i === 0 && Array.from({ length: d.goals }).map((_, g) => (
              <circle key={g} cx={x + 1.6 + g * 2.2} cy={y + 1.8} r={0.9} fill="var(--gold)" stroke="var(--paper)" strokeWidth={0.3} />
            ))}
          </g>
        );
      }))}
      <PitchLines half />
    </svg>
  );
}

// Set-piece deliveries on their box: where the ball was sent, how many, first contact won.
const DELIVERY_AT = { SHORT: [101, 6], NEAR: [100, 27], CENTRAL: [94, 34], FAR: [100, 41], EDGE: [86, 34], DIRECT: [103.5, 34] };
const DELIVERY_FR = { SHORT: "Courte", NEAR: "1er poteau", CENTRAL: "Axe", FAR: "2e poteau", EDGE: "Entrée de surface", DIRECT: "Tir direct" };
export function DeliveryMap({ deliveries = {}, team = "us" }) {
  const color = team === "us" ? "var(--us)" : "var(--them)";
  const max = Math.max(1, ...Object.values(deliveries).map((d) => d.n));
  return (
    <svg viewBox="70 -2 37 72" className="mx-auto block h-[320px] w-auto max-w-full" role="img" aria-label="Livraison des coups de pied arrêtés">
      <PitchLines half />
      {Object.entries(deliveries).map(([k, d]) => {
        const [x, y] = DELIVERY_AT[k] || [95, 34];
        return (
          <g key={k}>
            <circle cx={x} cy={y} r={1.6 + 2.6 * (d.n / max)} fill={color} fillOpacity={0.85} stroke="var(--paper)" strokeWidth={0.4}>
              <title>{`${DELIVERY_FR[k] ?? k} : ${d.n}, premier contact gagné ${d.won}`}</title>
            </circle>
            <text x={x} y={y + 0.9} textAnchor="middle" fontSize={2.6} fontWeight={700} fill="var(--paper)">{d.n}</text>
            <text x={x - 4.5} y={y + 0.9} textAnchor="end" fontSize={2.2} fill="var(--ink-2)">{DELIVERY_FR[k] ?? k}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Our own pitch, drawn on the tagger's grid (CODEBOOK §1): 6 depth bands x 5 lanes
// from the pitch markings, our attack left to right, left lane at the top.
// Coordinates in metres on a 105 x 68 pitch; open-source pitch kits assume x/y
// events, our data is zonal, so the zones are the drawing.
const W = 105, H = 68;
const LANE_Y = { L: [0, 13.84], HS_L: [13.84, 24.84], C: [24.84, 43.16], HS_R: [43.16, 54.16], R: [54.16, 68] };
const BOX_LANES = new Set(["HS_L", "C", "HS_R"]);
const BAND_FR = { 0: "Notre surface", 1: "Zone 1", 2: "Zone 2", 3: "Zone 3", 4: "Zone 4", 5: "Surface" };
const LANE_FR = { L: "Gauche", HS_L: "Int. gauche", C: "Axe", HS_R: "Int. droit", R: "Droite" };

// the rectangle of a (band, lane) cell; null when the cell does not exist (wide lanes in a box)
export function cell(band, lane) {
  const [y0, y1] = LANE_Y[lane];
  const inBox = BOX_LANES.has(lane);
  const x = { 0: inBox ? [0, 16.5] : null, 1: inBox ? [16.5, 26.25] : [0, 26.25], 2: [26.25, 52.5], 3: [52.5, 78.75],
              4: inBox ? [78.75, 88.5] : [78.75, 105], 5: inBox ? [88.5, 105] : null }[band];
  return x ? { x: x[0], y: y0, w: x[1] - x[0], h: y1 - y0 } : null;
}

const YD = 0.9144;
const YARDS = [10, 20, 30, 40, 50];

// dashed lines every 10 yards from a goal line, labelled « 10 v » (verges)
function YardLines({ goalX, dir }) {
  return (
    <g>
      {YARDS.map((yd) => {
        const x = goalX + dir * yd * YD;
        return (
          <g key={yd}>
            <line x1={x} x2={x} y1={0} y2={H} stroke="var(--ink-3)" strokeWidth={0.18} strokeDasharray="0.8 0.8" opacity={0.6} />
            <text x={x} y={H + 2.6} textAnchor="middle" fontSize={1.9} fill="var(--ink-3)">{yd} v</text>
          </g>
        );
      })}
    </g>
  );
}

export function PitchLines({ half = false }) {
  const s = { fill: "none", stroke: "var(--ink-3)", strokeWidth: 0.35, opacity: 0.7 };
  return (
    <g>
      <YardLines goalX={W} dir={-1} />
      {!half && <YardLines goalX={0} dir={1} />}
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
  const bandX = (b) => { const cs = lanes.map((l) => cell(b, l)).filter(Boolean); const lo = Math.min(...cs.map((c) => c.x)), hi = Math.max(...cs.map((c) => c.x + c.w)); return (lo + hi) / 2; };
  return (
    <svg viewBox={`${half ? 38 : -14} -7 ${half ? 69 : 121} 83`} className={half ? "mx-auto block h-[340px] w-auto max-w-full" : "h-auto w-full"} role="img" aria-label={title}>
      {bands.map((b) => <text key={`b${b}`} x={b === 4 ? 83.6 : bandX(b)} y={-2.4} textAnchor="middle" fontSize={2.8} fontWeight={600} fill="var(--ink-2)">{BAND_FR[b]}</text>)}
      {lanes.map((l) => <text key={`l${l}`} x={(half ? 52.5 : 0) - 1.2} y={(LANE_Y[l][0] + LANE_Y[l][1]) / 2 + 1} textAnchor="end" fontSize={2.5} fill="var(--ink-2)">{LANE_FR[l]}</text>)}
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
      <text x={103} y={75} textAnchor="end" fontSize={2.6} fill="var(--ink-3)">sens de l'attaque →</text>
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
const ZONE_FR = { SIX: "6 m", CENTRAL_BOX: "Surface, axe", WIDE_BOX: "Surface, intérieur", CENTRAL_OUT: "Hors surface, axe", WIDE_OUT: "Hors surface, côté" };
export function ShotZoneMap({ shots = [], team = "US", title }) {
  const color = team === "US" ? "var(--us)" : "var(--them)";
  const mine = shots.filter((s) => s.team === team);
  const dots = mine.filter((s) => s.pos);
  const by = Object.fromEntries(Object.keys(SHOT_ZONES).map((z) => {
    const sel = mine.filter((s) => s.loc === z);
    return [z, { n: sel.length, xg: sel.reduce((a, s) => a + s.xg, 0), goals: sel.filter((s) => s.v === "GOAL").length }];
  }));
  const max = Math.max(1, ...Object.values(by).map((z) => z.n));
  return (
    <div>
    <svg viewBox="68 -2 39 75" className="mx-auto block h-[370px] w-auto max-w-full" role="img" aria-label={title}>
      {Object.entries(SHOT_ZONES).map(([z, rects]) => rects.map(([x, y, w, h], i) => {
        const d = by[z];
        const shade = dots.length ? 0.04 + 0.3 * (d.n / max) : 0.12 + 0.78 * (d.n / max);
        return (
          <g key={`${z}${i}`}>
            <rect x={x} y={y} width={w} height={h} fill={color} fillOpacity={d.n ? shade : 0.03} stroke="var(--paper)" strokeWidth={0.4}>
              <title>{`${z} : ${d.n} tirs, ${d.xg.toFixed(2)} xG, ${d.goals} buts`}</title>
            </rect>
            {z !== "SIX" && (i === 0 || z === "WIDE_OUT" || z === "WIDE_BOX") && <text x={x + 0.8} y={y + (z === "WIDE_OUT" && i === 1 ? h - 1 : 2.6)} fontSize={1.9} fill="var(--ink-2)">{ZONE_FR[z]}</text>}
            {i === 0 && d.n > 0 && !dots.length && (
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
      {dots.map((s) => (
        <circle key={`${s.half}-${s.t}`} cx={s.pos.x} cy={s.pos.y} r={0.7 + 2.6 * Math.sqrt(s.xg)}
          fill={s.v === "GOAL" ? "var(--gold)" : color} fillOpacity={s.v === "GOAL" ? 1 : 0.8} stroke={s.v === "GOAL" ? "var(--ink)" : "var(--paper)"} strokeWidth={0.3}>
          <title>{`${s.v === "GOAL" ? "But" : s.v === "ON" ? "Cadré" : "Non cadré"} · xG ${s.xg.toFixed(2)}`}</title>
        </circle>
      ))}
    </svg>
    <p className="mt-1 text-center text-[11px] text-ink-3">{dots.length ? `${dots.length} tirs placés · taille = xG · doré = but` : "Couleur = nombre de tirs ; chiffre = tirs, xG dessous ; points dorés = buts"}</p>
    </div>
  );
}

// Set-piece deliveries on their box: where the ball was sent, how many, first contact won.
const DELIVERY_AT = { SHORT: [101, 6], NEAR: [100, 27], CENTRAL: [94, 34], FAR: [100, 41], EDGE: [86, 34], DIRECT: [103.5, 34] };
const DELIVERY_FR = { SHORT: "Courte", NEAR: "1er poteau", CENTRAL: "Axe", FAR: "2e poteau", EDGE: "Entrée de surface", DIRECT: "Tir direct" };
export function DeliveryMap({ deliveries = {}, team = "us" }) {
  const color = team === "us" ? "var(--us)" : "var(--them)";
  const max = Math.max(1, ...Object.values(deliveries).map((d) => d.n));
  return (
    <svg viewBox="68 -2 39 75" className="mx-auto block h-[330px] w-auto max-w-full" role="img" aria-label="Livraison des coups de pied arrêtés">
      <PitchLines half />
      {Object.values(deliveries).flatMap((d) => d.points || []).map((p, i) => (
        <circle key={`p${i}`} cx={p.x} cy={p.y} r={1} fill={p.won ? color : "var(--paper)"} stroke={color} strokeWidth={0.4}>
          <title>{p.won ? "Premier contact gagné" : "Premier contact perdu"}</title>
        </circle>
      ))}
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

// Exact positions answered in the review (clicks on a drawing). Pitch points are
// absolute metres on a 105 x 68 pitch: x from our goal line, y from the left
// touchline in our attacking direction. The goal view is seen from the shooter:
// gy from the left post (0 .. 7.32), gz height (0 .. 2.44); outside = a miss.
export const PITCH = { L: 105, W: 68 };
export const GOAL = { W: 7.32, H: 2.44 };

// the point seen from the shooter's attacking direction (their shots attack our goal)
export const toShooter = (p, team) => (team === "THEM" ? { x: PITCH.L - p.x, y: PITCH.W - p.y } : { x: p.x, y: p.y });

export function locFromPoint(p, team) {
  const { x, y } = toShooter(p, team);
  const inBoxWidth = y >= 13.84 && y <= 54.16, central = y >= 24.84 && y <= 43.16;
  if (x >= 99.5 && central) return "SIX";
  if (x >= 88.5 && inBoxWidth) return central ? "CENTRAL_BOX" : "WIDE_BOX";
  return inBoxWidth ? "CENTRAL_OUT" : "WIDE_OUT";
}

export function goalResult(g) {
  if (!g || g === "CANT_SEE") return null;
  if (g.blocked) return "BLOCKED";
  if (g.gz > GOAL.H) return "OVER";
  if (g.gy < 0) return "WIDE_LEFT";
  if (g.gy > GOAL.W) return "WIDE_RIGHT";
  return "ON_TARGET";
}

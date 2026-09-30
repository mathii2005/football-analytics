export const pct = (x, digits = 0) => (x == null ? "–" : `${(x * 100).toFixed(digits)}%`);

export const seconds = (ms) => (ms == null ? "–" : `${(ms / 1000).toFixed(1)}s`);

export function clock(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export const OUTCOME_LABELS = {
  goal: "Goal",
  shot: "Shot",
  box_entry: "Box entry",
  cheap_loss: "Cheap loss (<5s)",
  loss_opp_half: "Lost in their half",
  loss_own_half: "Lost in our half",
  ball_out: "Ball out / their restart",
  unknown: "Unknown end",
};

export const ZONE_LABELS = { 1: "Zone 1 (own)", 2: "Zone 2", 3: "Zone 3", 4: "Zone 4 (final)", BOX: "Their box" };

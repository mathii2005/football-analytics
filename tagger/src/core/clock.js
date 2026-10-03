// Manual stopwatch, kept as plain data so it survives a reload.
// `now` is wall-clock milliseconds (Date.now()).
const HALF2 = 2_700_000;

export const newClock = () => ({ half: 1, running: false, elapsedMs: 0, startedAt: null });
const floor = (c) => (c.half === 2 ? HALF2 : 0);

export const clockMs = (c, now) => (c.running ? c.elapsedMs + (now - c.startedAt) : c.elapsedMs);
export const startClock = (c, now) => (c.running ? c : { ...c, running: true, startedAt: now });
export const pauseClock = (c, now) => (c.running ? { ...c, running: false, elapsedMs: clockMs(c, now), startedAt: null } : c);

export function nudgeClock(c, deltaMs, now) {
  const target = Math.max(floor(c), clockMs(c, now) + deltaMs);
  return c.running ? { ...c, elapsedMs: target, startedAt: now } : { ...c, elapsedMs: target };
}

export const halfTime = (c, now) => ({ ...pauseClock(c, now), half: 2, elapsedMs: HALF2 });

export function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

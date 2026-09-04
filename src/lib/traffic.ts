/**
 * ROAD TRAFFIC MATHS — pure, and deliberately free of three.js.
 *
 * Every vehicle position on the carriageway is a FUNCTION OF THE CLOCK and
 * nothing else: no integration, no per-frame state, no proximity tests. That is
 * not a style preference. The clock here is the scroll, so scrubbing back up
 * has to run the street backwards exactly, and anything that accumulated state
 * between frames would smear instead of reversing.
 *
 * It also means "no vehicle ever collides" is a property that can be CHECKED
 * rather than hoped for — see traffic.check.ts, which sweeps the clock and
 * asserts it. That check is the reason this lives in its own file instead of
 * inline in the scene: a test of a copy of the formula is worth nothing.
 */
export type Lane = { z: number; dir: 1 | -1; speed: number; n: number; kind: 0 | 1 };

/** Wrap length. 150 against a 200-unit road, so a car reappearing at the far
 *  end does so ~75 units out, where the fog has already taken it. */
export const WRAP = 150;

const wrapX = (raw: number) => (((raw % WRAP) + WRAP) % WRAP) - WRAP / 2;
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Car `j` of a lane. Every car in a lane shares that lane's speed and sits at a
 * fixed fraction of the wrap, so the headway between them is a CONSTANT and two
 * of them cannot occupy the same point however far the visitor scrolls. Speed
 * differs between lanes, not within one — which is what lane discipline looks
 * like, and is also the only arrangement where "different speeds" and "never
 * collide" are both true without running a simulation.
 */
export const laneX = (L: Lane, j: number, clk: number) =>
  wrapX(clk * L.speed * L.dir + (j / L.n) * WRAP);

/** Fully out in the fast lane within this many units of a slow car. */
export const OVT_IN = 6;
/** Fully tucked back into the slow lane beyond this many. */
export const OVT_OUT = 14;

/**
 * THE OVERTAKER. One car that pulls out, passes the slow lane and tucks back
 * in. Its safety is arithmetic, in two halves:
 *
 * FAST LANE — it travels at EXACTLY the fast lane's speed, so its offset from
 * every car in that lane is constant for all time, and its phase is set to half
 * that lane's headway: it sits permanently in the middle of a gap. It can enter
 * that lane at any moment, for any duration, with the same clearance at both
 * ends. This is why there is no gap-check anywhere in this function.
 *
 * SLOW LANE — being quicker, it repeatedly catches slow cars, and that closing
 * IS the overtake. `d` is its distance within the slow lane's repeating
 * pattern, so d = 0 is exactly alongside a slow car. The lateral blend is a
 * bump on d: out by OVT_IN, back by OVT_OUT. It is therefore already clear of
 * the lane before it is within OVT_IN of anything, and the only point where `d`
 * is discontinuous is the midpoint between two slow cars, where the blend has
 * been flat at zero for a comfortable margin either side.
 *
 * Mid-transit it sits half a lane off both centrelines, which is clear of both.
 */
export function overtaker(slow: Lane, fast: Lane, clk: number) {
  const H0 = WRAP / slow.n;
  const PHASE = WRAP / fast.n / 2;
  const zAt = (c: number) => {
    const raw = c * fast.speed + PHASE;
    const rel = (((raw - c * slow.speed) % H0) + H0) % H0;
    const d = Math.abs(rel > H0 / 2 ? rel - H0 : rel);
    const u = 1 - ease(clamp01((d - OVT_IN) / (OVT_OUT - OVT_IN)));
    return slow.z + (fast.z - slow.z) * u;
  };
  const z = zAt(clk);
  // Heading from the path's own tangent, sampled a hair ahead, so it steers
  // into the lane change and straightens out of it instead of crabbing across.
  const EPS = 0.05;
  return { x: wrapX(clk * fast.speed + PHASE), z, yaw: Math.atan2(-(zAt(clk + EPS) - z), fast.speed * EPS) };
}

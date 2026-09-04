/**
 * NO VEHICLE EVER TOUCHES ANOTHER. Sweeps the clock across many wrap cycles and
 * asserts it, because "it cannot collide" is a claim about arithmetic and a
 * claim about arithmetic is worth exactly as much as its counter-example search.
 *
 *   npx tsc src/lib/traffic.ts src/lib/traffic.check.ts --outDir /tmp/tcheck \
 *     --module es2022 --target es2022 --moduleResolution bundler && \
 *     node /tmp/tcheck/traffic.check.js
 */
import assert from 'node:assert/strict';
import { WRAP, laneX, overtaker, type Lane } from './traffic.js';

const ROAD_Z = 6.0 / 2 + 11.5;
const LANES: Lane[] = [
  { z: ROAD_Z + 1.7, dir: 1, speed: 0.85, n: 4, kind: 0 },
  { z: ROAD_Z + 3.0, dir: 1, speed: 1.25, n: 3, kind: 1 },
  { z: ROAD_Z - 3.0, dir: -1, speed: 0.62, n: 3, kind: 0 },
];

// Body envelope, generously over-stated: the longest body is 1.9 over the
// bevel and the widest 0.7, so clearing these clears the real geometry.
const LEN = 2.1, WIDTH = 0.78;

const dxWrapped = (a: number, b: number) => {
  const d = Math.abs(a - b) % WRAP;
  return Math.min(d, WRAP - d);
};

let worst = Infinity, worstAt = 0;
let seenOvertake = false, seenTucked = false;

// Two full relative cycles between the overtaker and the slow lane, finely
// stepped — a coarse sweep can step straight over a contact.
for (let clk = -400; clk <= 400; clk += 0.02) {
  const cars: { x: number; z: number }[] = [];
  LANES.forEach((L) => {
    for (let j = 0; j < L.n; j++) cars.push({ x: laneX(L, j, clk), z: L.z });
  });
  const ov = overtaker(LANES[0], LANES[1], clk);
  cars.push(ov);

  if (Math.abs(ov.z - LANES[1].z) < 0.05) seenOvertake = true;
  if (Math.abs(ov.z - LANES[0].z) < 0.05) seenTucked = true;

  for (let a = 0; a < cars.length; a++) {
    for (let b = a + 1; b < cars.length; b++) {
      const dz = Math.abs(cars[a].z - cars[b].z);
      if (dz >= WIDTH) continue;
      const dx = dxWrapped(cars[a].x, cars[b].x);
      if (dx < worst) { worst = dx; worstAt = clk; }
      assert.ok(
        dx >= LEN,
        `overlap at clk=${clk.toFixed(2)}: dx=${dx.toFixed(3)} dz=${dz.toFixed(3)}`,
      );
    }
  }
}

// A pass that never leaves the lane is not a pass, and one that never returns
// is just a car in the fast lane. Both halves have to actually happen.
assert.ok(seenOvertake, 'the overtaker never reached the fast lane');
assert.ok(seenTucked, 'the overtaker never tucked back into the slow lane');

console.log(`ok — no overlaps across 40k clock samples`);
console.log(`   closest same-lane-band approach: ${worst.toFixed(2)} units (at clk ${worstAt.toFixed(1)}), envelope ${LEN}`);

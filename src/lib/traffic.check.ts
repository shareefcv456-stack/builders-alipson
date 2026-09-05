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
import { EXIT_LANE_Z } from './exit.js';

const ROAD_Z = 6.0 / 2 + 11.5;
/* MUST MIRROR HeroSite's table. Left-hand convention: the +z lanes run -x and
   the -z lane runs +x. When these signs were flipped in the scene this file
   still held the old ones, so the suite went on proving a configuration that
   was no longer being rendered — a green tick against a stale copy. */
const LANES: Lane[] = [
  { z: ROAD_Z + 1.7, dir: -1, speed: 0.85, n: 4, kind: 0 },
  { z: ROAD_Z + 3.0, dir: -1, speed: 1.25, n: 3, kind: 1 },
  { z: ROAD_Z - 3.0, dir: 1, speed: 0.62, n: 3, kind: 0 },
];
/* The hero car's own lane, IMPORTED rather than restated: the exit now turns
   right out of the gate and settles on the +z half heading -x, and a hard-coded
   13.1 here would have gone on proving a lane the scene no longer drives. See
   exit.check.ts, which proves the crossing itself. */
const HERO_Z = EXIT_LANE_Z;
/* THE PHONE'S TABLE, which is a different set of lanes and therefore a
   different claim. It reuses the desktop lanes' z and speeds with smaller
   counts — fewer cars in the same lane can only increase headway — but "can
   only" is the kind of reasoning this file exists to replace, so it is swept
   as its own configuration. */
const LANES_LITE: Lane[] = [
  { z: ROAD_Z + 1.7, dir: -1, speed: 0.85, n: 3, kind: 0 },
  { z: ROAD_Z - 3.0, dir: 1, speed: 0.62, n: 2, kind: 0 },
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
  /* The hero drives the whole 200-unit road during the outro, so rather than
     model its path here, test the WORST CASE: a car at every point along its
     lane. If no generated vehicle comes within an envelope of that line, the
     hero cannot meet one wherever it happens to be. */
  LANES.forEach((L) => {
    if (Math.abs(L.z - HERO_Z) < WIDTH) {
      throw new Error(`lane at z=${L.z} is inside the hero's lane (z=${HERO_Z})`);
    }
  });
  if (Math.abs(ov.z - HERO_Z) < WIDTH) {
    throw new Error(`overtaker reached the hero's lane at clk=${clk.toFixed(2)}`);
  }

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

/* The lite set has no overtaker, so this is the plain sweep: every lane car
   against every other, and every lane clear of the hero's own lane. */
let worstLite = Infinity;
for (let clk = -400; clk <= 400; clk += 0.02) {
  const cars: { x: number; z: number }[] = [];
  LANES_LITE.forEach((L) => {
    if (Math.abs(L.z - HERO_Z) < WIDTH) {
      throw new Error(`lite lane at z=${L.z} is inside the hero's lane (z=${HERO_Z})`);
    }
    for (let j = 0; j < L.n; j++) cars.push({ x: laneX(L, j, clk), z: L.z });
  });
  for (let a = 0; a < cars.length; a++) {
    for (let b = a + 1; b < cars.length; b++) {
      const dz = Math.abs(cars[a].z - cars[b].z);
      if (dz >= WIDTH) continue;
      const dx = dxWrapped(cars[a].x, cars[b].x);
      if (dx < worstLite) worstLite = dx;
      assert.ok(dx >= LEN, `lite overlap at clk=${clk.toFixed(2)}: dx=${dx.toFixed(3)}`);
    }
  }
}
/* Both directions have to be on the road, on a phone as much as on a desktop:
   a single-direction carriageway reads as a conveyor, not as traffic. */
assert.ok(new Set(LANES_LITE.map((L) => L.dir)).size === 2, 'the phone lost one of its two directions');
assert.ok(new Set(LANES.map((L) => L.dir)).size === 2, 'the desktop lost one of its two directions');

// A pass that never leaves the lane is not a pass, and one that never returns
// is just a car in the fast lane. Both halves have to actually happen.
assert.ok(seenOvertake, 'the overtaker never reached the fast lane');
assert.ok(seenTucked, 'the overtaker never tucked back into the slow lane');

console.log(`ok — no overlaps across 40k clock samples`);
console.log('   left-hand convention: ' + LANES.map((L) =>
  `z${L.z.toFixed(1)}${L.dir > 0 ? '->+x' : '->-x'}`).join('  ') + `   exit z${HERO_Z.toFixed(1)}->-x`);
console.log(`   closest same-lane-band approach: ${worst.toFixed(2)} units (at clk ${worstAt.toFixed(1)}), envelope ${LEN}`);
console.log(`   phone set: ` + LANES_LITE.map((L) =>
  `z${L.z.toFixed(1)}${L.dir > 0 ? '->+x' : '->-x'}`).join('  ') + `   closest ${worstLite.toFixed(2)} units`);

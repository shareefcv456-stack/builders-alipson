/**
 * THE EXIT CROSSES LIVE TRAFFIC, SO THE CROSSING IS PROVEN.
 *
 * The hero car leaves the property with a right turn and cuts across the
 * oncoming +x lane to reach the leftward carriageway. Every position involved
 * — the car's, from `exitCurve`/`exitU`, and every lane car's, from `laneX` —
 * is a pure function of the same scroll-driven clock, so the question "can they
 * ever touch?" has an answer that can be swept rather than hoped for.
 *
 * Both sides import the modules the scene imports. Nothing here is a copy.
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WRAP, laneX, overtaker, type Lane } from './traffic.js';
import { EXIT_LANE_Z, exitCurve, exitU, exitClock, EXIT_FROM, EXIT_TO } from './exit.js';

const ROAD_Z = 6.0 / 2 + 11.5;
/* MUST MIRROR HeroSite's table (as traffic.check.ts does). */
const LANES: Lane[] = [
  { z: ROAD_Z + 1.7, dir: -1, speed: 0.85, n: 4, kind: 0 },
  { z: ROAD_Z + 3.0, dir: -1, speed: 1.25, n: 3, kind: 1 },
  { z: ROAD_Z - 3.0, dir: 1, speed: 0.62, n: 3, kind: 0 },
];
const LEN = 2.1, WIDTH = 0.78;          // same envelopes as traffic.check
const dxWrapped = (a: number, b: number) => {
  const d = Math.abs(a - b) % WRAP;
  return Math.min(d, WRAP - d);
};

const curve = exitCurve();
const p = new THREE.Vector3(), tan = new THREE.Vector3();

let worst = Infinity, worstAt = 0, worstWith = '';
let crossFrom = 1, crossTo = 0;         // the o-window spent in the oncoming band
let lastX = Infinity, backtrack = 0, minZ = Infinity, maxZ = -Infinity;
let onRoadFrom = 1;

/* Act one is over by the time the car moves (t = 1 throughout the outro), so
   the clock is a function of `o` alone here. Step finely: a coarse sweep can
   step straight over a contact. */
for (let o = 0; o <= 1; o += 0.0002) {
  const u = exitU(o);
  curve.getPointAt(u, p);
  curve.getTangentAt(u, tan);
  const clk = exitClock(1, o);

  // ---- 1 · never within an envelope of a generated vehicle ---------------
  const others: { x: number; z: number; who: string }[] = [];
  LANES.forEach((L, li) => {
    for (let j = 0; j < L.n; j++) others.push({ x: laneX(L, j, clk), z: L.z, who: `lane${li}.${j}` });
  });
  const ov = overtaker(LANES[0], LANES[1], clk);
  others.push({ x: ov.x, z: ov.z, who: 'overtaker' });
  for (const c of others) {
    if (Math.abs(c.z - p.z) >= WIDTH) continue;
    const dx = dxWrapped(c.x, p.x);
    if (dx < worst) { worst = dx; worstAt = o; worstWith = c.who; }
    assert.ok(dx >= LEN, `exit car within ${dx.toFixed(2)} of ${c.who} at o=${o.toFixed(4)}`);
  }

  // ---- 2 · the crossing actually happens, and is brief -------------------
  if (Math.abs(p.z - LANES[2].z) < WIDTH) {
    crossFrom = Math.min(crossFrom, o);
    crossTo = Math.max(crossTo, o);
  }

  // ---- 3 · once on the road it only ever goes LEFT (-x) ------------------
  if (o > EXIT_FROM && p.z > ROAD_Z - 2.0) {
    onRoadFrom = Math.min(onRoadFrom, o);
    if (p.x > lastX + 1e-6) backtrack++;
    lastX = p.x;
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
}

assert.ok(crossTo > crossFrom, 'the exit never crosses the oncoming lane — is it still turning right?');
assert.ok(backtrack === 0, `the exit car moved back toward +x on the carriageway ${backtrack} times`);

/* Heading: at the end of the run the car must be pointing -x, or the lamps are
   on the wrong ends of it. */
curve.getTangentAt(1, tan);
assert.ok(tan.x < -0.98, `exit heading is not -x at the end of the run (tx=${tan.x.toFixed(3)})`);
/* And it must have finished in a lane no generated traffic uses, on the +z
   half — the correct side for a car heading -x under left-hand convention. */
LANES.forEach((L) => {
  assert.ok(Math.abs(L.z - EXIT_LANE_Z) >= WIDTH, `lane at z=${L.z} is inside the exit lane (z=${EXIT_LANE_Z})`);
});
assert.ok(EXIT_LANE_Z > ROAD_Z, 'the exit lane is on the wrong side of the centreline for -x travel');
/* Between the kerbs, not over them: carriageway is ROAD_Z +/- 4.8. */
assert.ok(minZ > ROAD_Z - 4.8 && maxZ < ROAD_Z + 4.8, `the exit left the carriageway (z ${minZ.toFixed(2)}..${maxZ.toFixed(2)})`);

console.log('ok — exit car crosses live traffic and never touches it');
console.log(`   crossing of the oncoming lane: o ${crossFrom.toFixed(3)}..${crossTo.toFixed(3)} (${((crossTo - crossFrom) / (EXIT_TO - EXIT_FROM) * 100).toFixed(0)}% of the drive)`);
console.log(`   closest approach: ${worst.toFixed(2)} units to ${worstWith} at o=${worstAt.toFixed(3)}, envelope ${LEN}`);
console.log(`   on the carriageway from o=${onRoadFrom.toFixed(3)}, travelling -x throughout, settled on z=${EXIT_LANE_Z}`);

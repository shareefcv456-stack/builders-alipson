/**
 * THE ALIPSON EXIT — the hero car's route off the property, as data.
 *
 * It lives in its own module for one reason: the route now CROSSES a live
 * traffic lane, and "it never meets a car" is a claim about arithmetic. The
 * sweep in exit.check.ts imports THIS file, so it proves the curve the scene
 * actually drives rather than a retyped copy of it (the same rule traffic.ts
 * and traffic.check.ts already work under).
 *
 * THE MANOEUVRE. The property sits on the -z side of the carriageway. Kerala
 * drives on the left, so leftward traffic (toward -x, which is screen-left from
 * the hero camera) runs on the +z half — the far side from the gate. A car
 * leaving the property and heading that way therefore makes a RIGHT turn out of
 * the drive and crosses the oncoming +x lane to reach it, giving way as any
 * driver would. That crossing is the whole reason for the check.
 *
 * Geometry this assumes, mirrored from HeroSite: ROAD_Z 14.5, carriageway
 * 9.6 wide (9.7..19.3), oncoming +x lane on z 11.5, leftward lanes on 16.2 and
 * 17.5, kerb at 9.6, gate on the drive at x 6.4.
 */
import * as THREE from 'three';

/** The lane the exit settles into: the inside leftward lane, one lane spacing
 *  (1.3) inboard of the z 16.2 lane, on the correct side of the centreline for
 *  a car heading -x. Nothing generated ever drives here — asserted. */
export const EXIT_LANE_Z = 14.9;

/**
 * Control points, in world x/z. In order: the drop-off slot (the same point the
 * hero parks at, so the drive begins where the car actually stands), out of the
 * bay, onto the drive, through the gate throat, over the footway crossover,
 * across the oncoming lane while already turning, and away down the leftward
 * carriageway.
 *
 * THE PRE-GATE RUN IS DELIBERATELY UNHURRIED. `u` is arc length, so how much
 * curve sits before the crossing is what decides WHEN the crossing happens
 * against a deterministic lane — it is the timing dial, and the check reports
 * what it buys.
 */
export const EXIT_PTS: readonly (readonly [number, number])[] = [
  [3.2, 6.5],     // waiting at the drop-off
  [4.9, 6.9],     // pulls out of the bay
  [6.1, 7.9],     // squares up to the drive
  [6.4, 9.2],     // gate throat
  [6.4, 10.6],    // over the footway crossover, at the give-way line
  [5.9, 12.0],    // crossing the oncoming lane, already turning right
  [4.4, 13.8],    // swinging onto the leftward carriageway
  [2.2, EXIT_LANE_Z],   // settled in lane, heading -x
  [-1.0, EXIT_LANE_Z],
  [-4.5, EXIT_LANE_Z],
  [-9.0, EXIT_LANE_Z],
  [-14.0, EXIT_LANE_Z],
] as const;

/* HOW FAR IT RUNS IS A FRAMING DECISION, NOT A DISTANCE ONE.
   The road tail used to reach x = -60. `u` is arc length over a fixed slice of
   scroll, so 60 units of road means the car covers them in that slice — and
   projecting it through the actual outro camera says it clears the left edge of
   the desktop frame by o = 0.70, less than half way through its own exit,
   leaving the whole finale playing over an empty road. That is what "the car
   goes the wrong way" looks like from the sofa: not a car heading right, a car
   that is not there any more.
   At -14 it is still leaving, still leftward, still accelerating away — and it
   is in frame for the follow shot that exists to watch it. It drops off the
   left edge at the very end, which is what a car driving away should do. */

/** The curve itself. Same class and defaults the scene has always used. */
export const exitCurve = () =>
  new THREE.CatmullRomCurve3(EXIT_PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)));

/** Where act two starts and stops driving the car. Unchanged. */
export const EXIT_FROM = 0.40, EXIT_TO = 0.96;

/**
 * Outro progress -> arc-length fraction. Gentle acceleration: the exponent
 * means it eases away from rest and keeps gaining rather than braking into the
 * end of the shot. Unchanged from the original route.
 */
export const exitU = (o: number) => {
  const s = (o - EXIT_FROM) / (EXIT_TO - EXIT_FROM);
  return Math.pow(s < 0 ? 0 : s > 1 ? 1 : s, 1.55);
};

/** The scene's traffic clock, as a function of the two playheads. Mirrored
 *  here so the check can ask "where is the traffic when the car crosses?". */
export const exitClock = (t: number, o: number) => t * 26 + o * 30;

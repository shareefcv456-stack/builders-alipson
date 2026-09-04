/**
 * THE BODIES ARE ACTUALLY CAR-SHAPED. Asserts the three properties that
 * separate a sculpted body from the flat extrusion it used to be, plus the two
 * that a bad edit would silently break — a triangulator that quietly produces
 * garbage, and the van facing backwards again.
 *
 *   npx tsc src/lib/vehicle.ts src/lib/vehicle.check.ts --outDir node_modules/.cache/vcheck \
 *     --module es2022 --target es2022 --moduleResolution bundler && \
 *     node node_modules/.cache/vcheck/vehicle.check.js
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { carGeometry, type CarKind } from './vehicle.js';

/** Widest half-width of the body within a slab of x, ignoring the mirrors
 *  (which stick out past the shoulder on purpose). */
const halfWidthIn = (
  g: THREE.BufferGeometry,
  x0: number, x1: number, y0 = -Infinity, y1 = Infinity,
) => {
  const pos = g.attributes.position as THREE.BufferAttribute;
  let w = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = Math.abs(pos.getZ(i));
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    if (z > w) w = z;
  }
  return w;
};

const measured = { taper: 0, tumblehome: 0 };

for (const kind of ['saloon', 'suv', 'van'] as CarKind[]) {
  const car = carGeometry(kind);
  const pos = car.body.attributes.position as THREE.BufferAttribute;

  // Triangulation sanity: an ExtrudeGeometry whose holes cross the outline
  // produces NaNs and degenerate spans rather than throwing.
  for (let i = 0; i < pos.count; i++) {
    assert.ok(
      Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)),
      `${kind}: non-finite vertex — the profile or a wheel-arch hole is malformed`,
    );
  }
  assert.ok(pos.count > 200, `${kind}: only ${pos.count} vertices, the extrusion collapsed`);

  const nose = kind === 'van' ? 0.95 : (kind === 'suv' ? 0.88 : 0.87);
  const belt = kind === 'van' ? 0.46 : (kind === 'suv' ? 0.47 : 0.40);
  /* Every window stops at the beltline, which is also what keeps the mirrors
     out of the measurement — they sit just above it. Deliberately NOT clipped
     by a z derived from `width`: assuming the body is `width` across is the
     exact mistake that buried the wheels inside it. */
  /* Measured on the REAR half of the midsection, which is the one place no
     body carries a mirror — excluding them by x is reliable, where excluding
     them by height also cut away the contour points being measured. */
  const mid = halfWidthIn(car.body, -nose * 0.45, -nose * 0.1, 0.1, belt);
  const tip = halfWidthIn(car.body, nose * 0.9, nose * 1.15, 0.1, belt);
  /* Widened from +/-0.3. Two of the three bodies now have a FLAT roof — the
     SUV and the van — and an extruded flat span carries vertices only at its
     ends, so a narrow window sampled nothing and the tumblehome check quietly
     had only one body left to measure. +/-0.45 reaches the SUV's roof corners,
     which is where its tumblehome actually shows. */
  const roof = halfWidthIn(car.body, -nose * 0.45, nose * 0.45, belt + 0.08, Infinity);

  /* AN EXTRUDED CONTOUR ONLY CARRIES VERTICES WHERE THE PROFILE HAS POINTS, so
     a long straight edge — a van's flank, a van's roofline — has nothing in the
     middle to sample. The taper is still applied there (it interpolates across
     the face, which is what a flat flank should do), it just cannot be measured
     at that x. So each comparison runs only where there is material, and the
     tally below asserts that between them the three bodies actually exercised
     both halves of the sculpt rather than skipping quietly. */
  if (mid > 0 && tip > 0) {
    // 1. Plan taper — the nose draws in from the full-width midsection.
    assert.ok(tip < mid * 0.95, `${kind}: nose ${tip.toFixed(3)} not tapered from midship ${mid.toFixed(3)}`);
    measured.taper++;
  }
  if (mid > 0 && roof > 0) {
    // 2. Tumblehome — the glasshouse leans in above the beltline.
    assert.ok(roof < mid * 0.95, `${kind}: roof ${roof.toFixed(3)} not narrower than shoulder ${mid.toFixed(3)}`);
    measured.tumblehome++;
  }

  // 3. Mirrors are outboard of the shoulder, or they are buried in the door.
  /* REAR arch, not the front one: the van's mirror sits close enough to its
     front axle to land inside that window and be measured as bodywork. The
     sculpt is symmetric in |x|, so the rear arch is the same width and carries
     nothing bolted to it. */
  const shoulder = halfWidthIn(car.body, -car.axle - 0.12, -car.axle + 0.12, 0.1, belt);
  const widest = halfWidthIn(car.body, -nose, nose, 0.1, Infinity);
  assert.ok(
    widest > shoulder,
    `${kind}: mirrors ${widest.toFixed(3)} do not clear the body ${shoulder.toFixed(3)}`,
  );

  /* 4. THE WHEELS ARE AT THE EDGE OF THE CAR. This is the one that was wrong:
        the track was derived from `width`, the body is wider than `width`, and
        the tyres ended up sunk 0.11 inside the bodywork. Within 15% of the arch
        half-width is a real track; anything less is a car on castors. */
  const arch = halfWidthIn(car.body, -car.axle - 0.12, -car.axle + 0.12, 0.1, belt);
  assert.ok(
    car.track > arch * 0.85,
    `${kind}: track ${car.track.toFixed(3)} is buried inside the arch at ${arch.toFixed(3)}`,
  );
  assert.ok(car.track < arch, `${kind}: track ${car.track.toFixed(3)} sticks out past the arch ${arch.toFixed(3)}`);

  console.log(
    `${kind.padEnd(7)} midship ${mid.toFixed(3)}  nose ${tip.toFixed(3)}  roof ${roof.toFixed(3)}  ` +
    `track ${car.track.toFixed(3)}/${arch.toFixed(3)}  mirror ${widest.toFixed(3)}  verts ${pos.count}`,
  );
}

/* 5. THE VAN FACES THE WAY ITS LAMPS DO. `place` puts head lamps at +lampX and
      tail lamps at -lampX for every body alike, so the van's cab has to be the
      +x end. Measured by where the TALL BOX sits: a van's full-height roofline
      runs over the load bay, behind the cab, so the centre of the roof must lie
      behind the middle of the vehicle. Vertex counts either side would not do
      it — those are dominated by cap triangulation, not by shape. */
{
  const van = carGeometry('van');
  const pos = van.body.attributes.position as THREE.BufferAttribute;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < 0.75) continue;
    const x = pos.getX(i);
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  assert.ok(Number.isFinite(lo), 'van has no roofline to measure');
  const roofCentre = (lo + hi) / 2;
  assert.ok(
    roofCentre < -0.05,
    `van is facing backwards: its load-bay roof is centred at x=${roofCentre.toFixed(3)}, ` +
    'so the raked windscreen is at -x while place() puts the headlights at +x',
  );
  console.log(`van     roofline x ${lo.toFixed(2)}..${hi.toFixed(2)}, centred ${roofCentre.toFixed(2)} — box behind the cab`);
}

assert.ok(measured.taper >= 2, `plan taper only measurable on ${measured.taper} body/bodies`);
assert.ok(measured.tumblehome >= 2, `tumblehome only measurable on ${measured.tumblehome} body/bodies`);

console.log('ok — all bodies sculpted, mirrored and correctly oriented');

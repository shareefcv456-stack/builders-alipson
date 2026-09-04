import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ---- vehicles --------------------------------------------------------------
   NOT BOXES. Every car here is a real SIDE PROFILE — bonnet line, raked screen,
   roofline, boot — drawn as a THREE.Shape and EXTRUDED to the car's width with a
   bevel, so the body has rounded shoulders and a silhouette you can read as a
   car at 40 px. The wheel arches and the greenhouse are HOLES in that profile,
   which is what a wheel well and a window actually are: the arches let the
   wheels sit in the body instead of clipping through it, and the glazing is a
   genuine opening you can see through, filled by a separate, narrower glass
   extrusion so there is a reveal round it that reads as the window rubber.

   Sized off the same 1 unit = 2.8 m as everything else: the saloon is 4.5 m
   long, 1.85 m wide, 1.64 m tall on a 2.9 m wheelbase, and the wheels are 0.135
   (a 38 cm radius — a real 18-inch wheel and tyre).                          */
export type CarKind = 'saloon' | 'suv' | 'van';
export type CarSpec = {
  body: THREE.BufferGeometry; glass: THREE.BufferGeometry;
  axle: number; wheelR: number; width: number; lampY: number; lampX: number;
  /** |z| the wheels sit at — MEASURED off the finished body at the wheel arch,
   *  not guessed from `width`. See carGeometry for why that distinction had
   *  teeth. */
  track: number;
};

export function carShapes(kind: CarKind) {
  const sh = new THREE.Shape();
  const glass = new THREE.Shape();
  let axle: number, arch: number, archY: number, wheelR: number, width: number, lampY: number, lampX: number;

  if (kind === 'van') {
    sh.moveTo(-0.95, 0.22);
    sh.quadraticCurveTo(-0.99, 0.32, -0.88, 0.39);
    sh.lineTo(-0.74, 0.42);
    sh.quadraticCurveTo(-0.66, 0.44, -0.58, 0.72);
    sh.quadraticCurveTo(-0.52, 0.80, -0.34, 0.81);
    sh.lineTo(0.72, 0.81);
    sh.quadraticCurveTo(0.92, 0.81, 0.94, 0.68);
    sh.lineTo(0.95, 0.24);
    sh.lineTo(0.86, 0.12);
    sh.lineTo(-0.84, 0.12);
    sh.closePath();
    glass.moveTo(-0.56, 0.50);
    glass.quadraticCurveTo(-0.50, 0.70, -0.38, 0.72);
    glass.lineTo(-0.06, 0.72);
    glass.lineTo(-0.06, 0.50);
    glass.closePath();
    axle = 0.60; arch = 0.16; archY = 0.27; wheelR = 0.15; width = 0.60; lampY = 0.36; lampX = 0.93;
  } else if (kind === 'suv') {
    /* UPRIGHT SUV — a Defender/utility silhouette, not a taller hatchback.
       What makes this read as an SUV rather than a big car is four things, and
       all of them are proportions rather than detail: a HIGH SILL (0.155 here
       against the sedan's 0.115, so it sits on its wheels instead of over
       them), a NEAR-VERTICAL windscreen, a FLAT ROOF held level across most of
       the length, and a squared-off tail with no taper into the boot.
       Drawn nose at +x like every other body — see the note on the van. */
    sh.moveTo(-0.86, 0.26);                     // tail, upright
    sh.lineTo(-0.87, 0.58);
    sh.quadraticCurveTo(-0.87, 0.66, -0.79, 0.665);
    sh.lineTo(-0.62, 0.67);                     // rear roof corner
    sh.lineTo(0.30, 0.685);                     // FLAT roof, long span
    sh.quadraticCurveTo(0.40, 0.685, 0.44, 0.63);
    sh.lineTo(0.56, 0.46);                      // steep screen, short and raked back
    sh.quadraticCurveTo(0.60, 0.42, 0.68, 0.415);
    sh.lineTo(0.80, 0.41);                      // long flat bonnet
    sh.quadraticCurveTo(0.86, 0.405, 0.865, 0.34);
    sh.lineTo(0.87, 0.24);                      // blunt vertical nose
    sh.lineTo(0.78, 0.155);
    sh.lineTo(-0.78, 0.155);                    // high sill
    sh.closePath();
    glass.moveTo(0.50, 0.475);
    glass.quadraticCurveTo(0.52, 0.52, 0.46, 0.60);
    glass.lineTo(-0.58, 0.605);
    glass.lineTo(-0.58, 0.475);
    glass.closePath();
    // Bigger wheels set further out — the other half of the SUV read.
    axle = 0.545; arch = 0.175; archY = 0.295; wheelR = 0.163; width = 0.545; lampY = 0.345; lampX = 0.845;
  } else {
    /* LUXURY SEDAN — long bonnet, cabin set back, long rear deck. The old
       profile put the windscreen base at x = 0.05, which is mid-car and reads
       as a compact hatch; a prestige saloon carries roughly half its length in
       front of the A-pillar. The roofline is also lower and the tail longer. */
    sh.moveTo(-0.86, 0.185);                    // long rear overhang
    sh.quadraticCurveTo(-0.90, 0.28, -0.80, 0.325);
    sh.lineTo(-0.66, 0.35);                     // boot lid
    sh.quadraticCurveTo(-0.50, 0.375, -0.40, 0.50);   // rear screen, raked
    sh.quadraticCurveTo(-0.34, 0.545, -0.22, 0.552);
    sh.lineTo(0.06, 0.556);                     // low flat roof
    sh.quadraticCurveTo(0.20, 0.552, 0.30, 0.475);    // windscreen, well forward
    sh.lineTo(0.44, 0.40);
    sh.quadraticCurveTo(0.56, 0.375, 0.70, 0.365);    // LONG bonnet
    sh.quadraticCurveTo(0.82, 0.358, 0.845, 0.30);
    sh.lineTo(0.85, 0.21);
    sh.lineTo(0.74, 0.115);
    sh.lineTo(-0.74, 0.115);
    sh.closePath();
    glass.moveTo(0.26, 0.455);
    glass.quadraticCurveTo(0.20, 0.515, 0.06, 0.522);
    glass.lineTo(-0.24, 0.518);
    glass.quadraticCurveTo(-0.36, 0.512, -0.40, 0.455);
    glass.closePath();
    axle = 0.545; arch = 0.158; archY = 0.25; wheelR = 0.142; width = 0.525; lampY = 0.30; lampX = 0.825;
  }

  /* Wheel arches as holes. They must sit ENTIRELY inside the outline — a hole
     that crosses the edge makes the triangulator produce garbage — which is why
     the sill runs at 0.115 and the arch bottoms at 0.093. */
  ([-axle, axle] as const).forEach((cx) => {
    const h = new THREE.Path();
    h.absarc(cx, archY, arch, 0, Math.PI * 2, true);
    sh.holes.push(h);
  });
  if (kind !== 'van') sh.holes.push(new THREE.Path(glass.getPoints(20)));
  return { sh, glass, axle, wheelR, width, lampY, lampX };
}

/** Extrude a side profile to width, bevelled and centred on Z. The whole
 *  vehicle fleet — cars, vans and the construction plant — is built with this,
 *  because a bevelled profile is what gives a body rounded shoulders and a
 *  readable silhouette where a box gives neither. */
export const extrudeProfile = (shape: THREE.Shape, depth: number, bevel: number, seg = 6) => {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 2, curveSegments: seg,
  });
  g.translate(0, 0, -(depth / 2 + bevel));
  /* THIS IS WHY EVERYTHING EXTRUDED LOOKED FACETED.
     ExtrudeGeometry emits a NON-INDEXED mesh, so `computeVertexNormals` — which
     is what used to be here — gives every triangle its own normal and the
     result is flat shading on every surface, curved or not. A bonnet built
     from twelve segments then reads as twelve visible facets, which is the
     "low-poly" look however many segments you add.
     `toCreasedNormals` welds vertices and smooths across them, but only where
     the angle between faces is under the crease threshold. 38 degrees is
     chosen so a roofline, a shoulder or a bevel — all well over 38 — stays a
     crisp edge, while the swept curve of a bonnet, a wheel arch or an
     excavator boom goes smooth. Sharp where the design is sharp, smooth where
     it is not, which is exactly what a real panel does.
     One line here covers the whole fleet AND the plant: cars, van, excavator
     house and boom, mixer cab and chute all extrude through this function. */
  return toCreasedNormals(g, THREE.MathUtils.degToRad(38));
};

/**
 * PLAN-VIEW SCULPT — the thing that stops an extrusion reading as a toy.
 *
 * A straight extrusion has FLAT SIDES: the body is the same width at the nose,
 * at the B-pillar and at the tail, and the roof is as wide as the sills. No car
 * has ever been that shape, and it is the single loudest "this was made from a
 * profile" tell in the frame — louder than polycount, louder than materials.
 *
 * A real body has three separate narrowings, and this applies all three by
 * scaling each vertex's Z by a factor of its X and Y:
 *
 *   · plan taper   the nose and tail draw in from the full-width midsection.
 *                  x^4, not x^2 — a quadratic starts narrowing at the doors,
 *                  which gives a boat, not a car. The quartic holds the
 *                  midsection full and then falls away over the last third.
 *   · tumblehome   the glasshouse leans in above the beltline, so the roof is
 *                  meaningfully narrower than the shoulder. This is what reads
 *                  as a greenhouse sitting ON a body rather than a second slab
 *                  stacked on the first.
 *   · sill tuck    the very bottom pulls in under the shoulder line.
 *
 * The wheels are placed off `width`, which is NOT scaled here, so tyres end up
 * fractionally proud of the arches — which is also correct, and is what makes
 * the arch read as an arch when the light rakes across it.
 */
export const sculptBody = <T extends THREE.BufferGeometry>(
  g: T, halfLen: number, belt: number, roof: number,
): T => {
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const xn = Math.min(1, Math.abs(x) / halfLen);
    let f = 1 - 0.30 * Math.pow(xn, 4);
    if (y > belt) {
      const up = Math.min(1, (y - belt) / Math.max(0.001, roof - belt));
      f *= 1 - 0.22 * Math.pow(up, 1.4);
    }
    if (y < 0.2) f *= 1 - 0.16 * Math.min(1, (0.2 - y) / 0.2);
    pos.setZ(i, pos.getZ(i) * f);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
};

/** Door mirrors, MERGED INTO the body rather than instanced separately.
 *  They are two 40 mm blobs — worth having because the silhouette is missing
 *  something without them, not worth two more draw calls and two more slots in
 *  every placement loop. Merged, they inherit the body's per-instance paint,
 *  which is where a mirror cap's colour comes from anyway. */
export const withMirrors = (body: THREE.BufferGeometry, x: number, y: number, halfW: number) => {
  const parts: THREE.BufferGeometry[] = [body];
  ([-1, 1] as const).forEach((s) => {
    const cap = new THREE.SphereGeometry(0.038, 6, 5);
    cap.scale(1.25, 0.72, 0.9);
    cap.translate(x, y, s * (halfW + 0.045));
    const stem = new THREE.BoxGeometry(0.02, 0.018, 0.036);
    stem.translate(x, y - 0.008, s * (halfW + 0.004));
    parts.push(cap, stem);
  });
  /* INDEXED AND NON-INDEXED GEOMETRY CANNOT BE MERGED. ExtrudeGeometry produces
     no index; SphereGeometry and BoxGeometry both do. Hand mergeGeometries that
     mixture and it does not throw — it logs and returns NULL, which then sails
     through the `!` below and the car is simply gone. Flatten everything to
     non-indexed first, which is what the body already is. */
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(flat, false);
  if (!merged) throw new Error('carGeometry: mirror merge failed');
  return merged;
};

export /** Widest half-width of a finished body inside a slab of x. */
const halfWidthAt = (g: THREE.BufferGeometry, x0: number, x1: number, yMax: number) => {
  const pos = g.attributes.position as THREE.BufferAttribute;
  let w = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    if (x < x0 || x > x1 || pos.getY(i) > yMax) continue;
    const z = Math.abs(pos.getZ(i));
    if (z > w) w = z;
  }
  return w;
};

export function carGeometry(kind: CarKind): CarSpec {
  const { sh, glass, axle, wheelR, width, lampY, lampX } = carShapes(kind);
  const ex = extrudeProfile;
  const van = kind === 'van';
  // Profile landmarks the sculpt needs, read off the shapes above.
  const halfLen = van ? 0.95 : (kind === 'suv' ? 0.88 : 0.87);
  const belt = van ? 0.46 : (kind === 'suv' ? 0.47 : 0.40);
  const roof = van ? 0.81 : (kind === 'suv' ? 0.685 : 0.556);
  const body = sculptBody(ex(sh, width, 0.05), halfLen, belt, roof);
  const gl = sculptBody(ex(glass, width - 0.06, 0.012), halfLen, belt, roof);
  /* THE VAN IS DRAWN FACING THE WRONG WAY. Its profile rakes up at -x (that
     steep rise IS the windscreen) and its slab end is at +x — but `place` puts
     head lamps at +lampX and tail lamps at -lampX for every body alike, so the
     van was wearing its headlights on the rear doors and its tail lamps on the
     bonnet. Turned here, at the source, rather than special-casing the lamp
     placement: one body being backwards is a geometry bug, not a lamp bug, and
     the lamp loop is shared by the whole fleet.
     rotateY, NOT scale(-1,1,1): negating an axis reverses triangle winding and
     turns the body inside out. A half-turn about Y maps +x to -x with the
     winding — and so the normals — left intact, and the body is symmetric in z,
     so it is exactly the mirror image and nothing else moves. */
  if (van) { body.rotateY(Math.PI); gl.rotateY(Math.PI); }
  /* TRACK IS MEASURED, NOT ASSUMED. The old code put the wheels at
     `width / 2 - 0.06`, reading `width` as the body's half-depth — but
     ExtrudeGeometry's bevel adds to Z as well as XY, so a 0.52-wide saloon is
     actually 0.72 across the shoulders. The wheels were therefore sitting
     0.11 INSIDE the bodywork: a car on a comically narrow track, its tyres
     visible only down inside the arch openings. Measuring the finished body at
     the arch and sitting the wheels a hair inside that puts the tyre where a
     tyre goes, and stays correct if the bevel or the profile ever changes. */
  const mirrorX = van ? 0.5 : 0.02, mirrorY = belt + 0.02;
  /* Mirrors go outboard of the MEASURED shoulder for the same reason: hung off
     `width` they sat inside the door skin, which is a mirror you cannot see. */
  const shoulder = halfWidthAt(body, mirrorX - 0.15, mirrorX + 0.15, belt + 0.06);
  const withM = withMirrors(body, mirrorX, mirrorY, shoulder);
  const archHalf = halfWidthAt(body, axle - 0.12, axle + 0.12, belt);
  return {
    body: withM,
    // Narrower, so a shadow reveal shows round every opening — window rubber.
    // Sculpted with the SAME curve as the body, or the glazing pushes back out
    // through the tumblehome it is supposed to sit inside.
    glass: gl,
    axle, wheelR, width: width + 0.1, lampY, lampX,
    track: archHalf - 0.022,
  };
}

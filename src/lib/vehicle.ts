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
/* Seven body types. Three are the original, tuned profiles (the long-bonnet
   saloon is now the `luxury` body, the upright utility is `offroad`, and the
   van); four are new: a family `sedan`, a sloped-roof premium `suv`, a fastback
   `coupe` and a cab-forward `hyper`. Each has its own wheel size, ride height,
   beltline and lamp line, so the silhouettes differ by proportion — which is
   what reads at distance — not just by paint. */
export type CarKind = 'luxury' | 'sedan' | 'suv' | 'offroad' | 'coupe' | 'hyper' | 'van';
export const CAR_KINDS: CarKind[] = ['luxury', 'sedan', 'suv', 'offroad', 'coupe', 'hyper', 'van'];
export type CarSpec = {
  /** Paint: the sculpted shell, bumpers, mirrors, pillars, door handles. */
  body: THREE.BufferGeometry;
  /** Glazing only — windscreen, side and rear glass as one tinted shell. */
  glass: THREE.BufferGeometry;
  /** Black trim: window seals, wheel-arch liners, door shut lines, sill trim,
   *  grille and intakes, and type-specific parts (spare wheel, wing). */
  trim: THREE.BufferGeometry;
  axle: number; wheelR: number; width: number; lampY: number; lampX: number;
  /** |z| the wheels sit at — MEASURED off the finished body at the wheel arch,
   *  not guessed from `width`. See carGeometry for why that distinction had
   *  teeth. */
  track: number;
  /** Nose half-length and beltline, for the shape checks and contact shadow. */
  halfLen: number; belt: number;
};

type Profile = {
  draw: (sh: THREE.Shape, glass: THREE.Shape) => void;
  axle: number; wheelR: number; arch: number; archY: number; width: number;
  lampY: number; lampX: number; halfLen: number; belt: number; roof: number;
  mirrorX: number; pillars: number[]; seams: number[];
};

const PROFILES: Record<CarKind, Profile> = {
  van: {
    draw(sh, glass) {
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
    },
    axle: 0.60, arch: 0.16, archY: 0.27, wheelR: 0.15, width: 0.60, lampY: 0.36, lampX: 0.93,
    halfLen: 0.95, belt: 0.46, roof: 0.81, mirrorX: 0.5, pillars: [], seams: [0.44, 0.1],
  },
  /* UPRIGHT UTILITY — a Defender-style silhouette: high sill, near-vertical
     screen, flat roof held level, squared-off tail. */
  offroad: {
    draw(sh, glass) {
      sh.moveTo(-0.86, 0.26);
      sh.lineTo(-0.87, 0.58);
      sh.quadraticCurveTo(-0.87, 0.66, -0.79, 0.665);
      sh.lineTo(-0.62, 0.67);
      sh.lineTo(0.30, 0.685);
      sh.quadraticCurveTo(0.40, 0.685, 0.44, 0.63);
      sh.lineTo(0.56, 0.46);
      sh.quadraticCurveTo(0.60, 0.42, 0.68, 0.415);
      sh.lineTo(0.80, 0.41);
      sh.quadraticCurveTo(0.86, 0.405, 0.865, 0.34);
      sh.lineTo(0.87, 0.24);
      sh.lineTo(0.78, 0.155);
      sh.lineTo(-0.78, 0.155);
      sh.closePath();
      glass.moveTo(0.50, 0.475);
      glass.quadraticCurveTo(0.52, 0.52, 0.46, 0.60);
      glass.lineTo(-0.58, 0.605);
      glass.lineTo(-0.58, 0.475);
      glass.closePath();
    },
    axle: 0.545, arch: 0.175, archY: 0.295, wheelR: 0.163, width: 0.545, lampY: 0.345, lampX: 0.845,
    halfLen: 0.88, belt: 0.47, roof: 0.685, mirrorX: 0.48, pillars: [0.06, -0.3], seams: [0.38, 0.06, -0.3],
  },
  /* LUXURY SALOON — long bonnet, cabin set back, long rear deck. */
  luxury: {
    draw(sh, glass) {
      sh.moveTo(-0.86, 0.185);
      sh.quadraticCurveTo(-0.90, 0.28, -0.80, 0.325);
      sh.lineTo(-0.66, 0.35);
      sh.quadraticCurveTo(-0.50, 0.375, -0.40, 0.50);
      sh.quadraticCurveTo(-0.34, 0.545, -0.22, 0.552);
      sh.lineTo(0.06, 0.556);
      sh.quadraticCurveTo(0.20, 0.552, 0.30, 0.475);
      sh.lineTo(0.44, 0.40);
      sh.quadraticCurveTo(0.56, 0.375, 0.70, 0.365);
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
    },
    axle: 0.545, arch: 0.158, archY: 0.25, wheelR: 0.142, width: 0.525, lampY: 0.30, lampX: 0.825,
    halfLen: 0.87, belt: 0.40, roof: 0.556, mirrorX: 0.34, pillars: [-0.07], seams: [0.31, -0.07, -0.4],
  },
  /* FAMILY SEDAN — shorter, cabin further forward, a short boot and a taller
     greenhouse than the luxury car. */
  sedan: {
    draw(sh, glass) {
      sh.moveTo(-0.80, 0.19);
      sh.quadraticCurveTo(-0.83, 0.30, -0.74, 0.33);
      sh.lineTo(-0.60, 0.35);
      sh.quadraticCurveTo(-0.46, 0.37, -0.36, 0.49);
      sh.quadraticCurveTo(-0.30, 0.545, -0.18, 0.55);
      sh.lineTo(0.08, 0.55);
      sh.quadraticCurveTo(0.18, 0.545, 0.27, 0.46);
      sh.lineTo(0.38, 0.39);
      sh.quadraticCurveTo(0.52, 0.37, 0.66, 0.355);
      sh.quadraticCurveTo(0.78, 0.35, 0.795, 0.29);
      sh.lineTo(0.80, 0.20);
      sh.lineTo(0.70, 0.12);
      sh.lineTo(-0.70, 0.12);
      sh.closePath();
      glass.moveTo(0.24, 0.45);
      glass.quadraticCurveTo(0.17, 0.515, 0.06, 0.52);
      glass.lineTo(-0.18, 0.518);
      glass.quadraticCurveTo(-0.30, 0.51, -0.34, 0.45);
      glass.closePath();
    },
    axle: 0.50, arch: 0.15, archY: 0.166, wheelR: 0.136, width: 0.50, lampY: 0.30, lampX: 0.77,
    halfLen: 0.80, belt: 0.39, roof: 0.55, mirrorX: 0.3, pillars: [-0.06], seams: [0.28, -0.06, -0.36],
  },
  /* PREMIUM SUV — long, high-riding, with a raked screen and a roof that falls
     gently to a sloped tailgate (the opposite of the boxy off-roader). */
  suv: {
    draw(sh, glass) {
      sh.moveTo(-0.90, 0.27);
      sh.lineTo(-0.905, 0.50);
      sh.quadraticCurveTo(-0.90, 0.60, -0.80, 0.63);
      sh.lineTo(-0.55, 0.655);
      sh.lineTo(0.18, 0.67);
      sh.quadraticCurveTo(0.27, 0.668, 0.33, 0.62);
      sh.lineTo(0.48, 0.47);
      sh.quadraticCurveTo(0.53, 0.43, 0.62, 0.425);
      sh.lineTo(0.80, 0.41);
      sh.quadraticCurveTo(0.88, 0.40, 0.895, 0.33);
      sh.lineTo(0.90, 0.24);
      sh.lineTo(0.80, 0.16);
      sh.lineTo(-0.80, 0.16);
      sh.closePath();
      glass.moveTo(0.44, 0.48);
      glass.quadraticCurveTo(0.41, 0.54, 0.31, 0.61);
      glass.lineTo(-0.55, 0.60);
      glass.quadraticCurveTo(-0.70, 0.595, -0.76, 0.53);
      glass.lineTo(-0.76, 0.48);
      glass.closePath();
    },
    axle: 0.56, arch: 0.172, archY: 0.188, wheelR: 0.158, width: 0.55, lampY: 0.36, lampX: 0.87,
    halfLen: 0.905, belt: 0.48, roof: 0.67, mirrorX: 0.42, pillars: [0.04, -0.36], seams: [0.34, 0.04, -0.36],
  },
  /* SPORTS COUPE — low roof, long bonnet, fastback falling to a short tail,
     two doors. */
  coupe: {
    draw(sh, glass) {
      sh.moveTo(-0.84, 0.18);
      sh.quadraticCurveTo(-0.86, 0.27, -0.78, 0.30);
      sh.lineTo(-0.66, 0.32);
      sh.quadraticCurveTo(-0.48, 0.34, -0.30, 0.44);
      sh.quadraticCurveTo(-0.18, 0.475, -0.05, 0.478);
      sh.lineTo(0.02, 0.476);
      sh.quadraticCurveTo(0.12, 0.47, 0.22, 0.40);
      sh.lineTo(0.34, 0.345);
      sh.quadraticCurveTo(0.55, 0.33, 0.72, 0.31);
      sh.quadraticCurveTo(0.83, 0.30, 0.84, 0.22);
      sh.lineTo(0.84, 0.17);
      sh.lineTo(0.74, 0.105);
      sh.lineTo(-0.74, 0.105);
      sh.closePath();
      glass.moveTo(0.19, 0.392);
      glass.quadraticCurveTo(0.12, 0.452, 0.0, 0.455);
      glass.lineTo(-0.16, 0.452);
      glass.quadraticCurveTo(-0.24, 0.44, -0.27, 0.40);
      glass.closePath();
    },
    axle: 0.53, arch: 0.15, archY: 0.16, wheelR: 0.14, width: 0.52, lampY: 0.25, lampX: 0.81,
    halfLen: 0.84, belt: 0.32, roof: 0.478, mirrorX: 0.2, pillars: [], seams: [0.25, -0.26],
  },
  /* HYPERCAR — cab-forward wedge, very low roof, high front fenders, a tall
     flat tail and a rear wing. */
  hyper: {
    draw(sh, glass) {
      sh.moveTo(-0.82, 0.15);
      sh.lineTo(-0.83, 0.30);
      sh.quadraticCurveTo(-0.80, 0.335, -0.72, 0.335);
      sh.lineTo(-0.40, 0.36);
      sh.quadraticCurveTo(-0.20, 0.405, -0.05, 0.405);
      sh.quadraticCurveTo(0.08, 0.40, 0.16, 0.33);
      sh.quadraticCurveTo(0.32, 0.33, 0.50, 0.335);
      sh.quadraticCurveTo(0.72, 0.33, 0.80, 0.25);
      sh.lineTo(0.82, 0.16);
      sh.lineTo(0.80, 0.11);
      sh.lineTo(0.70, 0.085);
      sh.lineTo(-0.70, 0.085);
      sh.closePath();
      glass.moveTo(0.13, 0.335);
      glass.quadraticCurveTo(0.06, 0.385, -0.05, 0.39);
      glass.quadraticCurveTo(-0.16, 0.388, -0.22, 0.35);
      glass.closePath();
    },
    axle: 0.52, arch: 0.142, archY: 0.15, wheelR: 0.13, width: 0.56, lampY: 0.21, lampX: 0.80,
    halfLen: 0.83, belt: 0.27, roof: 0.405, mirrorX: 0.1, pillars: [], seams: [0.13, -0.24],
  },
};

/* Wheel arches are HOLES in the profile and the greenhouse is a hole too:
   the arches let the wheels sit in the body instead of clipping through it,
   and the glazing is a genuine opening, filled by a separate, narrower glass
   extrusion so a reveal round it reads as the window rubber. */
export function carShapes(kind: CarKind) {
  const pf = PROFILES[kind];
  const sh = new THREE.Shape();
  const glass = new THREE.Shape();
  pf.draw(sh, glass);
  ([-pf.axle, pf.axle] as const).forEach((cx) => {
    const h = new THREE.Path();
    h.absarc(cx, pf.archY, pf.arch, 0, Math.PI * 2, true);
    sh.holes.push(h);
  });
  if (kind !== 'van') sh.holes.push(new THREE.Path(glass.getPoints(20)));
  return { sh, glass, ...pf };
}

/** Extrude a side profile to width, bevelled and centred on Z. The whole
 *  vehicle fleet — cars, vans and the construction plant — is built with this,
 *  because a bevelled profile is what gives a body rounded shoulders and a
 *  readable silhouette where a box gives neither. */
/* `seg` is curveSegments — how many facets each quadratic in the profile is
   drawn with. 6 was leaving a visible six-sided arc on a bonnet and a roofline,
   which is the "low-poly" read that survives however good the materials are.
   Cars pass 14 explicitly (they are instanced, so the cost is paid once for the
   whole fleet); the plant keeps a lower default because its profiles are mostly
   straight runs where extra segments buy nothing. */
export const extrudeProfile = (shape: THREE.Shape, depth: number, bevel: number, seg = 10) => {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 3, curveSegments: seg,
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
/**
 * Mirrors, bumpers and a grille bar, MERGED INTO the body.
 *
 * Merged rather than instanced separately, and that is the whole reason these
 * are affordable: the fleet is drawn as InstancedMesh — one call for the whole
 * car park, one for all the traffic — so a detail welded into the body geometry
 * costs a few hundred vertices ONCE and nothing per car. Adding them as their
 * own meshes would have meant five more draw calls and five more placement
 * loops for details measured in centimetres.
 *
 * `noseX` is the front of the body, `tailX` the back, both measured off the
 * finished geometry so the parts land on the bodywork rather than at a guessed
 * coordinate.
 */
export const withMirrors = (
  body: THREE.BufferGeometry, x: number, y: number, halfW: number,
  noseX = 0, tailX = 0, sill = 0.115,
) => {
  const parts: THREE.BufferGeometry[] = [body];
  ([-1, 1] as const).forEach((s) => {
    const cap = new THREE.SphereGeometry(0.038, 6, 5);
    cap.scale(1.25, 0.72, 0.9);
    cap.translate(x, y, s * (halfW + 0.045));
    const stem = new THREE.BoxGeometry(0.02, 0.018, 0.036);
    stem.translate(x, y - 0.008, s * (halfW + 0.004));
    parts.push(cap, stem);
  });
  if (noseX !== 0) {
    /* Bumpers, front and rear. Deliberately NARROWER than the midsection
       (0.86 of the shoulder): a real bumper wraps the corners without standing
       proud of the car's widest point, and letting it exceed that would also
       flatten the plan taper the sculpt just put in. */
    const bw = halfW * 0.86 * 2;
    ([[noseX, 1], [tailX, -1]] as const).forEach(([bx, dir]) => {
      const bar = new THREE.BoxGeometry(0.055, 0.075, bw);
      bar.translate(bx - dir * 0.022, sill + 0.075, 0);
      parts.push(bar);
    });
    /* Grille: a shallow recessed bar under the bonnet line, front only. It is
       the one detail that tells the front of a car from the back at distance,
       which matters here because the traffic runs in both directions. */
    const grille = new THREE.BoxGeometry(0.03, 0.055, bw * 0.66);
    grille.translate(noseX - 0.035, sill + 0.165, 0);
    parts.push(grille);
  }
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

/** Flatten to the attribute set every part shares, so they can merge. */
const flat = (g: THREE.BufferGeometry) => {
  const x = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') x.deleteAttribute(k);
  if (!x.attributes.normal) x.computeVertexNormals();
  if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
  return x;
};
const merge = (parts: THREE.BufferGeometry[], what: string) => {
  const m = mergeGeometries(parts.map(flat), false);
  if (!m) throw new Error(`carGeometry: ${what} merge failed`);
  return m;
};

export function carGeometry(kind: CarKind): CarSpec {
  const pf = carShapes(kind);
  const { sh, glass, axle, wheelR, width, lampY, lampX, halfLen, belt, roof } = pf;
  const ex = extrudeProfile;
  const van = kind === 'van';
  const body = sculptBody(ex(sh, width, 0.05, 14), halfLen, belt, roof);
  const gl = sculptBody(ex(glass, width - 0.06, 0.012, 14), halfLen, belt, roof);
  /* THE VAN IS DRAWN FACING THE WRONG WAY. Its profile rakes up at -x (that
     steep rise IS the windscreen) and its slab end is at +x — but `place` puts
     head lamps at +lampX and tail lamps at -lampX for every body alike. Turned
     here, at the source. rotateY, NOT scale(-1,1,1): negating an axis reverses
     triangle winding and turns the body inside out. */
  if (van) { body.rotateY(Math.PI); gl.rotateY(Math.PI); }
  /* TRACK IS MEASURED, NOT ASSUMED: ExtrudeGeometry's bevel adds to Z as well
     as XY, so the body is wider than `width`. Mirrors, handles, seams and the
     wheels all hang off measured half-widths so they land on the skin. */
  const mirrorY = belt + 0.02;
  const shoulder = halfWidthAt(body, pf.mirrorX - 0.15, pf.mirrorX + 0.15, belt + 0.06);
  const bb = new THREE.Box3().setFromBufferAttribute(body.attributes.position as THREE.BufferAttribute);
  const sill = bb.min.y;
  const withM = withMirrors(body, pf.mirrorX, mirrorY, shoulder, bb.max.x, bb.min.x, sill + 0.02);
  const skin = (x: number) => halfWidthAt(body, x - 0.03, x + 0.03, belt - 0.01);

  /* PILLARS — split the side glass at the B-pillar (an SUV at a C-pillar too).
     Body-coloured, as deep as the MEASURED glass so they sit flush. */
  const glassBox = new THREE.Box3().setFromBufferAttribute(gl.attributes.position as THREE.BufferAttribute);
  const paint: THREE.BufferGeometry[] = [withM];
  pf.pillars.forEach((px) => {
    const half = halfWidthAt(gl, px - 0.03, px + 0.03, glassBox.max.y) + 0.004;
    const h = glassBox.max.y - glassBox.min.y + 0.01;
    paint.push(new THREE.BoxGeometry(0.035, h, half * 2).translate(px, (glassBox.max.y + glassBox.min.y) / 2, 0));
  });
  /* DOOR HANDLES, body-coloured, just behind each door's leading shut line. */
  pf.seams.slice(1).forEach((sx) => {
    const hx = sx + (van ? -0.1 : 0.07), hw = skin(hx);
    if (hw > 0) for (const z of [-1, 1]) paint.push(new THREE.BoxGeometry(0.05, 0.014, 0.012).translate(hx, belt - 0.035, z * (hw + 0.004)));
  });

  /* THE TRIM SET: every black detail, as one geometry (one draw per type). */
  const dark: THREE.BufferGeometry[] = [];
  /* WINDOW SEALS. A rubber ring round the glass opening, set a hair proud of
     the glass: without it the glazing meets the paint edge-on and reads as a
     dark panel painted onto the body. Outline = the glass shape; hole = the
     same shape drawn in toward its centre. */
  {
    const pts = glass.getPoints(20);
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const ring = new THREE.Shape(pts);
    ring.holes.push(new THREE.Path(pts.map((p) => new THREE.Vector2(cx + (p.x - cx) * 0.93, cy + (p.y - cy) * 0.9))));
    const seal = sculptBody(ex(ring, width - 0.045, 0.006, 8), halfLen, belt, roof);
    if (van) seal.rotateY(Math.PI);
    dark.push(seal);
  }
  const archHalf = halfWidthAt(body, axle - 0.12, axle + 0.12, belt);
  // Wheel wells: a dark drum filling each arch across the car, so the gap over
  // the tyre reads as a well instead of showing lit bodywork through the car.
  for (const ax of [-axle, axle]) {
    dark.push(new THREE.CylinderGeometry(pf.arch - 0.004, pf.arch - 0.004, archHalf * 1.86, 20).rotateX(Math.PI / 2).translate(ax, pf.archY, 0));
  }
  // Door shut lines, from just above the sill tuck to under the beltline.
  const seamY0 = Math.max(0.2, sill + 0.06), seamY1 = belt - 0.008;
  if (seamY1 > seamY0) {
    pf.seams.forEach((sx) => {
      const hw = skin(sx);
      if (hw > 0) for (const z of [-1, 1]) dark.push(new THREE.BoxGeometry(0.006, seamY1 - seamY0, 0.004).translate(sx, (seamY0 + seamY1) / 2, z * (hw + 0.0015)));
    });
  }
  // Sill trim between the arches, and lower intake / rear diffuser.
  const sillHw = halfWidthAt(body, -0.1, 0.1, sill + 0.08);
  const sillLen = 2 * (axle - pf.arch) - 0.04;
  if (sillLen > 0.05 && sillHw > 0) for (const z of [-1, 1]) dark.push(new THREE.BoxGeometry(sillLen, 0.028, 0.006).translate(0, sill + 0.03, z * (sillHw + 0.002)));
  const bw = shoulder * 1.4;
  dark.push(new THREE.BoxGeometry(0.02, 0.045, bw).translate(bb.max.x - 0.005, sill + 0.075, 0));
  dark.push(new THREE.BoxGeometry(0.02, 0.035, bw * 0.9).translate(bb.min.x + 0.005, sill + 0.06, 0));
  if (kind === 'luxury') {
    // A tall, upright grille — the luxury saloon's signature.
    dark.push(new THREE.BoxGeometry(0.02, 0.09, 0.26).translate(bb.max.x - 0.006, sill + 0.17, 0));
  }
  if (kind === 'offroad') {
    // Spare wheel on the tailgate and roof rails.
    dark.push(new THREE.TorusGeometry(0.11, 0.04, 8, 20).rotateY(Math.PI / 2).translate(bb.min.x - 0.035, 0.42, 0));
    const rw = halfWidthAt(body, -0.3, 0.2, Infinity) - 0.05;
    for (const z of [-1, 1]) dark.push(new THREE.BoxGeometry(0.9, 0.018, 0.022).translate(-0.15, roof + 0.03, z * rw));
  }
  if (kind === 'hyper') {
    // Rear wing on two uprights, and an intake behind each door.
    dark.push(new THREE.BoxGeometry(0.13, 0.012, width + 0.08).translate(-0.72, roof - 0.005, 0));
    for (const z of [-1, 1]) dark.push(new THREE.BoxGeometry(0.02, 0.05, 0.02).translate(-0.72, roof - 0.035, z * 0.18));
    const iw = skin(-0.32);
    if (iw > 0) for (const z of [-1, 1]) dark.push(new THREE.BoxGeometry(0.14, 0.06, 0.006).translate(-0.32, 0.2, z * (iw + 0.002)));
  }

  return {
    body: merge(paint, 'paint'),
    glass: gl,
    trim: merge(dark, 'trim'),
    axle, wheelR, width: width + 0.1, lampY, lampX,
    track: archHalf - 0.022,
    halfLen, belt,
  };
}

/* ---- lamps -----------------------------------------------------------------
   A lamp is two parts on two instanced meshes: the HOUSING (an unlit lens over
   a reflector — dark chrome at the front, smoked red at the back) and the
   emitters inside it. Built facing +x for the head lamp; the tail unit is
   built facing -x, so both mount at the car's own ±lampX with no special case.
   Sized for a modern unit: a slim bar ~0.56 m wide, ~10 cm tall. */
const lampMerge = (parts: THREE.BufferGeometry[]) => merge(parts, 'lamp');

export function headLampGeometry() {
  const housing = lampMerge([new THREE.BoxGeometry(0.03, 0.036, 0.2)]);
  const led = lampMerge([
    // LED daytime-running strip along the top edge of the lens.
    new THREE.BoxGeometry(0.006, 0.008, 0.17).translate(0.016, 0.011, 0),
    // Two projector lenses below it.
    new THREE.CylinderGeometry(0.011, 0.011, 0.006, 14).rotateZ(-Math.PI / 2).translate(0.016, -0.005, -0.045),
    new THREE.CylinderGeometry(0.011, 0.011, 0.006, 14).rotateZ(-Math.PI / 2).translate(0.016, -0.005, 0.0),
  ]);
  return { housing, led };
}

export function tailLampGeometry() {
  const housing = lampMerge([new THREE.BoxGeometry(0.03, 0.046, 0.2)]);
  const led = lampMerge([
    // Light-bar along the top of the cluster…
    new THREE.BoxGeometry(0.006, 0.01, 0.18).translate(-0.016, 0.014, 0),
    // …and a separate, larger brake element below it.
    new THREE.BoxGeometry(0.006, 0.02, 0.08).translate(-0.016, -0.007, 0.03),
  ]);
  return { housing, led };
}

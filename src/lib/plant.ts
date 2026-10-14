import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { extrudeProfile } from './vehicle';

/* ---- construction plant ----------------------------------------------------
   The excavator, the tipper and the mixer, built as real machines rather than
   stacks of boxes: lathe-turned tyres with tread and dished rims, a track belt
   with shoes all the way round its loop, a curved boom on hydraulic rams, a
   toothed bucket, a forward-control truck cab with grille, visor, mirrors and
   steps, a ribbed tipping body with its load, and a pear-shaped mixer drum.

   Every machine is authored as an ordinary scene graph — which is the only sane
   way to pose a boom, a stick and a bucket — and then BAKED: every mesh is
   merged into one geometry per material. So the detail costs vertices, once,
   and not draw calls; the whole excavator is about eight calls, fewer than the
   simpler build it replaces. Parts that must still move on their own (the
   mixer barrel) are flagged `userData.keep` and baked separately.

   Units are the scene's: 1 = 2.8 m. Nose / boom toward +x, like the rest of the
   fleet. Nothing here knows where a machine stands; HeroSite places them.    */

export type PlantMats = {
  paint: THREE.Material;  // livery red
  white: THREE.Material;  // white cab / panels
  glass: THREE.Material;
  frame: THREE.Material;  // dark painted steel: chassis, grilles, pillars, trims
  steel: THREE.Material;  // bare steel: bucket edge, teeth, ladder, pins
  track: THREE.Material;  // undercarriage, rubber
  tyre: THREE.Material;
  chrome: THREE.Material; // rams, rims, tanks
  head: THREE.Material;   // emissive head / work lamps
  tail: THREE.Material;   // emissive tail lamps
  amber: THREE.Material;  // emissive beacon / markers
  soil: THREE.Material;
};

const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
};
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
/** Cylinder whose axis runs along Z. */
const cylZ = (r: number, len: number, seg = 16) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
/** Cylinder whose axis runs along X (top radius at +x). */
const cylX = (rTop: number, rBot: number, len: number, seg = 16) =>
  new THREE.CylinderGeometry(rTop, rBot, len, seg).rotateZ(-Math.PI / 2);

/** Rounded box: a rounded-rectangle side profile extruded and bevelled, so the
 *  edges catch light the way a pressed panel does instead of cutting off hard. */
const rbox = (w: number, h: number, d: number, r = 0.02) => {
  const b = Math.min(r, w / 4, h / 4, d / 4);
  const iw = w - 2 * b, ih = h - 2 * b;
  const cr = Math.min(r, iw / 2, ih / 2) * 0.5;
  const s = new THREE.Shape();
  s.moveTo(-iw / 2 + cr, -ih / 2);
  s.lineTo(iw / 2 - cr, -ih / 2);
  s.quadraticCurveTo(iw / 2, -ih / 2, iw / 2, -ih / 2 + cr);
  s.lineTo(iw / 2, ih / 2 - cr);
  s.quadraticCurveTo(iw / 2, ih / 2, iw / 2 - cr, ih / 2);
  s.lineTo(-iw / 2 + cr, ih / 2);
  s.quadraticCurveTo(-iw / 2, ih / 2, -iw / 2, ih / 2 - cr);
  s.lineTo(-iw / 2, -ih / 2 + cr);
  s.quadraticCurveTo(-iw / 2, -ih / 2, -iw / 2 + cr, -ih / 2);
  return extrudeProfile(s, Math.max(0.001, d - 2 * b), b, 4);
};

/** A band between two concentric arcs — bucket shell, fenders, chute. Angles in
 *  radians, counter-clockwise from a0 to a1. */
const arcBand = (cx: number, cy: number, rOut: number, rIn: number, a0: number, a1: number, depth: number) => {
  const s = new THREE.Shape();
  s.moveTo(cx + rOut * Math.cos(a0), cy + rOut * Math.sin(a0));
  s.absarc(cx, cy, rOut, a0, a1, false);
  s.lineTo(cx + rIn * Math.cos(a1), cy + rIn * Math.sin(a1));
  s.absarc(cx, cy, rIn, a1, a0, true);
  s.closePath();
  return extrudeProfile(s, depth, 0.006, 16);
};

/** A hydraulic ram between two pins in the parent's XY plane: painted barrel,
 *  gland collar, chrome rod, and an eye at each end. */
function ram(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, rb: number, rr: number, m: PlantMats, barrelMat = m.paint, frac = 0.58) {
  const d = b.clone().sub(a);
  const L = d.length();
  const g = new THREE.Group();
  g.position.copy(a);
  g.quaternion.setFromUnitVectors(UP, d.normalize());
  const bl = L * frac;
  g.add(mesh(new THREE.CylinderGeometry(rb, rb, bl, 14), barrelMat, 0, bl / 2, 0));
  g.add(mesh(new THREE.CylinderGeometry(rb * 1.14, rb * 1.14, 0.03, 14), barrelMat, 0, bl, 0));
  g.add(mesh(new THREE.CylinderGeometry(rr, rr, L - bl + 0.02, 12), m.chrome, 0, bl + (L - bl) / 2 - 0.01, 0));
  parent.add(g);
  parent.add(mesh(cylZ(rb * 1.05, rb * 2.6, 12), barrelMat, a.x, a.y, a.z));
  parent.add(mesh(cylZ(rr * 1.7, rb * 2.6, 12), m.steel, b.x, b.y, b.z));
}

/* ---- wheels ------------------------------------------------------------------
   A tyre is a LATHE of a real cross-section — bead, bulging sidewall, square
   shoulder, flat crown — not a torus, which is a doughnut. Tread blocks in two
   staggered rows ring the crown. The rim is a dished steel wheel: a recessed
   face, a raised hub and a ring of studs. Built with its outer face at +z. */
function wheel(r: number, w: number, m: PlantMats, lugs: boolean) {
  const g = new THREE.Group();
  const ri = r * 0.62;
  const prof = [
    V(ri, -w * 0.40), V(r * 0.80, -w * 0.50), V(r * 0.93, -w * 0.49), V(r * 0.99, -w * 0.42),
    V(r, -w * 0.30), V(r, w * 0.30), V(r * 0.99, w * 0.42), V(r * 0.93, w * 0.49),
    V(r * 0.80, w * 0.50), V(ri, w * 0.40),
  ].map((p) => new THREE.Vector2(p.x, p.y));
  g.add(mesh(new THREE.LatheGeometry(prof, 32).rotateX(Math.PI / 2), m.tyre));
  if (lugs) {
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      for (const zr of [-0.2, 0.2]) {
        const aa = a + (zr > 0 ? Math.PI / n : 0);
        g.add(mesh(box(r * 0.16, r * 0.05, w * 0.34), m.tyre, Math.cos(aa) * r * 1.012, Math.sin(aa) * r * 1.012, zr * w, 0, 0, aa + Math.PI / 2));
      }
    }
  }
  // Rim barrel, recessed face, hub, studs.
  g.add(mesh(cylZ(ri * 0.98, w * 0.8, 24), m.frame));
  g.add(mesh(cylZ(ri * 0.94, 0.012, 24), m.chrome, 0, 0, w * 0.26));
  g.add(mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.25, w * 0.16, 16).rotateX(Math.PI / 2), m.chrome, 0, 0, w * 0.34));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(mesh(cylZ(r * 0.028, w * 0.12, 6), m.steel, Math.cos(a) * r * 0.31, Math.sin(a) * r * 0.31, w * 0.33));
  }
  return g;
}
/** Hang a wheel on `parent` with its outer face toward the side it is on. */
const hangWheel = (parent: THREE.Object3D, wg: THREE.Group, x: number, y: number, z: number) => {
  const c = wg.clone();
  c.position.set(x, y, z);
  if (z < 0) c.rotation.y = Math.PI;
  parent.add(c);
};

/* ---- bake ------------------------------------------------------------------- */
const KEEP_ATTRS = new Set(['position', 'normal', 'uv']);
const tidy = (g: THREE.BufferGeometry, mtx: THREE.Matrix4) => {
  const x = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(x.attributes)) if (!KEEP_ATTRS.has(k)) x.deleteAttribute(k);
  if (!x.attributes.normal) x.computeVertexNormals();
  if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
  x.clearGroups();
  x.morphAttributes = {};
  x.applyMatrix4(mtx);
  return x;
};

/**
 * Collapse a posed scene graph into one mesh per material. `noShadow` lists the
 * materials that should not cast (glass, lamps). A node with `userData.keep`
 * is baked on its own and re-attached under a pivot carrying its parent's
 * transform, so its own `rotation` still animates about its own axes; the
 * baked replacement is left on the source node as `userData.baked`.
 */
export function bake(root: THREE.Object3D, cast: boolean, noShadow: Set<THREE.Material>): THREE.Group {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const used = new Set<THREE.BufferGeometry>();
  const out = new THREE.Group();
  const walk = (o: THREE.Object3D) => {
    for (const c of o.children) {
      if (c.userData.keep) {
        const pivot = new THREE.Group();
        new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld).decompose(pivot.position, pivot.quaternion, pivot.scale);
        const baked = bake(c, cast, noShadow);
        baked.position.copy(c.position);
        baked.quaternion.copy(c.quaternion);
        baked.scale.copy(c.scale);
        pivot.add(baked);
        out.add(pivot);
        c.userData.baked = baked;
        continue;
      }
      const ms = c as THREE.Mesh;
      if (ms.isMesh) {
        const mat = ms.material as THREE.Material;
        const rel = new THREE.Matrix4().multiplyMatrices(inv, ms.matrixWorld);
        if (!buckets.has(mat)) buckets.set(mat, []);
        buckets.get(mat)!.push(tidy(ms.geometry, rel));
        used.add(ms.geometry);
      }
      walk(c);
    }
  };
  walk(root);
  buckets.forEach((list, mat) => {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) return;
    const ms = new THREE.Mesh(merged, mat);
    ms.castShadow = cast && !noShadow.has(mat);
    ms.receiveShadow = cast && !noShadow.has(mat);
    out.add(ms);
  });
  used.forEach((g) => g.dispose());
  return out;
}

const shadowless = (m: PlantMats) => new Set([m.glass, m.head, m.tail, m.amber]);

/* ---- truck cab -----------------------------------------------------------------
   Forward-control cab, the type a tipper or a mixer uses. Origin at the cab's
   REAR-BOTTOM, x forward, ~2.8 m long, 2.5 m wide, 2.45 m tall. */
function truckCab(m: PlantMats, skin: THREE.Material, stripe: THREE.Material | null) {
  const g = new THREE.Group();
  const L = 1.0, H = 0.88, W = 0.82;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0, H - 0.06);
  s.quadraticCurveTo(0, H, 0.07, H);
  s.lineTo(L - 0.1, H);
  s.quadraticCurveTo(L - 0.04, H, L - 0.04, H - 0.05);
  s.lineTo(L, 0.44);                    // windscreen, raked back at the top
  s.lineTo(L, 0.02);
  s.quadraticCurveTo(L, 0, L - 0.03, 0);
  s.closePath();
  // Door window, through both sides of the cab.
  const win = new THREE.Shape();
  win.moveTo(0.46, 0.47);
  win.lineTo(0.46, 0.78);
  win.lineTo(0.86, 0.78);
  win.lineTo(0.92, 0.47);
  win.closePath();
  s.holes.push(new THREE.Path(win.getPoints(4)));
  g.add(mesh(extrudeProfile(s, W, 0.04, 8), skin));
  g.add(mesh(extrudeProfile(win, W + 0.04, 0.004, 4), m.glass));
  // Windscreen on the raked face, in a dark surround, with a wiper.
  const rake = Math.atan2(0.04, H - 0.05 - 0.44);
  const ws = new THREE.Group();
  ws.position.set(L + 0.008, 0.645, 0);
  ws.rotation.z = rake;
  ws.add(mesh(box(0.02, 0.4, W + 0.04), m.frame));
  ws.add(mesh(box(0.012, 0.35, W - 0.04), m.glass, 0.012, 0, 0));
  ws.add(mesh(box(0.008, 0.012, 0.32), m.frame, 0.02, -0.16, -0.12, 0.45, 0, 0));
  ws.add(mesh(box(0.008, 0.012, 0.32), m.frame, 0.02, -0.16, 0.2, 0.45, 0, 0));
  g.add(ws);
  // Sun visor over the screen.
  g.add(mesh(rbox(0.1, 0.04, W + 0.06, 0.012), m.frame, L - 0.02, H - 0.015, 0));
  // Grille: dark panel with five bright bars.
  g.add(mesh(rbox(0.03, 0.26, W * 0.74, 0.01), m.frame, L + 0.03, 0.29, 0));
  for (let i = 0; i < 5; i++) g.add(mesh(box(0.018, 0.016, W * 0.68), m.chrome, L + 0.05, 0.19 + i * 0.05, 0));
  // Bumper with the lamps set into its corners, and the plate between.
  g.add(mesh(rbox(0.14, 0.15, W + 0.1, 0.03), m.frame, L + 0.02, 0.06, 0));
  for (const z of [-1, 1]) {
    g.add(mesh(rbox(0.03, 0.06, 0.16, 0.012), m.head, L + 0.09, 0.08, z * (W / 2 - 0.06)));
    g.add(mesh(box(0.02, 0.025, 0.05), m.amber, L + 0.085, 0.08, z * (W / 2 - 0.17)));
    // Mirrors: arm off the A-pillar, a tall main glass and a wide-angle below.
    const arm = mesh(cylZ(0.008, 0.16, 6), m.frame, L - 0.06, 0.74, z * (W / 2 + 0.11));
    g.add(arm);
    g.add(mesh(rbox(0.03, 0.2, 0.085, 0.012), m.frame, L - 0.04, 0.66, z * (W / 2 + 0.2)));
    g.add(mesh(rbox(0.03, 0.08, 0.075, 0.012), m.frame, L - 0.04, 0.5, z * (W / 2 + 0.19)));
    // Steps under the door, a grab handle beside it, a handle on it.
    g.add(mesh(box(0.2, 0.02, 0.09), m.frame, 0.28, -0.06, z * (W / 2 - 0.02)));
    g.add(mesh(box(0.2, 0.02, 0.09), m.frame, 0.28, -0.2, z * (W / 2 - 0.02)));
    g.add(mesh(box(0.012, 0.3, 0.012), m.chrome, 0.95, 0.3, z * (W / 2 + 0.045)));
    g.add(mesh(box(0.05, 0.012, 0.012), m.chrome, 0.5, 0.42, z * (W / 2 + 0.045)));
    // Door shut lines.
    g.add(mesh(box(0.006, 0.42, 0.006), m.frame, 0.43, 0.4, z * (W / 2 + 0.042)));
    // Livery band along the cab side.
    if (stripe) g.add(mesh(box(0.62, 0.05, 0.004), stripe, 0.5, 0.28, z * (W / 2 + 0.043)));
  }
  // Roof marker lamps along the front edge.
  for (let i = 0; i < 4; i++) g.add(mesh(box(0.025, 0.02, 0.05), m.amber, L - 0.07, H + 0.012, -0.24 + i * 0.16));
  return g;
}

/** Ladder-frame chassis rails with cross-members, under a truck. */
function chassis(g: THREE.Group, m: PlantMats, x0: number, x1: number, y: number) {
  const len = x1 - x0, cx = (x0 + x1) / 2;
  for (const z of [-0.26, 0.26]) g.add(mesh(box(len, 0.12, 0.06), m.frame, cx, y, z));
  for (let i = 0; i < 5; i++) g.add(mesh(box(0.05, 0.08, 0.5), m.frame, x0 + 0.1 + i * (len - 0.2) / 4, y, 0));
}

/** Arched mudguard over a wheel. */
const fender = (g: THREE.Group, mat: THREE.Material, x: number, y: number, z: number, r: number, w: number) => {
  const f = mesh(arcBand(0, 0, r + 0.05, r + 0.03, 0.08, Math.PI - 0.08, w), mat, x, y, z);
  g.add(f);
};

/** Side underrun guard: two bright rails between the axles. */
const sideGuard = (g: THREE.Group, m: PlantMats, x0: number, x1: number) => {
  for (const z of [-0.45, 0.45]) {
    for (const y of [0.24, 0.34]) g.add(mesh(box(x1 - x0, 0.022, 0.012), m.chrome, (x0 + x1) / 2, y, z));
    for (const x of [x0 + 0.05, (x0 + x1) / 2, x1 - 0.05]) g.add(mesh(box(0.02, 0.16, 0.02), m.frame, x, 0.32, z * 0.93));
  }
};

/* ---- dump truck ------------------------------------------------------------------
   8x4 tipper — two steering axles, a twin-tyred tandem at the back — with a
   ribbed tipping body, cab-protector canopy and a heaped load of spoil. ~9.6 m. */
export function buildTipper(m: PlantMats, cast: boolean, lite: boolean): THREE.Group {
  const g = new THREE.Group();
  const R = 0.19, TW = 0.13;
  chassis(g, m, -1.62, 1.5, 0.36);
  const cab = truckCab(m, m.paint, null);
  cab.position.set(0.62, 0.42, 0);
  g.add(cab);
  // Wheels: 2 steer axles, 2 driven axles with twin tyres.
  const wg = wheel(R, TW, m, !lite);
  for (const x of [1.25, 0.55]) for (const z of [-0.38, 0.38]) hangWheel(g, wg, x, R, z);
  for (const x of [-0.72, -1.14]) for (const z of [-0.31, -0.46, 0.31, 0.46]) hangWheel(g, wg, x, R, z);
  for (const x of [1.25, 0.55]) for (const z of [-0.38, 0.38]) fender(g, m.frame, x, R, z, R, TW + 0.04);
  for (const z of [-0.385, 0.385]) g.add(mesh(rbox(0.86, 0.035, 0.32, 0.01), m.frame, -0.93, 2 * R + 0.07, z));
  sideGuard(g, m, -0.48, 0.32);
  // Fuel tank and battery box on the rails, between the axle groups.
  g.add(mesh(cylX(0.09, 0.09, 0.48, 18), m.chrome, -0.12, 0.32, -0.33));
  g.add(mesh(rbox(0.3, 0.18, 0.14, 0.015), m.frame, -0.12, 0.33, 0.35));
  // Exhaust stack behind the cab.
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 10), m.chrome, 0.57, 1.0, 0.33));

  // Tipping body: U-section with flared walls, extruded along the truck.
  const bx0 = -1.7, bx1 = 0.5, by = 0.56;
  const sec = new THREE.Shape();
  const b2 = 0.4, t2 = 0.45, hh = 0.5, th = 0.035;
  sec.moveTo(-t2, hh); sec.lineTo(-b2, 0); sec.lineTo(b2, 0); sec.lineTo(t2, hh);
  sec.lineTo(t2 - th, hh); sec.lineTo(b2 - th, th); sec.lineTo(-b2 + th, th); sec.lineTo(-t2 + th, hh);
  sec.closePath();
  const body = mesh(extrudeProfile(sec, bx1 - bx0, 0.01, 4), m.paint, (bx0 + bx1) / 2, by, 0, 0, Math.PI / 2, 0);
  g.add(body);
  // Subframe, headboard + canopy over the cab, tailgate.
  g.add(mesh(box(bx1 - bx0, 0.08, 0.6), m.frame, (bx0 + bx1) / 2, by - 0.04, 0));
  // Headboard up to cab-roof height, with the protector canopy over the cab.
  g.add(mesh(rbox(0.05, 0.8, 2 * t2, 0.012), m.paint, bx1, by + 0.4, 0));
  g.add(mesh(rbox(0.3, 0.035, 2 * t2 - 0.04, 0.012), m.paint, bx1 + 0.14, by + 0.81, 0));
  const gate = mesh(rbox(0.05, hh + 0.04, 2 * t2 + 0.02, 0.012), m.paint, bx0 - 0.02, by + hh / 2, 0, 0, 0, 0.12);
  g.add(gate);
  // Vertical ribs and top rails on the side walls.
  for (const z of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const rib = mesh(box(0.035, hh, 0.03), m.paint, bx0 + 0.15 + i * 0.31, by + hh / 2, z * (b2 + t2) / 2 + z * 0.02, z * 0.1, 0, 0);
      g.add(rib);
    }
    g.add(mesh(cylX(0.025, 0.025, bx1 - bx0, 10), m.paint, (bx0 + bx1) / 2, by + hh, z * (t2 - th / 2)));
    // Tail lamps on the rear underrun.
    g.add(mesh(rbox(0.03, 0.07, 0.14, 0.01), m.tail, -1.66, 0.3, z * 0.33));
  }
  g.add(mesh(box(0.06, 0.08, 0.86), m.frame, -1.66, 0.22, 0));
  // Telescopic tipping ram between cab and body.
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.06 - i * 0.012, 0.06 - i * 0.012, 0.16, 14), m.chrome, 0.56, 0.44 + i * 0.1, 0));

  // The load: a heaped, lumpy mound of spoil sitting in the body.
  const heap = new THREE.SphereGeometry(1, lite ? 18 : 28, lite ? 8 : 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = heap.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + 0.07 * Math.sin(x * 17 + z * 11) + 0.05 * Math.sin(x * 29 - z * 23 + 1.3);
    p.setXYZ(i, x * n, y * n, z * n);
  }
  heap.computeVertexNormals();
  g.add(mesh(heap.scale(0.98, 0.26, 0.38), m.soil, (bx0 + bx1) / 2 - 0.05, by + hh - 0.1, 0));
  return bake(g, cast, shadowless(m));
}

/* ---- mixer -----------------------------------------------------------------------
   6x4 truck mixer. The drum is a LATHE of a real barrel profile — narrow mouth
   raised at the back, swelling belly, rounded head at the front — with a
   painted spiral, carried on a front pedestal and a rear roller cradle, with
   the hopper, chute, ladder and water tank a real one has. Returns the barrel
   so its spin keeps working. */
export function buildMixer(m: PlantMats, cast: boolean, lite: boolean): { group: THREE.Group; barrel: THREE.Object3D } {
  const g = new THREE.Group();
  const R = 0.19, TW = 0.13;
  chassis(g, m, -1.55, 1.5, 0.36);
  const cab = truckCab(m, m.white, m.paint);
  cab.position.set(0.62, 0.42, 0);
  g.add(cab);
  const wg = wheel(R, TW, m, !lite);
  for (const z of [-0.38, 0.38]) hangWheel(g, wg, 1.25, R, z);
  for (const x of [-0.62, -1.06]) for (const z of [-0.31, -0.46, 0.31, 0.46]) hangWheel(g, wg, x, R, z);
  for (const z of [-0.38, 0.38]) fender(g, m.frame, 1.25, R, z, R, TW + 0.04);
  for (const z of [-0.385, 0.385]) g.add(mesh(rbox(0.82, 0.035, 0.32, 0.01), m.frame, -0.84, 2 * R + 0.07, z));
  sideGuard(g, m, 0.05, 0.85);
  g.add(mesh(cylX(0.1, 0.1, 0.42, 18), m.chrome, 0.32, 0.32, -0.36));

  // Drum, tilted with its mouth raised at the back.
  const drum = new THREE.Group();
  drum.position.set(-0.28, 0.98, 0);
  drum.rotation.z = -0.17;
  const barrel = new THREE.Group();
  barrel.userData.keep = true;
  const prof = [
    [0.15, -0.98], [0.2, -0.93], [0.3, -0.78], [0.42, -0.45], [0.47, -0.12], [0.47, 0.12],
    [0.43, 0.38], [0.33, 0.6], [0.18, 0.72], [0.0001, 0.76],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  barrel.add(mesh(new THREE.LatheGeometry(prof, lite ? 28 : 40).rotateZ(-Math.PI / 2), m.paint));
  barrel.add(mesh(cylX(0.145, 0.145, 0.02, 20), m.frame, -0.95, 0, 0));       // mouth, dark inside
  barrel.add(mesh(new THREE.TorusGeometry(0.31, 0.022, 8, 32).rotateY(Math.PI / 2), m.steel, -0.76, 0, 0)); // roller track
  // Painted spiral on the barrel.
  const radiusAt = (x: number) => {
    for (let i = 1; i < prof.length; i++) {
      if (x <= prof[i].y) {
        const t = (x - prof[i - 1].y) / (prof[i].y - prof[i - 1].y);
        return prof[i - 1].x + (prof[i].x - prof[i - 1].x) * t;
      }
    }
    return 0;
  };
  for (const off of [0, Math.PI]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) {
      const x = -0.7 + (1.25 * i) / 60;
      const a = off + x * 5.2;
      const r = radiusAt(x) + 0.006;
      pts.push(V(x, Math.cos(a) * r, Math.sin(a) * r));
    }
    barrel.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.018, 5, false), m.white));
  }
  drum.add(barrel);
  g.add(drum);
  // Front pedestal (A-frame + gearbox) and rear roller cradle.
  for (const z of [-0.2, 0.2]) {
    g.add(mesh(box(0.06, 0.62, 0.06), m.frame, 0.44, 0.7, z, 0.25 * Math.sign(z), 0, 0));
    g.add(mesh(box(0.06, 0.4, 0.06), m.frame, -1.0, 0.6, z, -0.35 * Math.sign(z), 0, 0));
  }
  g.add(mesh(cylX(0.11, 0.11, 0.16, 16), m.frame, 0.43, 1.02, 0));
  g.add(mesh(box(0.08, 0.06, 0.56), m.frame, -1.0, 0.78, 0));
  // Hopper above the mouth, and the chute under it.
  const hop = new THREE.CylinderGeometry(0.23, 0.07, 0.24, 18, 1, true);
  g.add(mesh(hop, m.paint, -1.24, 1.38, 0, 0, 0, 0.2));
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.01, 18), m.frame, -1.235, 1.44, 0, 0, 0, 0.2));
  // Chute: an open U-section running down and back from under the mouth.
  const chuteHolder = new THREE.Group();
  chuteHolder.position.set(-1.38, 1.0, 0);
  chuteHolder.rotation.z = 0.55;
  chuteHolder.add(mesh(arcBand(0, 0, 0.09, 0.075, Math.PI, Math.PI * 2, 0.62), m.paint, -0.3, 0, 0, 0, Math.PI / 2, 0));
  g.add(chuteHolder);
  // Ladder up the back, and a water tank behind the cab.
  for (const z of [0.16, 0.3]) g.add(mesh(box(0.02, 1.2, 0.02), m.steel, -1.58, 0.82, z, 0, 0, -0.12));
  for (let i = 0; i < 7; i++) { const y = 0.36 + i * 0.16; g.add(mesh(box(0.016, 0.016, 0.14), m.steel, -1.58 + (y - 0.82) * 0.12, y, 0.23)); }
  g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 18), m.white, 0.52, 0.62, -0.34));
  // Tail lamps and rear underrun.
  for (const z of [-0.33, 0.33]) g.add(mesh(rbox(0.03, 0.07, 0.14, 0.01), m.tail, -1.6, 0.3, z));
  g.add(mesh(box(0.06, 0.08, 0.86), m.frame, -1.6, 0.22, 0));

  const group = bake(g, cast, shadowless(m));
  return { group, barrel: barrel.userData.baked as THREE.Object3D };
}

/* ---- excavator ---------------------------------------------------------------------
   20-tonne class tracked excavator. Undercarriage: two track BELTS (a band, not
   a solid capsule) with shoes all the way round the loop, rollers, a front
   idler and a toothed rear sprocket. Upper: offset glazed cab at front-left,
   engine hood and a rounded counterweight behind, tank housing front-right, and
   a curved boom, stick and toothed bucket on three hydraulic rams with the
   bucket linkage. `upper.rotation.y` is the slew. */
export function buildExcavator(m: PlantMats, cast: boolean, lite: boolean): { group: THREE.Group; lampAt: THREE.Vector3 } {
  const g = new THREE.Group();

  // ---- undercarriage
  const TL = 1.72, TR = 0.19, TT = 0.05, TWd = 0.26, h = TL / 2 - TR;
  const belt = new THREE.Shape();
  belt.moveTo(-h, 0);
  belt.lineTo(h, 0);
  belt.absarc(h, TR, TR, -Math.PI / 2, Math.PI / 2, false);
  belt.lineTo(-h, 2 * TR);
  belt.absarc(-h, TR, TR, Math.PI / 2, Math.PI * 1.5, false);
  const hole = new THREE.Path();
  hole.moveTo(-h, TT);
  hole.absarc(-h, TR, TR - TT, Math.PI * 1.5, Math.PI / 2, true);
  hole.lineTo(h, 2 * TR - TT);
  hole.absarc(h, TR, TR - TT, Math.PI / 2, -Math.PI / 2, true);
  hole.closePath();
  belt.holes.push(hole);
  const beltGeo = extrudeProfile(belt, TWd - 0.012, 0.006, 16);
  // Shoe positions round the loop.
  const per = 4 * h + 2 * Math.PI * TR;
  const shoes = lite ? 34 : 50;
  for (const z of [-0.4, 0.4]) {
    g.add(mesh(beltGeo, m.track, 0, 0, z));
    for (let i = 0; i < shoes; i++) {
      let u = (i / shoes) * per, x: number, y: number, a: number;
      if (u < 2 * h) { x = -h + u; y = 0; a = 0; }
      else if ((u -= 2 * h) < Math.PI * TR) { const t = -Math.PI / 2 + u / TR; x = h + Math.cos(t) * TR; y = TR + Math.sin(t) * TR; a = t + Math.PI / 2; }
      else if ((u -= Math.PI * TR) < 2 * h) { x = h - u; y = 2 * TR; a = Math.PI; }
      else { u -= 2 * h; const t = Math.PI / 2 + u / TR; x = -h + Math.cos(t) * TR; y = TR + Math.sin(t) * TR; a = t + Math.PI / 2; }
      const n = V(Math.sin(a), -Math.cos(a));   // outward normal of the loop
      g.add(mesh(box(0.05, 0.022, TWd + 0.02), m.frame, x + n.x * 0.009, y + n.y * 0.009, z, 0, 0, a));
    }
    // Track frame, rollers, idler, sprocket with teeth.
    g.add(mesh(rbox(TL - 2 * TR + 0.04, 0.15, 0.16, 0.02), m.frame, 0, TR, z * 0.98));
    for (let i = 0; i < 6; i++) g.add(mesh(cylZ(0.052, 0.17, 14), m.frame, -h + 0.08 + i * ((2 * h - 0.16) / 5), TT + 0.052, z));
    for (const x of [-0.25, 0.25]) g.add(mesh(cylZ(0.035, 0.12, 12), m.frame, x, 2 * TR - TT - 0.035, z));
    g.add(mesh(cylZ(TR - TT - 0.01, 0.18, 22), m.frame, h, TR, z));
    g.add(mesh(cylZ(TR - TT - 0.01, 0.2, 22), m.frame, -h, TR, z));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.add(mesh(box(0.03, 0.03, 0.06), m.frame, -h + Math.cos(a) * (TR - TT - 0.01), TR + Math.sin(a) * (TR - TT - 0.01), z * 0.93, 0, 0, a));
    }
    g.add(mesh(cylZ(0.06, 0.05, 14), m.chrome, -h, TR, z * 1.27));
  }
  g.add(mesh(rbox(0.7, 0.16, 0.66, 0.03), m.frame, 0, TR + 0.02, 0));     // car body between tracks
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.08, 28), m.frame, 0, 0.42, 0));  // slew ring

  // ---- upper structure
  const up = new THREE.Group();
  up.position.y = 0.47;
  up.rotation.y = 0.5;
  g.add(up);
  up.add(mesh(rbox(1.62, 0.06, 0.94, 0.02), m.frame, -0.12, 0.02, 0));  // deck
  // Counterweight: a rounded rear in plan, extruded up.
  const cw = new THREE.Shape();
  cw.moveTo(-0.55, -0.47);
  cw.lineTo(-0.76, -0.47);
  cw.quadraticCurveTo(-0.96, -0.47, -0.96, -0.24);
  cw.lineTo(-0.96, 0.24);
  cw.quadraticCurveTo(-0.96, 0.47, -0.76, 0.47);
  cw.lineTo(-0.55, 0.47);
  cw.closePath();
  up.add(mesh(extrudeProfile(cw, 0.34, 0.03, 10).rotateX(-Math.PI / 2), m.paint, 0, 0.24, 0));
  // Engine hood with top grille, side louvres and exhaust.
  up.add(mesh(rbox(0.6, 0.3, 0.92, 0.04), m.paint, -0.27, 0.2, 0));
  up.add(mesh(box(0.3, 0.008, 0.46), m.frame, -0.3, 0.354, 0.1));
  for (let i = 0; i < 5; i++) up.add(mesh(box(0.012, 0.012, 0.42), m.frame, -0.42 + i * 0.06, 0.36, 0.1));
  for (let i = 0; i < 6; i++) up.add(mesh(box(0.035, 0.012, 0.004), m.frame, -0.42 + i * 0.05, 0.2 + (i % 2) * 0.0, 0.463));
  up.add(mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.22, 10), m.frame, -0.16, 0.44, 0.28));
  // Tank / tool housing front-right, with a handrail.
  up.add(mesh(rbox(0.54, 0.3, 0.3, 0.03), m.paint, 0.3, 0.2, 0.31));
  for (const x of [0.08, 0.5]) up.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), m.steel, x, 0.41, 0.44));
  up.add(mesh(cylX(0.008, 0.008, 0.44, 6), m.steel, 0.29, 0.47, 0.44));

  // Cab: front-left, glass on four sides between slim pillars.
  const cz = -0.27, cw2 = 0.19, cx0 = 0.04, cx1 = 0.6, cy0 = 0.05, cy1 = 0.68;
  up.add(mesh(rbox(cx1 - cx0, 0.2, 2 * cw2, 0.03), m.paint, (cx0 + cx1) / 2, cy0 + 0.1, cz));
  up.add(mesh(rbox(cx1 - cx0 + 0.04, 0.05, 2 * cw2 + 0.04, 0.02), m.paint, (cx0 + cx1) / 2 - 0.01, cy1, cz));
  const gy0 = cy0 + 0.2, gy1 = cy1 - 0.025, gh = gy1 - gy0, gm = (gy0 + gy1) / 2;
  for (const z of [-1, 1]) {
    up.add(mesh(box(0.03, gh, 0.03), m.frame, cx0 + 0.02, gm, cz + z * (cw2 - 0.015)));
    up.add(mesh(box(0.03, gh + 0.02, 0.03), m.frame, cx1 - 0.04, gm, cz + z * (cw2 - 0.015), 0, 0, 0.1));
    up.add(mesh(box(cx1 - cx0 - 0.05, gh - 0.01, 0.006), m.glass, (cx0 + cx1) / 2 - 0.01, gm, cz + z * (cw2 - 0.012)));
  }
  up.add(mesh(box(0.006, gh - 0.01, 2 * cw2 - 0.03), m.glass, cx1 - 0.04, gm, cz, 0, 0, 0.1));
  up.add(mesh(box(0.006, gh - 0.01, 2 * cw2 - 0.03), m.glass, cx0 + 0.02, gm, cz));
  up.add(mesh(box(0.012, gh * 0.85, 0.012), m.frame, cx0 + 0.32, gm, cz - cw2 + 0.006));      // door frame
  up.add(mesh(box(0.008, 0.012, 0.18), m.frame, cx1 - 0.03, gy0 + 0.06, cz, 0.5, 0, 0));      // wiper
  // Roof work lamps, beacon, mirror.
  const lampY = cy1 + 0.04;
  for (const z of [-0.1, 0.1]) up.add(mesh(rbox(0.04, 0.035, 0.06, 0.01), m.head, cx1 - 0.02, lampY, cz + z));
  up.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.05, 12), m.amber, cx0 + 0.08, lampY, cz + 0.08));
  up.add(mesh(cylZ(0.006, 0.12, 6), m.frame, cx1 - 0.02, 0.5, cz - cw2 - 0.06));
  up.add(mesh(rbox(0.02, 0.1, 0.06, 0.01), m.frame, cx1, 0.5, cz - cw2 - 0.12));

  // ---- boom: a curved, swelling beam on a quadratic centreline
  const bz = 0.05, bw = 0.15;
  const P0 = V(0.46, 0.2), C = V(1.0, 1.26), P2 = V(1.98, 0.95);
  const at = (s: number) => P0.clone().multiplyScalar((1 - s) ** 2).add(C.clone().multiplyScalar(2 * (1 - s) * s)).add(P2.clone().multiplyScalar(s * s));
  const tan = (s: number) => C.clone().sub(P0).multiplyScalar(2 * (1 - s)).add(P2.clone().sub(C).multiplyScalar(2 * s)).normalize();
  const half = (s: number) => 0.075 + 0.075 * Math.sin(Math.PI * s) * (1 - 0.35 * s);
  const top: THREE.Vector3[] = [], bot: THREE.Vector3[] = [];
  for (let i = 0; i <= 20; i++) {
    const s = i / 20, c = at(s), t = tan(s), n = V(-t.y, t.x);
    top.push(c.clone().add(n.clone().multiplyScalar(half(s))));
    bot.push(c.clone().sub(n.clone().multiplyScalar(half(s))));
  }
  const bs = new THREE.Shape();
  bs.moveTo(top[0].x, top[0].y);
  top.slice(1).forEach((p) => bs.lineTo(p.x, p.y));
  bot.reverse().forEach((p) => bs.lineTo(p.x, p.y));
  bs.closePath();
  up.add(mesh(extrudeProfile(bs, bw - 0.024, 0.012, 8), m.paint, 0, 0, bz));
  up.add(mesh(cylZ(0.065, bw + 0.08, 16), m.steel, P0.x, P0.y, bz));
  up.add(mesh(cylZ(0.06, bw + 0.06, 16), m.steel, P2.x, P2.y, bz));
  // Boom rams, one each side of the boom, from the deck to its belly.
  const nrm = (s: number) => { const t = tan(s); return V(-t.y, t.x); };
  const bb = at(0.42).sub(nrm(0.42).multiplyScalar(half(0.42) + 0.02));
  for (const z of [-1, 1]) ram(up, V(0.66, 0.1, bz + z * 0.11), V(bb.x, bb.y, bz + z * 0.11), 0.045, 0.026, m);

  // ---- stick: from the boom tip down to the bucket pin, tail above the tip
  const B = V(2.3, -0.06);
  const sd = B.clone().sub(P2);
  const sl = sd.length(), sa = Math.atan2(sd.y, sd.x);
  const st = new THREE.Shape();
  st.moveTo(-0.3, 0.05); st.lineTo(0.05, 0.1); st.lineTo(sl, 0.055); st.lineTo(sl, -0.05); st.lineTo(0.05, -0.085); st.lineTo(-0.3, -0.04);
  st.closePath();
  const stick = new THREE.Group();
  stick.position.set(P2.x, P2.y, bz);
  stick.rotation.z = sa;
  stick.add(mesh(extrudeProfile(st, 0.1, 0.012, 4), m.paint));
  up.add(stick);
  const dir = V(Math.cos(sa), Math.sin(sa));
  const fwd = V(-dir.y, dir.x);  // the side of the stick facing away from the cab (+x)
  const onStick = (along: number, off: number) => P2.clone().add(dir.clone().multiplyScalar(along)).add(fwd.clone().multiplyScalar(off));
  // Arm ram: boom top to the stick's tail.
  const bt = at(0.36).add(nrm(0.36).multiplyScalar(half(0.36) + 0.03));
  const tail = onStick(-0.3, 0);
  ram(up, V(bt.x, bt.y, bz), V(tail.x, tail.y, bz), 0.05, 0.03, m);
  // Bucket ram and linkage.
  const link = onStick(sl - 0.2, 0.13);
  const bAnchor = onStick(0.12, 0.1);
  ram(up, V(bAnchor.x, bAnchor.y, bz), V(link.x, link.y, bz), 0.038, 0.022, m);
  for (const z of [-1, 1]) {
    const l1 = onStick(sl - 0.22, 0.0);
    const ld = link.clone().sub(l1);
    up.add(mesh(box(ld.length(), 0.03, 0.015), m.steel, (l1.x + link.x) / 2, (l1.y + link.y) / 2, bz + z * 0.065, 0, 0, Math.atan2(ld.y, ld.x)));
    const ear = B.clone().add(fwd.clone().multiplyScalar(0.12)).add(dir.clone().multiplyScalar(0.04));
    const ed = ear.clone().sub(link);
    up.add(mesh(box(ed.length(), 0.035, 0.015), m.steel, (ear.x + link.x) / 2, (ear.y + link.y) / 2, bz + z * 0.075, 0, 0, Math.atan2(ed.y, ed.x)));
  }

  // ---- bucket: curved shell, side plates, cutting edge and five teeth
  const bk = new THREE.Group();
  bk.position.set(B.x, B.y, bz);
  bk.rotation.z = 0.15;
  const cxB = 0.12, cyB = -0.22, Ro = 0.24, Ri = 0.218, a0 = THREE.MathUtils.degToRad(78), a1 = THREE.MathUtils.degToRad(282);
  bk.add(mesh(arcBand(cxB, cyB, Ro, Ri, a0, a1, 0.4), m.frame));
  const side = new THREE.Shape();
  side.moveTo(cxB, cyB);
  side.lineTo(cxB + Ro * Math.cos(a0), cyB + Ro * Math.sin(a0));
  side.absarc(cxB, cyB, Ro, a0, a1, false);
  side.closePath();
  for (const z of [-1, 1]) bk.add(mesh(extrudeProfile(side, 0.012, 0.004, 12), m.frame, 0, 0, z * 0.215));
  const tip = V(cxB + Ro * Math.cos(a1), cyB + Ro * Math.sin(a1));
  const ta = a1 + Math.PI / 2;
  bk.add(mesh(box(0.05, 0.016, 0.44), m.steel, tip.x + Math.cos(ta) * 0.015, tip.y + Math.sin(ta) * 0.015, 0, 0, 0, ta));
  for (let i = 0; i < 5; i++) {
    const tooth = new THREE.CylinderGeometry(0.004, 0.02, 0.09, 4).rotateZ(-Math.PI / 2);
    bk.add(mesh(tooth, m.steel, tip.x + Math.cos(ta) * 0.06, tip.y + Math.sin(ta) * 0.06, -0.17 + i * 0.085, 0, 0, ta));
  }
  for (const z of [-1, 1]) bk.add(mesh(box(0.12, 0.08, 0.018), m.steel, 0.04, -0.02, z * 0.08));
  up.add(bk);
  // Work lamp on the boom.
  const bl = at(0.3);
  up.add(mesh(rbox(0.05, 0.04, 0.06, 0.01), m.head, bl.x, bl.y + half(0.3) + 0.02, bz));

  const group = bake(g, cast, shadowless(m));
  // Where the warm work light goes, in the excavator's own frame.
  const lampAt = V(1.5, 0.5, 0).applyEuler(up.rotation).add(up.position);
  return { group, lampAt };
}

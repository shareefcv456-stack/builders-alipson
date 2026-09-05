import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { N8AOPass } from 'n8ao';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  blueprintTexture, brandTexture, concreteMaps, dirtMaps, facadeTexture, grassMaps,
  metalRoughness, pavingMaps, skylineTexture, softDot,
} from '../lib/procTex';
import { laneX, overtaker, type Lane } from '../lib/traffic';
import { exitCurve, exitU } from '../lib/exit';
import { carGeometry, extrudeProfile } from '../lib/vehicle';
import { EMPTY_GEO, loadModel, type PlantSlot } from '../lib/models';
import { isLowPower, isPhone } from '../lib/device';

/**
 * ALIPSON — SCROLL-DRIVEN CONSTRUCTION.
 *
 * ONE building, LIVE-BUILT, shot as an architectural film. There is a single
 * WebGL scene and a single continuous camera; every stage below is the SAME
 * geometry growing. Nothing is ever swapped for anything else.
 *
 * The five site photographs in `public/images/` are the ART DIRECTION for the
 * stages — they are never drawn. Each was read for footprint, bay rhythm,
 * storey count, materials, light direction and time of day, and that reading is
 * what the geometry below reconstructs:
 *
 *   foundation-1.png  battered excavation, 4x3 bay grade-beam grid on pad
 *                     footings, rebar mat in the bays, starter cages standing
 *                     proud, warm site floods, hoarding, plant
 *   foundation-2.png  basement poured, podium slab cast, columns with their
 *                     cages protruding, first frame bays open
 *   foundation-3.png  six storeys of frame, slab after slab, perimeter
 *                     scaffolding, tower crane over the top, crews on the deck
 *   foundation-4.png  stone piers and dark spandrels close the frame, curtain
 *                     wall glazes bay by bay, floors light from inside
 *   foundation-5.png  finished landmark — cove-lit parapet, lit piers, glazed
 *                     entrance under a signed canopy, forecourt, parking, wet
 *                     street, planting, city behind
 *
 * `update(t)` takes the 0..1 playhead StoryScroll drives everything with. No
 * React state: scroll writes matrices and material values once per frame, and
 * every value is a pure function of `t`, so scrolling UP runs the build
 * backwards for free.
 *
 * ---- WHAT MAKES IT READ AS ARCHITECTURE RATHER THAN AS A GAME ---------------
 *   · ambient occlusion (N8AO) — contact shading under slabs, kerbs and tyres
 *   · MSAA on the composer's own target, or the whole frame is aliased
 *   · entourage at true scale — crews, cars, street furniture, planting
 *   · a lighting STORY: late afternoon → golden hour → blue hour → night
 *   · atmospheric perspective through three depth layers of city
 *   · an architectural lens (34–40° fov), never a distorting wide angle
 */
export type ThreeHandle = {
  update: (t: number, tail?: number) => void;
  /** Ease the camera onto the finished entrance. Released on the next input. */
  focusGate: () => void;
};

/* ---- maths ---------------------------------------------------------------- */
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const span = (a: number, b: number, v: number) => clamp01((v - a) / (b - a));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Smoothstep — the default for anything that GROWS. */
const ease = (t: number) => t * t * (3 - 2 * t);
/** Decelerating — for anything that is PLACED rather than grown. */
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
/** Overshooting settle — for panels that snap into a frame. */
const outBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
/** Item i of n, played across [a,b] with neighbours overlapping. */
const stagger = (t: number, a: number, b: number, i: number, n: number, overlap = 0.6) => {
  const step = (b - a) / (n + overlap);
  return span(a + i * step, a + i * step + step * (1 + overlap), t);
};
/** three warns on degenerate matrices — never scale to exactly zero. */
const s0 = (v: number) => (v > 0.0001 ? v : 0.0001);
/** Deterministic hash, so the scene is identical on every load. */
const rnd = (i: number, seed = 1) => {
  const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/* ---- the building ----------------------------------------------------------
   SCALE. One world unit is ~2.8 m. Everything in this file is sized against
   that — a storey is 1.24 (3.5 m), a car is 1.55 long (4.3 m), a person is 0.63
   (1.75 m), a parking bay is 0.92 x 1.9 (2.6 x 5.3 m). Entourage at true scale
   is most of what separates an architectural render from a toy. */
const NX = 4, NZ = 3;                  // structural bays (foundation-1)
const BW = 8.0, BD = 6.0;              // footprint — 22 m x 17 m
const GX = BW / NX, GZ = BD / NZ;      // 2.0 x 2.0 — square bays
const FLOORS = 6;                      // storeys above the podium
const FH = 1.24;                       // floor to floor, 3.5 m
const TOP = FLOORS * FH;               // 7.44 — roof deck
const PIT = 2.0;                       // excavation depth (foundation-1)
const RAFT = 0.76;                     // raft + grade beam — columns start here
const FOOT = -PIT + RAFT;
const COL = 0.4;                       // column section
const SLABT = 0.18;
const BEAM = 0.46;                     // downstand beam depth

const nodeX = (i: number) => -BW / 2 + i * GX;
const nodeZ = (j: number) => -BD / 2 + j * GZ;
/** Soffit height of level k. Level 0 is the podium at grade. */
const LEV = (k: number) => k * FH;
const segBase = (k: number) => (k === 0 ? FOOT : LEV(k - 1));
const segTop = (k: number) => LEV(k);
const SEGS = FLOORS + 1;               // 7 column lifts: basement + 6 storeys

/* Site extents. Deliberately modest: the compound is a SETTING for the
   building, and a tall perimeter in the foreground is the fastest way to make a
   render look like a game level. */
const BX = BW / 2 + 6.4, BZ = BD / 2 + 6.6;   // boundary wall
const ROAD_Z = BD / 2 + 11.5;                  // carriageway centreline
/** Centreline of the vehicle entrance. Module scope because the driveway, the
 *  gate, the planting exclusion zone and the hero car's route all have to agree
 *  on it — they are in three different blocks. */
const DRIVE_X = 6.4;

/* ---- palette (read off the photographs) ------------------------------------ */
const ACCENT = 0xd31018;               // Alipson crimson
const WARM = 0xffb46a;                 // site floods

/* ---- phase map -------------------------------------------------------------
   Fractions of the playhead, matching the pacing brief:
     0.00–0.12 foundation · 0.12–0.28 columns · 0.28–0.45 structural frame
     0.45–0.62 upper floors · 0.62–0.76 facade · 0.76–0.88 glass + exterior
     0.88–0.96 landscape + parking · 0.96–1.00 final hero pull-back          */
const P = {
  plan: [0.0, 0.07] as const,
  dig: [0.04, 0.12] as const,
  pads: [0.06, 0.11] as const,
  gbeam: [0.08, 0.14] as const,
  mat: [0.10, 0.16] as const,
  frame: [0.13, 0.62] as const,        // seven lifts stagger across this
  crane: [0.15, 0.24] as const,
  scaff: [0.30, 0.48] as const,
  crew: [0.20, 0.62] as const,
  pier: [0.62, 0.74] as const,
  glass: [0.70, 0.87] as const,
  lit: [0.80, 0.95] as const,
  clear: [0.80, 0.90] as const,        // hoarding, plant, scaffold, crane leave
  site: [0.86, 0.98] as const,         // paving, boundary, planting, signage
  cars: [0.90, 1.0] as const,          // the property fills up
};
/** Progress of column lift k. */
const liftAt = (t: number, k: number) => stagger(t, P.frame[0], P.frame[1], k, SEGS, 0.8);

/* ---- camera ----------------------------------------------------------------
   ONE flight, eight scenes, keyed directly off `t` — no autoplay, no cut, and
   scrolling back up flies it in reverse. Interpolated Catmull-Rom, so the path
   is smooth THROUGH each key rather than easing to a stop at every one.

   TWO KEY SETS. A phone is not a cropped desktop: at 0.46 aspect the desktop
   framing loses both ends of the building, so portrait gets its own, more
   frontal and further-back composition. Interpolated by the same `t`, so both
   tell the identical story.                                                  */
type Key = { t: number; p: [number, number, number]; l: [number, number, number]; fov: number };

/** SCENE 01 aerial · 02 descend to the foundation · 03 close as columns rise
 *  · 04 rise with the frame · 05 orbit the structure · 06 approach the facade
 *  · 07 round the finished building · 08 wide hero pull-back. */
const KEYS_D: Key[] = [
  { t: 0.00, p: [8.0, 26.0, 28.0], l: [0, 0.0, 0], fov: 36 },
  { t: 0.12, p: [11.0, 10.0, 17.5], l: [0, -1.3, 0], fov: 38 },
  { t: 0.26, p: [12.5, 5.2, 14.0], l: [-0.2, 0.4, 0], fov: 40 },
  { t: 0.40, p: [14.0, 8.4, 15.0], l: [0, 3.2, 0], fov: 38 },
  { t: 0.54, p: [7.5, 12.0, 22.0], l: [0, 4.2, 0], fov: 36 },
  { t: 0.66, p: [-13.5, 10.5, 19.5], l: [-0.5, 4.4, 0], fov: 36 },
  { t: 0.78, p: [-17.0, 5.2, 15.0], l: [-0.9, 3.6, 0], fov: 38 },
  { t: 0.90, p: [-7.5, 3.4, 20.5], l: [-0.6, 3.5, 0], fov: 36 },
  /* THE HERO SHOT. 22 m back on a 32° lens — the building stands ~60% of the
     frame with sky above the parapet and forecourt below, and the look target
     sits left of it so it lands right of the headline block. */
  { t: 1.00, p: [10.2, 6.6, 16.4], l: [-1.6, 3.4, 0], fov: 32 },
];
/** Portrait. Further out and more frontal so the 22 m frontage still fits the
 *  narrow frame, with the building seated in the middle band — copy above it,
 *  stats below. */
const KEYS_M: Key[] = [
  { t: 0.00, p: [7.0, 30.0, 26.0], l: [0.0, 0.0, 0.0], fov: 51 },
  { t: 0.12, p: [12.76, 17.51, 28.35], l: [0.0, -1.2, 0.0], fov: 52 },
  { t: 0.26, p: [16.98, 9.46, 28.34], l: [-0.2, 0.6, 0.0], fov: 52 },
  { t: 0.40, p: [18.14, 12.23, 28.03], l: [0.0, 3.0, 0.0], fov: 52 },
  { t: 0.54, p: [7.01, 16.46, 28.04], l: [0.0, 4.4, 0.0], fov: 51 },
  { t: 0.66, p: [-16.79, 15.92, 30.02], l: [-0.4, 4.4, 0.0], fov: 51 },
  { t: 0.78, p: [-23.75, 7.37, 28.68], l: [-0.8, 3.2, 0.0], fov: 52 },
  { t: 0.90, p: [-11.18, 4.53, 31.49], l: [-0.3, 3.0, 0.0], fov: 51 },
  { t: 1.00, p: [12.53, 5.55, 30.35], l: [0.0, 2.9, 0.0], fov: 51 },
];

/* ---- act two's camera ------------------------------------------------------
   Keyed by `o`, not by `t`. Key 0 of each set is DELIBERATELY IDENTICAL to the
   last build key, so the hand-off from act one is continuous by construction
   rather than by a crossfade: at o = 0 both sets evaluate to the same shot.

     0.00  the hero shot, held
     0.24  pull back and drop — the whole compound, gate in frame
     0.48  lower still, the gate centre-frame as it opens
     0.68  swinging toward the road as the car comes through
     0.86  down at road level, running with the car
     1.00  risen, the road to the horizon, the landmark over the shoulder    */
const OUT_D: Key[] = [
  { t: 0.00, p: [10.2, 6.6, 16.4], l: [-1.6, 3.4, 0], fov: 32 },
  { t: 0.24, p: [13.4, 5.2, 19.6], l: [1.8, 2.4, 4.2], fov: 34 },
  { t: 0.48, p: [13.2, 4.2, 20.0], l: [4.6, 2.4, 8.4], fov: 36 },
  { t: 0.68, p: [11.6, 3.9, 19.4], l: [3.4, 2.0, 11.4], fov: 38 },
  /* THE TRAFFIC SHOT, BROUGHT DOWN TO THE STREET.
     These two keys used to sit 16 m and 25 m up and 24-25 m back. The vehicles
     are correctly sized — a saloon measures 4.87 m against a 22.4 m frontage
     and a 3.64 m lane — but from 25 m up a correct car is a small car, which is
     why the road read as a model. Dropped to roughly 10 m and 14 m and pulled
     ~7 m nearer the carriageway, so the traffic reads at the scale it actually
     is. Nothing about the PATH changes: same keys, same times, same easing,
     same hand-off from key 0 (which still matches the last build key exactly).
     The look targets come down with the camera so the building stays framed
     rather than sliding out of the top. */
  { t: 0.86, p: [10.0, 3.6, 20.6], l: [8.6, 2.0, 9.2], fov: 40 },
  { t: 1.00, p: [11.0, 5.0, 21.4], l: [11.4, 2.4, 6.4], fov: 38 },
];
const OUT_M: Key[] = [
  { t: 0.00, p: [12.53, 5.55, 30.35], l: [0.0, 2.9, 0.0], fov: 51 },
  { t: 0.24, p: [8.9, 5.35, 18.27], l: [2.2, 2.4, 3.8], fov: 52 },
  { t: 0.48, p: [10.29, 4.21, 18.45], l: [5.2, 1.8, 8.8], fov: 52 },
  { t: 0.68, p: [9.5, 3.68, 17.03], l: [3.6, 1.8, 11.0], fov: 52 },
  { t: 0.86, p: [11.2, 7.56, 18.99], l: [-3.0, 1.4, 8.0], fov: 52 },
  { t: 1.00, p: [12.91, 10.71, 22.42], l: [-2.5, 1.6, 5.0], fov: 52 },
];

const crv = (a: number, b: number, c: number, d: number, u: number) => {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
};
const camKey = (K: Key[], t: number, outP: THREE.Vector3, outL: THREE.Vector3): number => {
  let i = 0;
  while (i < K.length - 2 && t > K[i + 1].t) i++;
  const k0 = K[Math.max(0, i - 1)], k1 = K[i], k2 = K[i + 1], k3 = K[Math.min(K.length - 1, i + 2)];
  const u = clamp01((t - k1.t) / (k2.t - k1.t));
  outP.set(
    crv(k0.p[0], k1.p[0], k2.p[0], k3.p[0], u),
    crv(k0.p[1], k1.p[1], k2.p[1], k3.p[1], u),
    crv(k0.p[2], k1.p[2], k2.p[2], k3.p[2], u),
  );
  outL.set(
    crv(k0.l[0], k1.l[0], k2.l[0], k3.l[0], u),
    crv(k0.l[1], k1.l[1], k2.l[1], k3.l[1], u),
    crv(k0.l[2], k1.l[2], k2.l[2], k3.l[2], u),
  );
  return mix(k1.fov, k2.fov, u);
};
/** Where `focusGate()` parks the camera: the lit entrance, head-on. */
const GATE_CAM = new THREE.Vector3(1.4, 2.0, 13.0);
const GATE_LOOK = new THREE.Vector3(0, 1.6, 2.4);

/* ---- sky ------------------------------------------------------------------
   THREE skies, ONE cloudscape. All three share the same cloud seeds, so
   blending between them is a change of LIGHT rather than a dissolve between two
   different photographs — which is what makes the time-of-day move read as a
   film and not as a crossfade. */
type SkyKind = 0 | 1 | 2;   // 0 late afternoon · 1 golden hour · 2 night
const SKY_RAMP: Record<SkyKind, [number, string][]> = {
  0: [[0, '#20344f'], [0.34, '#3d5876'], [0.60, '#6d8296'], [0.82, '#9aa6ac'], [1, '#b9b3a4']],
  1: [[0, '#132441'], [0.32, '#3a4064'], [0.58, '#8a5a58'], [0.80, '#d4834a'], [1, '#f0a95e']],
  2: [[0, '#04060e'], [0.34, '#0b1428'], [0.60, '#17284c'], [0.82, '#283a5e'], [1, '#3b4363']],
};
const SKY_SUN: Record<SkyKind, [string, string, number]> = {
  0: ['rgba(232,226,204,0.34)', 'rgba(200,206,206,0)', 0.30],
  1: ['rgba(255,178,96,0.92)', 'rgba(206,96,64,0)', 0.42],
  2: ['rgba(196,104,64,0.5)', 'rgba(140,70,60,0)', 0.30],
};

function skyTexture(kind: SkyKind, W = 1024, H = 512): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, H);
  SKY_RAMP[kind].forEach(([stop, colr]) => grad.addColorStop(stop, colr));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // The sun's bloom, low and to one side — the anchor the whole grade hangs off.
  const [c0, c1, r] = SKY_SUN[kind];
  const warm = g.createRadialGradient(W * 0.70, H * 0.84, 0, W * 0.70, H * 0.84, W * r);
  warm.addColorStop(0, c0);
  warm.addColorStop(1, c1);
  g.fillStyle = warm;
  g.fillRect(0, 0, W, H);

  /* Cloud. Layered bands of soft ellipses lit from the sun side, with the SAME
     seeds in all three skies so only the colour changes between them. */
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 70; i++) {
      const id = layer * 70 + i;
      const y = H * (0.05 + layer * 0.14 + rnd(id, 3) * 0.20);
      const x = W * rnd(id, 7);
      const w = (30 + rnd(id, 11) * 210) * (1 + layer * 0.3);
      const h = (3 + rnd(id, 13) * 11) * (1 + layer * 0.2);
      const sun = 1 - Math.min(1, Math.abs(x / W - 0.70) * 1.9);
      const lit = 0.35 + sun * 0.65;
      const base = kind === 1
        ? 'rgba(' + Math.round(210 + lit * 45) + ',' + Math.round(150 + lit * 70) + ',' + Math.round(120 + lit * 60) + ','
        : kind === 0
          ? 'rgba(' + Math.round(190 + lit * 55) + ',' + Math.round(196 + lit * 50) + ',' + Math.round(200 + lit * 45) + ','
          : 'rgba(' + Math.round(70 + lit * 90) + ',' + Math.round(86 + lit * 80) + ',' + Math.round(112 + lit * 70) + ',';
      g.fillStyle = base + (0.045 + rnd(id, 17) * 0.11 * lit).toFixed(3) + ')';
      g.beginPath();
      g.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

/** What you see THROUGH the glass: a warm ceiling wash, receding light
 *  troffers, a back wall, the floor plate and the silhouettes of a fitted-out
 *  office. This is the DEPTH behind the curtain wall — without it, glass is a
 *  flat dark rectangle. */
function interiorTexture(size = 256): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#fff0d6');      // lit soffit
  grad.addColorStop(0.16, '#f6cf9a');
  grad.addColorStop(0.62, '#a2724c');
  grad.addColorStop(0.86, '#5c3f2a');   // floor, falling into shadow
  grad.addColorStop(1, '#2b1d14');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  // Ceiling troffers in perspective — shorter and dimmer going back.
  for (let i = 0; i < 5; i++) {
    const y = size * (0.05 + i * 0.036);
    const inset = size * (0.05 + i * 0.055);
    g.fillStyle = 'rgba(255,248,232,' + (0.9 - i * 0.15).toFixed(2) + ')';
    g.fillRect(inset, y, size - inset * 2, Math.max(1, size * (0.016 - i * 0.002)));
  }
  // A back wall, so the room has an end.
  g.fillStyle = 'rgba(120,86,58,0.5)';
  g.fillRect(0, size * 0.42, size, size * 0.1);
  // Desks, screens and chairs, thinning toward the back.
  for (let i = 0; i < 22; i++) {
    const depth = rnd(i, 29);
    const y = size * (0.46 + depth * 0.44);
    const x = size * rnd(i, 23);
    const w = size * (0.04 + depth * 0.09);
    const h = size * (0.03 + depth * 0.07);
    g.fillStyle = 'rgba(28,22,18,' + (0.28 + depth * 0.42).toFixed(2) + ')';
    g.fillRect(x, y, w, h);
    if (rnd(i, 31) > 0.6) {
      g.fillStyle = 'rgba(180,205,225,' + (0.18 + depth * 0.22).toFixed(2) + ')';
      g.fillRect(x + w * 0.15, y - h * 0.45, w * 0.5, h * 0.4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Limestone cladding: warm off-white with recessed panel joints and per-panel
 *  tonal drift, so a 22 m elevation is not one flat colour. */
function stoneTexture(size = 256): { map: THREE.Texture; rough: THREE.Texture } {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!;
  const r = document.createElement('canvas'); r.width = r.height = size;
  const gr = r.getContext('2d')!;
  const ROWS = 4, COLS = 2;
  const rh = size / ROWS, cw = size / COLS;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const k = rnd(y * COLS + x, 13);
      const v = Math.round(214 + (k - 0.5) * 16);
      g.fillStyle = 'rgb(' + v + ',' + (v - 4) + ',' + (v - 14) + ')';
      g.fillRect(x * cw, y * rh, cw, rh);
      const rv = Math.round(150 + (rnd(y * COLS + x, 19) - 0.5) * 40);
      gr.fillStyle = 'rgb(' + rv + ',' + rv + ',' + rv + ')';
      gr.fillRect(x * cw, y * rh, cw, rh);
      // Soft vertical staining, strongest under the joint above.
      const stain = g.createLinearGradient(0, y * rh, 0, y * rh + rh);
      stain.addColorStop(0, 'rgba(120,112,96,0.16)');
      stain.addColorStop(0.35, 'rgba(120,112,96,0)');
      g.fillStyle = stain;
      g.fillRect(x * cw, y * rh, cw, rh);
    }
  }
  g.fillStyle = 'rgba(96,90,78,0.75)';
  gr.fillStyle = 'rgb(96,96,96)';
  for (let y = 0; y <= ROWS; y++) { g.fillRect(0, y * rh - 1.4, size, 2.8); gr.fillRect(0, y * rh - 1.4, size, 2.8); }
  for (let x = 0; x <= COLS; x++) { g.fillRect(x * cw - 1.2, 0, 2.4, size); gr.fillRect(x * cw - 1.2, 0, 2.4, size); }
  const mk = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: mk(c, true), rough: mk(r, false) };
}

/** Asphalt with lane markings and a wet sheen, for the carriageway. */
function roadTexture(size = 512): THREE.Texture {
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1a1c20'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 4000; i++) {
    const v = Math.round(20 + rnd(i, 41) * 26);
    g.fillStyle = 'rgba(' + v + ',' + (v + 2) + ',' + (v + 5) + ',0.5)';
    g.fillRect(rnd(i, 43) * size, rnd(i, 47) * size, 2, 2);
  }
  g.fillStyle = 'rgba(226,226,216,0.72)';
  for (let x = 0; x < size; x += size / 8) g.fillRect(x + size / 32, size * 0.49, size / 16, size * 0.02);
  g.fillStyle = 'rgba(214,214,204,0.5)';
  g.fillRect(0, size * 0.055, size, size * 0.014);
  g.fillRect(0, size * 0.93, size, size * 0.014);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Reflections for glass, metal and wet asphalt. Not an HDRI — a small scene of
 *  graded sky, two horizon bands, a ground plane and lit neighbours, convolved
 *  by PMREM. It costs no download, and it is the difference between glass and
 *  grey plastic. */
function duskEnvironment(): THREE.Scene {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(
    new THREE.SphereGeometry(60, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x1b2c4c, side: THREE.BackSide }),
  ));
  ([[0xd08046, 0.9, 8], [0x37527e, 0.55, 20]] as const).forEach(([colr, op, h]) => {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(56, 56, h, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: colr, side: THREE.BackSide, transparent: true, opacity: op }),
    );
    band.position.y = h * 0.15;
    env.add(band);
  });
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(56, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x14161c }),
  );
  ground.position.y = -9;
  env.add(ground);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = 28 + (i % 5) * 6;
    const h = 8 + ((i * 7) % 18);
    const warm = i % 4 === 0;
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(5 + (i % 3) * 2, h, 5),
      new THREE.MeshBasicMaterial({ color: warm ? 0xffcf96 : i % 3 === 0 ? 0x53617e : 0x191f2c }),
    );
    b.position.set(Math.cos(a) * r, -9 + h / 2, Math.sin(a) * r);
    env.add(b);
  }
  return env;
}




/* ---- the figure -------------------------------------------------------------
   ONE HUMAN, THREE MATERIAL GROUPS, TWO CALLERS. The site crew and the people
   on the footway were separately-written stacks of boxes: a slab torso, two
   slab legs, a ball for a head, and NO ARMS AT ALL — which is the detail the
   eye actually misses, because an armless silhouette does not read as a person
   however good the proportions are.

   Built once here so both callers get the same body. Capsules, not boxes: a
   limb is a swept circle and a capsule is the cheapest primitive that is one,
   at 3x6 segments it costs less than the box it replaces once the box's own
   bevel-free hard edges stop catching specular, and it is the difference
   between a mannequin and a crate with legs.

   1.75 m ≈ 0.63 units, and every landmark below is measured off that: hip at
   0.30, shoulder at 0.52, crown at 0.63.                                     */
function figureParts() {
  const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 3, 6);

  // Legs, mid-stride — one forward, one back. Instanced, so this is a single
  // pose for everybody; a stride reads as walking far better than a stand does,
  // and at this distance nobody counts the frames.
  const legF = cap(0.031, 0.24).translate(-0.042, 0.152, 0.026);
  const legB = cap(0.031, 0.24).translate(0.042, 0.152, -0.026);

  // Arms hang from the shoulder with a slight outward set, so they clear the
  // torso instead of being buried in it.
  const armL = cap(0.023, 0.17).rotateZ(0.15).translate(-0.108, 0.415, 0.01);
  const armR = cap(0.023, 0.17).rotateZ(-0.15).translate(0.108, 0.415, -0.01);

  const head = new THREE.SphereGeometry(0.045, 7, 6).translate(0, 0.572, 0);

  /* Torso: a TAPERED cylinder squashed in plan, not a box. Wider at the
     shoulder than the waist and oval seen from above — which is the shape that
     stops a figure reading as a signpost when the camera comes round it. */
  const torso = new THREE.CylinderGeometry(0.088, 0.072, 0.235, 10, 1)
    .scale(1, 1, 0.66).translate(0, 0.4175, 0);

  // Hard hat: dome plus brim, and the brim is what makes it a hard hat rather
  // than a bald head at 30 m.
  const dome = new THREE.SphereGeometry(0.055, 8, 6).scale(1, 0.78, 1).translate(0, 0.583, 0);
  const brim = new THREE.CylinderGeometry(0.071, 0.071, 0.011, 10).translate(0, 0.567, 0.006);

  /* FOUR MATERIAL GROUPS, NOT THREE — and the split is the whole fix for
     "the people are black silhouettes". The head used to be merged in with the
     legs and arms onto one dark material, so a worker had a dark head, dark
     arms and dark trousers: three quarters of the figure was a single value
     and the only thing that read at all was the helmet. Skin has to be its own
     group or there is no face and no hands, and the shirt has to be its own
     group or there is no torso to see them against. */
  return {
    /** Trousers. */
    legs: mergeGeometries([legF, legB], false)!,
    /** Work shirt. */
    torso,
    /** Skin — forearms and head, the parts that are not clothed. */
    skin: mergeGeometries([armL, armR, head], false)!,
    /** Hard hat. */
    helmet: mergeGeometries([dome, brim], false)!,
  };
}

/**
 * TWO POSED WORKERS for the scaffold decks.
 *
 * The existing crew is one instanced figure repeated — which is right for a
 * dozen people at distance, and wrong for the two the eye actually lands on:
 * every instance shares one pose, so a crouching worker is impossible in that
 * pass. These two are ordinary Groups. Two extra draw calls buys two distinct
 * silhouettes doing two distinct jobs, which is the whole difference between a
 * site and a set of mannequins.
 *
 * Same skeleton and the same landmarks as `figureParts` — hip 0.30, shoulder
 * 0.52, crown 0.63 on a 1.75 m person — so they stand at exactly the scale the
 * crew, the storeys and the scaffold are already built to.
 */
function posedWorker(
  pose: 'plank' | 'crouch',
  limb: THREE.Material, vest: THREE.Material, hat: THREE.Material, plankMat: THREE.Material,
  shadow: boolean, skin: THREE.Material = limb,
) {
  const g = new THREE.Group();
  const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 3, 6);
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material,
               pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.castShadow = shadow;
    g.add(m);
  };
  const head = (y: number, z: number) => {
    put(new THREE.SphereGeometry(0.045, 7, 6), skin, [0, y, z]);
    put(new THREE.SphereGeometry(0.055, 8, 6).scale(1, 0.78, 1), hat, [0, y + 0.011, z]);
    put(new THREE.CylinderGeometry(0.071, 0.071, 0.011, 10), hat, [0, y - 0.005, z + 0.006]);
  };

  if (pose === 'crouch') {
    /* Squatting over the deck: shins vertical, thighs folded forward, torso
       pitched down and arms reaching to the boards. Crown lands at ~0.50
       against a standing 0.63, which is the proportion a real crouch loses. */
    ([-0.042, 0.042] as const).forEach((x) => {
      put(cap(0.031, 0.15), limb, [x, 0.10, -0.02]);                    // shin
      put(cap(0.033, 0.17), limb, [x + (x < 0 ? -0.004 : 0.004), 0.215, 0.085], [1.15, 0, 0]);  // thigh
      put(cap(0.023, 0.18), skin, [x * 2.4, 0.305, 0.185], [1.0, 0, 0]); // arm, reaching down
    });
    put(new THREE.CylinderGeometry(0.088, 0.072, 0.235, 10, 1).scale(1, 1, 0.66),
        vest, [0, 0.335, 0.115], [0.52, 0, 0]);
    head(0.455, 0.215);
  } else {
    /* Upright, carrying a board across the body: legs planted a little apart,
       forearms forward and level, plank in the hands. */
    put(cap(0.031, 0.24), limb, [-0.05, 0.152, 0.02]);
    put(cap(0.031, 0.24), limb, [0.05, 0.152, -0.02]);
    put(new THREE.CylinderGeometry(0.088, 0.072, 0.235, 10, 1).scale(1, 1, 0.66),
        vest, [0, 0.4175, 0]);
    ([-0.112, 0.112] as const).forEach((x) => {
      put(cap(0.023, 0.19), skin, [x, 0.435, 0.115], [1.32, 0, 0]);      // arm forward
    });
    // The board itself: a scaffold plank, in the decks' own galvanised steel
    // rather than timber — the same material it would have been lifted off.
    put(new THREE.BoxGeometry(0.66, 0.026, 0.11), plankMat, [0, 0.452, 0.205]);
    head(0.572, 0);
  }
  return g;
}

/* ---- construction plant ----------------------------------------------------
   Built the same way as the cars: real side profiles, extruded and bevelled,
   with proper tracked undercarriages, glazed cabs, tapered boom sections and
   wheels that are tyres on rims. A 20-tonne excavator is ~3.4 units long over
   the tracks here and stands 1.6 up to the cab roof, which is the right size
   against a 22 m frontage — the previous versions were stacks of boxes and read
   as toys next to the building they were supposedly putting up.               */

/** Tracked undercarriage: a flat-bottomed frame with an idler at each end. */
function trackProfile(len: number, r: number): THREE.Shape {
  const sh = new THREE.Shape();
  const h = len / 2 - r;
  sh.absarc(-h, r, r, Math.PI / 2, Math.PI * 1.5, false);
  sh.lineTo(h, 0);
  sh.absarc(h, r, r, Math.PI * 1.5, Math.PI / 2, false);
  sh.closePath();
  return sh;
}

/** Excavator house: sloped bonnet at the back, tall glazed cab at the front. */
function excavatorHouse(): { body: THREE.Shape; glass: THREE.Shape } {
  const body = new THREE.Shape();
  body.moveTo(-0.86, 0.0);
  body.lineTo(-0.86, 0.40);
  body.quadraticCurveTo(-0.84, 0.50, -0.70, 0.52);   // counterweight crown
  body.lineTo(-0.10, 0.55);
  body.lineTo(-0.10, 0.94);                           // cab back
  body.quadraticCurveTo(-0.09, 1.02, 0.00, 1.02);
  body.lineTo(0.50, 1.02);                            // cab roof
  body.quadraticCurveTo(0.60, 1.02, 0.60, 0.94);
  body.lineTo(0.62, 0.30);                            // raked screen
  body.lineTo(0.86, 0.24);
  body.lineTo(0.86, 0.0);
  body.closePath();
  const glass = new THREE.Shape();
  glass.moveTo(0.02, 0.62);
  glass.lineTo(0.02, 0.94);
  glass.lineTo(0.50, 0.94);
  glass.lineTo(0.52, 0.40);
  glass.lineTo(0.20, 0.46);
  glass.closePath();
  body.holes.push(new THREE.Path(glass.getPoints(4)));
  return { body, glass };
}

/** A tapering arm section — boom, dipper, and the lorry's tipper ram. */
function armProfile(len: number, a: number, b: number): THREE.Shape {
  const sh = new THREE.Shape();
  sh.moveTo(0, -a / 2);
  sh.lineTo(len, -b / 2);
  sh.lineTo(len, b / 2);
  sh.lineTo(0, a / 2);
  sh.closePath();
  return sh;
}

/** Forward-control lorry cab — the flat-fronted type a mixer or tipper uses. */
function lorryCab(): { body: THREE.Shape; glass: THREE.Shape } {
  const body = new THREE.Shape();
  body.moveTo(-0.46, 0.0);
  body.lineTo(-0.48, 0.86);
  body.quadraticCurveTo(-0.47, 0.98, -0.36, 0.99);
  body.lineTo(0.34, 0.99);
  body.lineTo(0.34, 0.0);
  body.closePath();
  const glass = new THREE.Shape();
  glass.moveTo(-0.40, 0.52);
  glass.lineTo(-0.41, 0.88);
  glass.lineTo(0.22, 0.89);
  glass.lineTo(0.22, 0.52);
  glass.closePath();
  body.holes.push(new THREE.Path(glass.getPoints(4)));
  return { body, glass };
}

/** Growth axis helpers — geometry pushed off its origin so a scale of 0..1
 *  reads as "rising out of the ground" / "spanning across", not "inflating". */
const fromBase = <T extends THREE.BufferGeometry>(g: T, h: number): T => { g.translate(0, h / 2, 0); return g; };
const fromEnd = <T extends THREE.BufferGeometry>(g: T, l: number): T => { g.translate(l / 2, 0, 0); return g; };

const HeroSite = forwardRef<ThreeHandle, { className?: string }>(function HeroSite({ className }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<ThreeHandle | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    /* TWO DIFFERENT QUESTIONS, and this file used to answer both with one
       locally-redefined `innerWidth < 768`:

         isPhone()  LAYOUT — portrait or landscape composition. Picks the camera
                    key set, which is a different SHOT, not a cheaper one.
         isLowPower() BUDGET — what this device can afford. Phone-sized, OR the
                    boot probe flagged it low-end, OR Save-Data, OR a 2G
                    connection. NOT reduced-motion: that decides whether things
                    MOVE, and a fast desktop that asked for stillness should
                    still get its shadows on the frame it holds.

       The local copy meant the other three budget signals never reached the
       renderer: a machine index.html had already measured and marked
       `data-perf="low"` still got shadow maps, the AO pass and full instance
       counts. It had also silently drifted from the shared probe, which uses
       `matchMedia('(max-width: 767px)')` — the two disagree on a fractional
       viewport width. Deleted; both now come from lib/device.

       `lite` sets the STARTING budget only. The controller in the render loop
       measures what the device actually does with it and corrects from there. */
    const lite = isLowPower();

    const renderer = new THREE.WebGLRenderer({
      // On desktop everything goes through the composer's own MSAA target, so
      // the context flag would apply to a framebuffer nothing renders to.
      antialias: lite, alpha: false, powerPreference: 'high-performance',
    });
    /* three calls getShaderInfoLog after every program link, and those are
       SYNCHRONOUS GPU round-trips that stall the main thread. Off in prod,
       kept in dev where a silently-black shader would cost more than it saves. */
    if (!import.meta.env.DEV) renderer.debug.checkShaderErrors = false;
    /* 1.75, not 2. Measured from outside the app, this scene draws ~66 GL calls
       and ~12k triangles a frame — geometry is free. EVERY frame of cost is
       fragment work, and dpr 2 with 4x MSAA on a 1440x860 stage is ~20 M shaded
       samples for the beauty pass alone. 1.75 with 2x MSAA is ~38% of that and
       still resolves a mullion cleanly, because the AO denoise smooths what is
       left. */
    /* FIXED, and it stays fixed. An adaptive controller used to scale this at
       runtime and it had to go: it changed `n8ao.enabled` as it stepped, and
       the AO pass is tinted navy (see n8ao.configuration.color below), so every
       step snapped a blue cast across every occluded surface in the scene. It
       stepped when frames got slow, which is precisely during a hard scrub and
       at the section hand-off — so the artefact read as a blue flash tied to
       scrolling. Re-applied on resize too, because devicePixelRatio changes
       when a window moves between monitors; the value is constant, so that is
       a no-op rather than a visible re-scale. */
    /* Re-read on every resize, so a rotation crossing the breakpoint updates
       it. Used ONLY for the phone exposure lift below — desktop and tablet
       must be untouched, which a `lite` gate would not have guaranteed
       (Save-Data and low-end desktops are lite too). */
    let phoneView = isPhone();
    const DPR_CAP = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 1.75);
    renderer.setPixelRatio(DPR_CAP);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = !lite;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    /* Atmospheric perspective — the three city layers, the hoarding and the
       plant all sit in it, and it is most of what sells the depth of the site.
       Colour and density are animated with the sky, so the haze belongs to the
       hour rather than being a fixed grey wash. */
    const fog = new THREE.FogExp2(0x8e9aa4, 0.0092);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 600);
    camera.position.set(7, 23, 25);

    const world = new THREE.Group();
    scene.add(world);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(duskEnvironment(), 0.035);
    scene.environment = envRT.texture;

    /* ---- SKY DOME + THE LIGHTING STORY ---------------------------------------
       late afternoon → golden hour → blue hour → night, driven by one 0..2
       blend. Done as three GRADED SKIES mixed in the shader rather than as a
       colour filter over one sky: the horizon, the cloud lighting and the sun's
       place in the gradient all have to move together, or it reads as a
       Photoshop layer — which is exactly what the brief rules out. */
    const SKY_RES = lite ? 512 : 1024;
    const skies = ([0, 1, 2] as SkyKind[]).map((k) => skyTexture(k, SKY_RES, SKY_RES / 2));
    const skyBlend = { value: 0 };
    const skyMat = new THREE.MeshBasicMaterial({
      map: skies[0], side: THREE.BackSide, fog: false, depthWrite: false,
    });
    skyMat.onBeforeCompile = (sh) => {
      sh.uniforms.sky1 = { value: skies[1] };
      sh.uniforms.sky2 = { value: skies[2] };
      sh.uniforms.skyBlend = skyBlend;
      /* REPLACES the whole <map_fragment> include. onBeforeCompile runs BEFORE
         three resolves its chunks, so the shader string here still holds the
         `#include` directive, not the expanded body — matching against the
         body's source text finds nothing. Everything else about the material is
         left alone, so it keeps three's colour-space and tone-mapping chunks.
         If the include is ever renamed the replace silently no-ops and the sky
         freezes on state 0, so say so in dev rather than shipping a sky that
         never changes. */
      const NEEDLE = '#include <map_fragment>';
      if (import.meta.env.DEV && !sh.fragmentShader.includes(NEEDLE)) {
        console.error('[HeroSite] map_fragment include is gone — the sky will not blend');
      }
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D sky1;\nuniform sampler2D sky2;\nuniform float skyBlend;')
        .replace(NEEDLE, [
          'vec4 s0 = texture2D( map, vMapUv );',
          'vec4 s1 = texture2D( sky1, vMapUv );',
          'vec4 s2 = texture2D( sky2, vMapUv );',
          'vec4 skyCol = mix( s0, s1, clamp( skyBlend, 0.0, 1.0 ) );',
          'skyCol = mix( skyCol, s2, clamp( skyBlend - 1.0, 0.0, 1.0 ) );',
          'diffuseColor *= skyCol;',
        ].join('\n'));
    };
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), skyMat);
    skyDome.renderOrder = -1;
    scene.add(skyDome);

    /* Key light — the sun. Colour, elevation and strength all move with the sky,
       so shadows lengthen and warm as the afternoon runs out. */
    const key = new THREE.DirectionalLight(0xfff3e2, 2.6);
    if (!lite) {
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.near = 6;
      key.shadow.camera.far = 90;
      const S = 18;
      key.shadow.camera.left = -S; key.shadow.camera.right = S;
      key.shadow.camera.top = S; key.shadow.camera.bottom = -S;
      key.shadow.bias = -0.0009;
      key.shadow.normalBias = 0.035;
      key.shadow.radius = 2.4;
    }
    scene.add(key, key.target);

    /** Sky-dome fill. Hue follows the hour, so shaded elevations sit in the
     *  right colour instead of going grey. */
    const hemi = new THREE.HemisphereLight(0xa9c0dc, 0x4a4034, 1.15);
    scene.add(hemi);
    /** A weak bounce off the ground, from the camera side — this is what keeps
     *  the near elevations from crushing to black once the sun is gone. */
    const bounce = new THREE.DirectionalLight(0xc7b39a, 0.4);
    bounce.position.set(6, 3, 16);
    scene.add(bounce);

    /* Site floods. The photographs are lit almost entirely by these once the
       sun goes, so they carry the construction half of the timeline. Three on
       desktop, two on a phone; one sits low over the excavation, which is the
       only thing that makes the foundation beat legible. */
    const flood = [
      new THREE.PointLight(WARM, 0, 34, 2),
      new THREE.PointLight(WARM, 0, 34, 2),
      new THREE.PointLight(0xffc98a, 0, 22, 2),
    ].slice(0, lite ? 2 : 3);
    flood[0].position.set(-8.0, 4.4, 6.6);
    flood[1].position.set(8.2, 4.4, -5.4);
    if (flood[2]) flood[2].position.set(0.6, 0.4, 1.2);
    flood.forEach((l) => world.add(l));

    /* Interior spill — the light the finished building throws on its forecourt.
       Plus two ground-mounted facade uplights on the entrance elevation, which
       is what actually puts light back INTO the limestone once the sun is gone;
       without them the stone reads as grey concrete in the hero shot. */
    /* Decay 1.55, not the physical 2. A real wall-washer is a wide diffuse
       fitting, not the point source the maths assumes, so inverse-square puts
       an unrealistically hot core right at the wall. Softening the exponent
       spreads the same light up the elevation instead of dumping it in the
       first metre — which is what keeps the stone reading as stone. */
    const inner = new THREE.PointLight(0xffcf9a, 0, 26, 1.55);
    inner.position.set(0, TOP * 0.42, 0);
    world.add(inner);
    const uplight = [new THREE.PointLight(0xffc98e, 0, 16, 1.5), new THREE.PointLight(0xffc98e, 0, 16, 1.5)];
    uplight[0].position.set(-3.4, 0.3, BD / 2 + 0.9);
    uplight[1].position.set(3.4, 0.3, BD / 2 + 0.9);
    uplight.forEach((l) => world.add(l));

    /* ---- materials ---------------------------------------------------------
       NO ALBEDO MAP on the structural concrete. Box UVs run 0..1 per face
       whatever the face measures, so one shared albedo tiles at a different
       scale on a 22 m slab and a 1 m column — and at slab scale the fbm grain
       reads as WOOD GRAIN under warm light. Flat colour plus normal and
       roughness gives clean arch-viz concrete at every size; the tonal
       variation that stops it looking like plastic comes from AO and from the
       lighting, which is where it comes from in a real render. */
    const conc = concreteMaps(lite ? 128 : 256, [186, 188, 190]);
    Object.values(conc).forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); });
    const rough = metalRoughness(64);
    const stoneTex = stoneTexture(lite ? 128 : 256);
    stoneTex.map.repeat.set(1, 6);
    stoneTex.rough.repeat.set(1, 6);

    const concMat = new THREE.MeshStandardMaterial({
      color: 0x9aa0a6, normalMap: conc.normalMap, roughnessMap: conc.roughnessMap,
      normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.93, metalness: 0.02, envMapIntensity: 0.5,
    });
    // Formwork-fresh concrete for the slabs — a touch cooler and smoother.
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0xa4a9ae, normalMap: conc.normalMap, roughnessMap: conc.roughnessMap,
      normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.88, metalness: 0.02, envMapIntensity: 0.5,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneTex.map, roughnessMap: stoneTex.rough,
      roughness: 1, metalness: 0.02, envMapIntensity: 0.55,
    });

    const dirt = dirtMaps(lite ? 128 : 256);
    Object.values(dirt).forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.22, 0.22); });

    const rebarMat = new THREE.MeshStandardMaterial({ color: 0x7d5a40, roughness: 0.66, metalness: 0.75, roughnessMap: rough });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x99a1ab, roughness: 0.55, metalness: 0.42, roughnessMap: rough });
    /* Architectural dark metal — mullions, spandrels, railings, canopy soffits.
       Low metalness on purpose: anodised aluminium at this scale reads as a dark
       matte surface with a soft sheen, not as chrome. */
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.44, metalness: 0.3, envMapIntensity: 0.9 });
    const accentMat = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.45, metalness: 0.15 });
    /* Precast spandrel / slab-edge band and balcony soffits. Warm pale grey,
       matt, so it separates the storeys by value against the dark glass
       instead of adding another black line to a facade that had six. */
    const spandrelMat = new THREE.MeshStandardMaterial({
      color: 0xa8a49c, normalMap: conc.normalMap, roughnessMap: conc.roughnessMap,
      normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.86, metalness: 0.03, envMapIntensity: 0.6,
    });

    /* CURTAIN WALL. Opaque, deliberately: all 84 panes are one InstancedMesh and
       therefore ONE draw call, and instances inside a draw call are not
       depth-sorted — as a transparent material the far elevation composites over
       the near one and the building renders as a ghost of itself. What sells it
       as glass instead is a clearcoat mirror over a near-black tint, a strong
       environment reflection, and an emissive map that IS the fitted-out floor
       behind it, so there is real depth to read. */
    const interiorTex = interiorTexture(lite ? 128 : 256);
    const glassMat = new THREE.MeshPhysicalMaterial({
      /* 0x121b28, not the near-black 0x0b111b this was. A tinted pane still
         reads as glass; a pane that dark reads as a hole, and it was taking
         the interior with it — everything behind the reflection crushed to
         black, which is most of "the windows are flat rectangles". */
      color: 0x121b28, roughness: 0.06, metalness: 0.2,
      clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 2.4, reflectivity: 1,
      emissive: 0xffffff, emissiveMap: interiorTex, emissiveIntensity: 0,
      side: THREE.DoubleSide,
    });
    /* WHY EVERY WINDOW USED TO LOOK IDENTICAL, and the one-line fix.
       The per-pane colours set on the InstancedMesh below reach the shader as
       `vColor`, and three multiplies exactly one thing by it: `diffuseColor`.
       On a pane this dark that is a variation of almost nothing — while the
       EMISSIVE, which is the fitted-out floor behind the glass and therefore
       the only part of a window anyone actually reads at dusk, was identical
       on all 84 panes. Six floors of the same lit room, stamped out.
       So the instance colour is applied to the emissive term too: one pane is
       a bright open-plan floor, its neighbour is a dim room with the blinds
       half down, another is empty and dark. The guard is the same one three
       uses to declare `vColor`, so the non-instanced meshes that share this
       material still compile. */
    glassMat.onBeforeCompile = (sh) => {
      const NEEDLE = '#include <emissivemap_fragment>';
      if (import.meta.env.DEV && !sh.fragmentShader.includes(NEEDLE)) {
        console.error('[HeroSite] emissivemap_fragment is gone — windows will all light the same');
      }
      sh.fragmentShader = sh.fragmentShader.replace(NEEDLE, [
        NEEDLE,
        '#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )',
        '  totalEmissiveRadiance *= vColor;',
        '#endif',
      ].join('\n'));
    };
    /* Additive strips: cove lighting, pier washes, signage glow, uplights.
       Unlit and depth-write-off so they read as light rather than as objects. */
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd2a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

    const dispose: THREE.Material[] = [glassMat, glowMat, concMat, slabMat, stoneMat, rebarMat, steelMat, darkMat, accentMat, spandrelMat, skyMat];
    const texs: THREE.Texture[] = [interiorTex, rough, stoneTex.map, stoneTex.rough, ...skies,
      ...Object.values(conc), ...Object.values(dirt)];

    /* Every subsystem below registers ONE updater. `update` runs them in order —
       no subsystem reads another's state, so a change to one can never desync
       the rest. `o` is act two's progress (see StoryScroll): 0 for the whole
       build, then 0..1 across the gate/car/road shot. */
    const tick: ((t: number, dt: number, o: number) => void)[] = [];

    /* Act two drives a handful of objects that belong to the completed-property
       block. Rather than hoist that whole block above the build, it publishes
       just those into this rig and the outro ticker reads them — one small,
       explicit seam instead of a reordering that would put the finished
       landscape's construction ahead of the building's. */
    const rig: {
      hinge1?: THREE.Group; hinge2?: THREE.Group;
      lampMat?: THREE.MeshBasicMaterial; light?: THREE.PointLight;
      place?: (i: number, x: number, z: number, rot: number, on: number, spin: number, head: number) => void;
      heroIdx: number; heroKind: { axle: number; wheelR: number; lampX: number; lampY: number };
    } = { heroIdx: 0, heroKind: { axle: 0.52, wheelR: 0.135, lampX: 0.79, lampY: 0.315 } };
    /** Where the hero car is this frame — written by the outro ticker, read by
     *  the camera, which follows it. */
    const heroPos = new THREE.Vector3();
    const heroDir = new THREE.Vector3(1, 0, 0);

    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const mkIM = (geo: THREE.BufferGeometry, mat: THREE.Material, count: number, shadow = true, parent: THREE.Object3D = world) => {
      const m = new THREE.InstancedMesh(geo, mat, count);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = shadow && !lite;
      m.receiveShadow = shadow && !lite;
      m.frustumCulled = false;
      parent.add(m);
      return m;
    };
    const put = (m: THREE.InstancedMesh, i: number) => { dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); };
    /** Hand an instanced mesh the material (or materials) a loaded model came
     *  with. `InstancedMesh['material']` is typed as ONE material, but three
     *  renders an array against the geometry's groups perfectly well — which is
     *  exactly how a model keeps its separate paint, chrome, glass and rubber.
     *  The cast is the type saying one thing and the renderer doing another. */
    const setMats = (m: THREE.InstancedMesh, mats: THREE.Material[]) => {
      if (mats.length) m.material = (mats.length === 1 ? mats[0] : mats) as THREE.Material;
    };
    /**
     * Instance scale for something that GROWS along one axis.
     *
     * A box scaled to ~0 on a SINGLE axis is not hidden — it is a fully visible
     * QUAD, lit and shadowed like every other face. Every unbuilt column, beam
     * and slab in this scene was drawing exactly that, which is why the plot
     * came with a lattice of white plates hanging over it before anything had
     * been built. `k` is the driving progress: below the threshold the instance
     * collapses on ALL THREE axes, which is the only scale that disappears.
     */
    const grow = (k: number, x: number, y: number, z: number) => {
      if (k < 0.002) dummy.scale.setScalar(0.0001);
      else dummy.scale.set(s0(x), s0(y), s0(z));
    };

    /* ======================================================================
       GROUND + EXCAVATION  (foundation-1)
       The plot is one plane with a rectangular hole in it. The pit hangs in a
       group whose Y scale IS the excavation: at 0 the batter slopes collapse
       flat and fill the hole, so the plot reads as untouched ground, and the dig
       genuinely opens downward rather than fading in.
       ====================================================================== */
    const PW = BW + 3.4, PD = BD + 3.4;          // pit rim at grade
    const FW = BW + 2.4, FD = BD + 2.4;          // pit floor (steep batter)
    {
      const outer = new THREE.Shape();
      outer.moveTo(-150, -150); outer.lineTo(150, -150); outer.lineTo(150, 150); outer.lineTo(-150, 150); outer.closePath();
      const hole = new THREE.Path();
      hole.moveTo(-PW / 2, -PD / 2); hole.lineTo(-PW / 2, PD / 2); hole.lineTo(PW / 2, PD / 2); hole.lineTo(PW / 2, -PD / 2); hole.closePath();
      outer.holes.push(hole);
      const groundGeo = new THREE.ShapeGeometry(outer).rotateX(-Math.PI / 2);
      /* ShapeGeometry UVs are the shape's own XY, so `repeat` is literally
         "tiles per world unit" here — 0.22 gives a ~4.5 m tile. */
      const gm = new THREE.MeshStandardMaterial({ ...dirt, color: 0xb8a087, roughness: 1, metalness: 0 });
      dispose.push(gm);
      const ground = new THREE.Mesh(groundGeo, gm);
      ground.receiveShadow = !lite;
      world.add(ground);
    }

    const pit = new THREE.Group();
    world.add(pit);
    {
      const rim = [[-PW / 2, -PD / 2], [PW / 2, -PD / 2], [PW / 2, PD / 2], [-PW / 2, PD / 2]];
      const flr = [[-FW / 2, -FD / 2], [FW / 2, -FD / 2], [FW / 2, FD / 2], [-FW / 2, FD / 2]];
      const pos: number[] = [], uv: number[] = [];
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const a = [rim[i][0], 0, rim[i][1]], b = [rim[j][0], 0, rim[j][1]];
        const c = [flr[j][0], -1, flr[j][1]], d = [flr[i][0], -1, flr[i][1]];
        pos.push(...a, ...b, ...c, ...a, ...c, ...d);
        // UVs in WORLD units — the dirt maps tile at 0.22/unit (see above).
        uv.push(0, PIT, 14, PIT, 14, 0, 0, PIT, 14, 0, 0, 0);
      }
      const wallGeo = new THREE.BufferGeometry();
      wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      wallGeo.computeVertexNormals();
      const wm = new THREE.MeshStandardMaterial({ ...dirt, color: 0xa08a70, roughness: 1, metalness: 0, side: THREE.DoubleSide });
      dispose.push(wm);
      const walls = new THREE.Mesh(wallGeo, wm);
      walls.receiveShadow = !lite;
      pit.add(walls);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(FW, FD).rotateX(-Math.PI / 2), wm);
      floor.position.y = -1;
      floor.receiveShadow = !lite;
      pit.add(floor);
    }
    tick.push((t) => { pit.scale.y = s0(ease(span(P.dig[0], P.dig[1], t)) * PIT); });

    /* ======================================================================
       THE DRAWING  (0 → 0.07)
       Setting-out lines that DRAW themselves along the column grid — thin
       emissive bars scaled from one end, not a fading image. They are the same
       axes the grade beams pour on, so the drawing becomes the building rather
       than being replaced by it.
       ====================================================================== */
    {
      const planTex = blueprintTexture(512);
      texs.push(planTex);
      const pm = new THREE.MeshBasicMaterial({ map: planTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      dispose.push(pm);
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(PW * 1.05, PD * 1.05).rotateX(-Math.PI / 2), pm);
      sheet.position.y = 0.01;
      world.add(sheet);

      type Ln = { x: number; z: number; len: number; rot: number };
      const lines: Ln[] = [];
      for (let j = 0; j <= NZ; j++) lines.push({ x: -BW / 2, z: nodeZ(j), len: BW, rot: 0 });
      for (let i = 0; i <= NX; i++) lines.push({ x: nodeX(i), z: -BD / 2, len: BD, rot: Math.PI / 2 });
      const OX = BW / 2 + 1.0, OZ = BD / 2 + 1.0;
      lines.push({ x: -OX, z: -OZ, len: OX * 2, rot: 0 }, { x: -OX, z: OZ, len: OX * 2, rot: 0 });
      lines.push({ x: -OX, z: -OZ, len: OZ * 2, rot: Math.PI / 2 }, { x: OX, z: -OZ, len: OZ * 2, rot: Math.PI / 2 });

      const lm = new THREE.MeshBasicMaterial({ color: 0xff3b42, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
      dispose.push(lm);
      const lineIM = mkIM(fromEnd(new THREE.BoxGeometry(1, 0.004, 0.035), 1), lm, lines.length, false);
      lineIM.renderOrder = 2;

      tick.push((t) => {
        const outp = span(0.07, 0.12, t);
        lm.opacity = 0.9 * (1 - outp);
        lineIM.visible = lm.opacity > 0.02;
        pm.opacity = 0.5 * ease(span(0.004, 0.03, t)) * (1 - ease(span(0.045, 0.08, t)));
        sheet.visible = pm.opacity > 0.01;
        if (!lineIM.visible) return;
        lines.forEach((L, i) => {
          const k = outCubic(stagger(t, P.plan[0], P.plan[1], i, lines.length, 0.9));
          dummy.position.set(L.x, 0.014, L.z);
          dummy.rotation.set(0, L.rot, 0);
          grow(k, L.len * k, 1, 1);
          put(lineIM, i);
        });
        lineIM.instanceMatrix.needsUpdate = true;
      });
    }

    /* ======================================================================
       FOUNDATION  (foundation-1)
       Pad footings, then the grade-beam grid on top of them, then the rebar mat
       in the bays. Poured in that order, which is the order the photograph
       shows it.
       ====================================================================== */
    const NODES: [number, number][] = [];
    for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) NODES.push([nodeX(i), nodeZ(j)]);

    {
      const padIM = mkIM(fromBase(new THREE.BoxGeometry(1.15, 0.34, 1.15), 0.34), concMat, NODES.length);
      tick.push((t) => {
        padIM.visible = t > P.pads[0] - 0.005;
        if (!padIM.visible) return;
        NODES.forEach((n, i) => {
          const k = ease(stagger(t, P.pads[0], P.pads[1], i, NODES.length, 1.4));
          dummy.position.set(n[0], -PIT, n[1]);
          dummy.rotation.set(0, 0, 0);
          grow(k, 1, k, 1);
          put(padIM, i);
        });
        padIM.instanceMatrix.needsUpdate = true;
      });

      type Seg = { x: number; z: number; len: number; rot: number };
      const segs: Seg[] = [];
      for (let j = 0; j <= NZ; j++) for (let i = 0; i < NX; i++) segs.push({ x: nodeX(i), z: nodeZ(j), len: GX, rot: 0 });
      for (let i = 0; i <= NX; i++) for (let j = 0; j < NZ; j++) segs.push({ x: nodeX(i), z: nodeZ(j), len: GZ, rot: Math.PI / 2 });
      const gbIM = mkIM(fromEnd(fromBase(new THREE.BoxGeometry(1, 0.46, 0.4), 0.46), 1), concMat, segs.length);
      tick.push((t) => {
        gbIM.visible = t > P.gbeam[0] - 0.005;
        if (!gbIM.visible) return;
        segs.forEach((s, i) => {
          const k = ease(stagger(t, P.gbeam[0], P.gbeam[1], i, segs.length, 2.2));
          dummy.position.set(s.x, -PIT + 0.3, s.z);
          dummy.rotation.set(0, s.rot, 0);
          grow(k, s.len * k, 1, 1);
          put(gbIM, i);
        });
        gbIM.instanceMatrix.needsUpdate = true;
      });

      const PITCHM = lite ? 0.62 : 0.34;
      const mats: Seg[] = [];
      for (let z = -BD / 2 + PITCHM; z < BD / 2; z += PITCHM) mats.push({ x: -BW / 2, z, len: BW, rot: 0 });
      for (let x = -BW / 2 + PITCHM; x < BW / 2; x += PITCHM) mats.push({ x, z: -BD / 2, len: BD, rot: Math.PI / 2 });
      const matIM = mkIM(fromEnd(new THREE.BoxGeometry(1, 0.028, 0.028), 1), rebarMat, mats.length, false);
      tick.push((t) => {
        const gone = span(0.17, 0.24, t);          // buried under the basement slab
        matIM.visible = t > P.mat[0] - 0.005 && gone < 0.99;
        if (!matIM.visible) return;
        mats.forEach((s, i) => {
          const k = outCubic(stagger(t, P.mat[0], P.mat[1], i, mats.length, 3)) * (1 - gone);
          dummy.position.set(s.x, -PIT + 0.5, s.z);
          dummy.rotation.set(0, s.rot, 0);
          grow(k, s.len * k, 1, 1);
          put(matIM, i);
        });
        matIM.instanceMatrix.needsUpdate = true;
      });
    }

    /* ======================================================================
       FRAME  (foundation-2 → foundation-3)
       Seven lifts, each one the SAME three-beat cycle the site runs:
         cage grows out of the lift below  →  concrete pours up around it
         →  beams span between the heads   →  the slab is cast across them.
       Lift k+1 starts before lift k has finished, which is what makes the
       structure read as continuously growing rather than as seven steps.
       ====================================================================== */
    const BARS = lite ? 2 : 4;
    {
      const cageIM = mkIM(fromBase(new THREE.BoxGeometry(0.032, 1, 0.032), 1), rebarMat, NODES.length * SEGS * BARS, false);
      const colIM = mkIM(fromBase(new THREE.BoxGeometry(COL, 1, COL), 1), concMat, NODES.length * SEGS);

      type Seg = { x: number; z: number; len: number; rot: number };
      const bays: Seg[] = [];
      for (let j = 0; j <= NZ; j++) for (let i = 0; i < NX; i++) bays.push({ x: nodeX(i), z: nodeZ(j), len: GX, rot: 0 });
      for (let i = 0; i <= NX; i++) for (let j = 0; j < NZ; j++) bays.push({ x: nodeX(i), z: nodeZ(j), len: GZ, rot: Math.PI / 2 });
      const beamIM = mkIM(fromEnd(new THREE.BoxGeometry(1, BEAM, 0.32), 1), concMat, bays.length * SEGS);
      const slabIM = mkIM(fromEnd(new THREE.BoxGeometry(1, SLABT, BD + 0.12), 1), slabMat, SEGS);

      tick.push((t) => {
        // Every visibility this ticker owns, BEFORE any early return.
        const on = t > P.frame[0] - 0.01;
        cageIM.visible = colIM.visible = beamIM.visible = slabIM.visible = on;
        if (!on) return;
        let ci = 0, bi = 0;
        for (let k = 0; k < SEGS; k++) {
          const f = liftAt(t, k);
          const base = segBase(k), h = segTop(k) - base;
          const cageK = ease(span(0.0, 0.34, f));      // steel first…
          const colK = ease(span(0.12, 0.66, f));      // …then the pour climbs it
          const beamK = outCubic(span(0.52, 0.84, f));
          const slabK = outCubic(span(0.7, 1.0, f));

          NODES.forEach((n) => {
            /* The cage overshoots its lift by a coupler length and is swallowed
               as the NEXT lift pours — exactly what foundation-2 and -3 show.
               The TOP lift has none above it, so it is stripped when the
               cladding starts; without that, the finished landmark hands over
               with rebar sticking out of its roof. */
            const swallow = k + 1 < SEGS
              ? ease(span(0.15, 0.7, liftAt(t, k + 1)))
              : ease(span(P.pier[0] - 0.06, P.pier[0] + 0.03, t));
            const ch = (h + 0.72) * cageK * Math.max(0, 1 - swallow * 1.1);
            for (let b = 0; b < BARS; b++) {
              const a = (b / BARS) * Math.PI * 2 + 0.4;
              dummy.position.set(n[0] + Math.cos(a) * COL * 0.32, base, n[1] + Math.sin(a) * COL * 0.32);
              dummy.rotation.set(0, 0, 0);
              grow(ch, 1, ch, 1);
              put(cageIM, ci * BARS + b);
            }
            dummy.position.set(n[0], base, n[1]);
            dummy.rotation.set(0, 0, 0);
            grow(colK, 1, h * colK, 1);
            put(colIM, ci);
            ci++;
          });

          bays.forEach((s) => {
            dummy.position.set(s.x, segTop(k) - SLABT - BEAM / 2, s.z);
            dummy.rotation.set(0, s.rot, 0);
            grow(beamK, s.len * beamK, 1, 1);
            put(beamIM, bi++);
          });

          // The slab is CAST ACROSS, not faded in — it sweeps from one edge.
          dummy.position.set(-BW / 2 - 0.06, segTop(k) - SLABT / 2, 0);
          dummy.rotation.set(0, 0, 0);
          grow(slabK, (BW + 0.12) * slabK, 1, 1);
          put(slabIM, k);
        }
        cageIM.instanceMatrix.needsUpdate = true;
        colIM.instanceMatrix.needsUpdate = true;
        beamIM.instanceMatrix.needsUpdate = true;
        slabIM.instanceMatrix.needsUpdate = true;
      });
    }

    /* ======================================================================
       CREWS  (foundation-2 → -3)
       ENTOURAGE IS SCALE. A 1.75 m figure standing on a slab is the cheapest
       thing in this file and it does more to make the frame read as a BUILDING
       than any material does — without it there is nothing in shot whose size
       the eye already knows.
       ====================================================================== */
    {
      const CN = lite ? 6 : 12;
      /* SITE UNIFORM: light shirt, dark trousers, white hat, and skin that is
         actually skin. The previous set had ONE dark value doing head, arms and
         legs, which is why the crew read as cut-outs.
         The shirt and the hat carry a small EMISSIVE of their own colour. That
         is not a glow — it is a floor. At blue hour the key light is almost
         gone and a 0.86-rough white surface has nothing left to return, so
         white clothing crushes to the same near-black as everything else;
         0.16 of its own hue keeps it reading as white without it ever becoming
         a light source. The brief asks for exactly that: visibly white in an
         evening scene, not glowing. */
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x232a3a, roughness: 0.88, envMapIntensity: 1.2,          // trousers
      });
      const vestMat = new THREE.MeshStandardMaterial({
        color: 0xe6e4dd, roughness: 0.78, envMapIntensity: 1.5,          // work shirt
        emissive: 0xe6e4dd, emissiveIntensity: 0.16,
      });
      const skinMat = new THREE.MeshStandardMaterial({
        color: 0xb98a68, roughness: 0.72, envMapIntensity: 1.35,         // hands, arms, face
        emissive: 0xb98a68, emissiveIntensity: 0.1,
      });
      const hatMat = new THREE.MeshStandardMaterial({
        color: 0xf0f2f4, roughness: 0.5, envMapIntensity: 1.6,           // hard hat
        emissive: 0xf0f2f4, emissiveIntensity: 0.16,
      });
      dispose.push(bodyMat, vestMat, skinMat, hatMat);
      // 1.75 m ≈ 0.63 units: hip 0.30, shoulder 0.52, crown 0.63. Limbs, vest
      // and hard hat come from the shared figure so the crew and the people on
      // the footway are the same human in different clothes.
      const CREW_FIG = figureParts();
      const bodyIM = mkIM(CREW_FIG.legs, bodyMat, CN, false);
      const vestIM = mkIM(CREW_FIG.torso, vestMat, CN, false);
      const skinIM = mkIM(CREW_FIG.skin, skinMat, CN, false);
      const hatIM = mkIM(CREW_FIG.helmet, hatMat, CN, false);
      /* A real worker model already wears its own vest and hard hat, so the two
         instanced meshes that painted those onto the procedural figure collapse
         rather than being drawn inside it. Same trick as the vehicle wheels:
         swap the geometry, leave every placement loop untouched. */
      void loadModel('worker').then((w) => {
        if (!w) return;
        bodyIM.geometry.dispose();
        bodyIM.geometry = w.body;
        setMats(bodyIM, w.materials);
        [vestIM, skinIM, hatIM].forEach((im) => { im.geometry.dispose(); im.geometry = EMPTY_GEO(); });
      });

      /* Placed on the deck of whichever lift is being poured, plus two at ground
         level, so the crew climbs with the building. */
      const crew = Array.from({ length: CN }, (_, i) => ({
        lift: i < 2 ? 0 : 1 + Math.floor(rnd(i, 61) * (SEGS - 1)),
        x: (rnd(i, 63) - 0.5) * (BW - 1.2),
        z: (rnd(i, 67) - 0.5) * (BD - 1.2),
        face: rnd(i, 71) * Math.PI * 2,
        phase: rnd(i, 73) * 9,
      }));
      /* ---- TWO WORKERS ON THE SCAFFOLD DECKS ------------------------------
         Added to the crew, not instead of it — the existing twelve are
         untouched. These two stand on the perimeter decks at the 4th and 5th
         lift, which is the "upper/middle floors" band, on the deck runs that
         already exist at x/z = +/-(half-span + R).
         Deck arithmetic, so their feet cannot float: a ledger sits at
         LEV(k) - 0.3, its board 0.05 above that, and the board is 0.04 thick —
         so the walking surface is LEV(k) - 0.21.
         Their VISIBILITY is derived from the scaffold's own height rule rather
         than from a phase of their own, which is what keeps a worker from ever
         standing on a deck that has not been erected yet or has already been
         struck. */
      const DECK_R = 0.6;
      const deckY = (k: number) => LEV(k) - 0.21;
      const plankMat = new THREE.MeshStandardMaterial({ color: 0x8d939a, roughness: 0.62, metalness: 0.55 });
      dispose.push(plankMat);
      const deckCrew = [
        // Carrying a board along the south run, facing back into the frame.
        { g: posedWorker('plank', bodyMat, vestMat, hatMat, plankMat, !lite, skinMat),
          x: 1.7, z: BD / 2 + DECK_R, y: deckY(5), ry: Math.PI },
        // Crouched over the boards on the west run, working on the deck.
        { g: posedWorker('crouch', bodyMat, vestMat, hatMat, plankMat, !lite, skinMat),
          x: -(BW / 2 + DECK_R), z: -0.9, y: deckY(4), ry: Math.PI / 2 },
      ];
      deckCrew.forEach((w) => {
        w.g.position.set(w.x, w.y, w.z);
        w.g.rotation.y = w.ry;
        world.add(w.g);
      });

      tick.push((t) => {
        /* Mirrors the scaffolding block's own height rule exactly: the lesser
           of what the scaffold has erected and what the frame has poured, plus
           a lift. A deck exists at height Y only when that value clears Y. */
        const scaffUp = ease(span(P.scaff[0], P.scaff[1], t));
        const scaffOut = ease(span(P.clear[0] - 0.04, P.clear[1] - 0.04, t));
        let poured = 0;
        for (let k = 0; k < SEGS; k++) {
          const b = segBase(k), tp = segTop(k);
          poured = Math.max(poured, b + (tp - b) * clamp01(liftAt(t, k)));
        }
        const deckH = Math.min((TOP + 0.5) * scaffUp, poured + FH) * (1 - scaffOut);
        deckCrew.forEach((w) => { w.g.visible = deckH > w.y + 0.12 && scaffOut < 0.9; });

        const inK = span(P.crew[0], P.crew[1] - 0.02, t);
        const out = ease(span(P.clear[0] - 0.02, P.clear[1] - 0.04, t));
        const live = inK > 0.01 && out < 0.98;
        bodyIM.visible = vestIM.visible = skinIM.visible = hatIM.visible = live;
        if (!live) return;
        crew.forEach((c, i) => {
          const built = liftAt(t, c.lift);
          const k = (built > 0.72 ? 1 : 0) * (1 - out);
          // A slow shift of weight — enough to read as alive at this distance.
          const sway = Math.sin(t * 40 + c.phase) * 0.02;
          dummy.position.set(c.x + sway, segTop(c.lift), c.z);
          dummy.rotation.set(0, c.face + sway, 0);
          grow(k, k, k, k);
          put(bodyIM, i); put(vestIM, i); put(skinIM, i); put(hatIM, i);
        });
        bodyIM.instanceMatrix.needsUpdate = true;
        vestIM.instanceMatrix.needsUpdate = true;
        skinIM.instanceMatrix.needsUpdate = true;
        hatIM.instanceMatrix.needsUpdate = true;
      });
    }

    /* ======================================================================
       SCAFFOLDING  (foundation-3) — perimeter standards, ledgers and boards, up
       with the frame and struck before the cladding goes on.
       ====================================================================== */
    {
      const R = 0.6;
      const posts: [number, number][] = [];
      const stepN = lite ? 2.2 : 1.7;
      for (let x = -BW / 2 - R; x <= BW / 2 + R + 0.01; x += stepN) posts.push([x, -BD / 2 - R], [x, BD / 2 + R]);
      for (let z = -BD / 2 - R + stepN; z < BD / 2 + R - 0.01; z += stepN) posts.push([-BW / 2 - R, z], [BW / 2 + R, z]);
      const standIM = mkIM(fromBase(new THREE.CylinderGeometry(0.032, 0.032, 1, 5), 1), steelMat, posts.length, false);
      const ledgers: { x: number; z: number; len: number; rot: number; y: number }[] = [];
      for (let k = 1; k <= FLOORS; k++) {
        ledgers.push({ x: -BW / 2 - R, z: -BD / 2 - R, len: BW + R * 2, rot: 0, y: LEV(k) - 0.3 });
        ledgers.push({ x: -BW / 2 - R, z: BD / 2 + R, len: BW + R * 2, rot: 0, y: LEV(k) - 0.3 });
        ledgers.push({ x: -BW / 2 - R, z: -BD / 2 - R, len: BD + R * 2, rot: Math.PI / 2, y: LEV(k) - 0.3 });
        ledgers.push({ x: BW / 2 + R, z: -BD / 2 - R, len: BD + R * 2, rot: Math.PI / 2, y: LEV(k) - 0.3 });
      }
      const ledIM = mkIM(fromEnd(new THREE.BoxGeometry(1, 0.05, 0.05), 1), steelMat, ledgers.length, false);
      /* Decks on alternate lifts, so the scaffold has something to work off.
         GALVANISED STEEL DECKS, not timber boards. These were 0x9a7d55 — raw
         orange pine — on runs up to 25.8 m, sitting 1.7 m OUTSIDE the building
         on alternate lifts. That is a rectangle of long brown horizontal
         members hanging around a grey concrete frame, which is exactly the
         description of "stray wooden beams beside and outside the building",
         and no amount of repositioning fixes it because the position is
         correct — a scaffold deck belongs there.
         So the geometry stays and the MATERIAL changes. System scaffolding
         uses steel or aluminium planks, so this is the more accurate choice as
         well as the one that removes the last actual timber from the scene:
         the scaffolding is fully intact, and there is no longer any wood in
         it to mistake for a second structure. */
      const boardMat = new THREE.MeshStandardMaterial({ color: 0x8d939a, roughness: 0.62, metalness: 0.55, envMapIntensity: 0.9 });
      dispose.push(boardMat);
      const boardIM = mkIM(fromEnd(new THREE.BoxGeometry(1, 0.04, 0.5), 1), boardMat, ledgers.length, false);

      tick.push((t) => {
        const up = ease(span(P.scaff[0], P.scaff[1], t));
        const out = ease(span(P.clear[0] - 0.04, P.clear[1] - 0.04, t));
        const live = up > 0.02 && out < 0.98;
        standIM.visible = ledIM.visible = boardIM.visible = live;
        if (!live) return;
        /* THE SCAFFOLD MAY NOT OUTRUN THE BUILDING. This is the source of the
           "floating timber above and beside the structure".
           `up` completes at P.scaff[1] = 0.48, but the frame does not top out
           until P.frame[1] = 0.62 — so for a quarter of the build the scaffold
           stood at full roof height around a half-built structure, and its
           DECKS came with it: boards up to 26 m long, in timber brown, hanging
           at six storeys with no building next to them. Nothing was wrong with
           the boards; they were being placed against a height the frame had
           not reached.
           So the height is now the lesser of what the scaffold has erected and
           what the frame has actually poured, plus one lift — a real scaffold
           does run a lift above the pour, because that is what the crew stands
           on. Computed CONTINUOUSLY from each lift's own progress rather than
           by thresholding it, so the scaffold grows with the concrete instead
           of stepping up a storey at a time. */
        let built = 0;
        for (let k = 0; k < SEGS; k++) {
          const base = segBase(k), top = segTop(k);
          built = Math.max(built, base + (top - base) * clamp01(liftAt(t, k)));
        }
        const h = Math.min((TOP + 0.5) * up, built + FH) * (1 - out);
        posts.forEach((p, i) => {
          dummy.position.set(p[0], -0.1, p[1]);
          dummy.rotation.set(0, 0, 0);
          grow(h, 1, h, 1);
          put(standIM, i);
        });
        ledgers.forEach((L, i) => {
          const on = (L.y < h ? 1 : 0) * (1 - out);
          dummy.position.set(L.x, L.y, L.z);
          dummy.rotation.set(0, L.rot, 0);
          grow(on, L.len * on, 1, 1);
          put(ledIM, i);
          const bo = i % 2 === 0 ? on : 0;
          dummy.position.set(L.x, L.y + 0.05, L.z);
          dummy.rotation.set(0, L.rot, 0);
          grow(bo, L.len * bo, 1, 1);
          put(boardIM, i);
        });
        standIM.instanceMatrix.needsUpdate = true;
        ledIM.instanceMatrix.needsUpdate = true;
        boardIM.instanceMatrix.needsUpdate = true;
      });
    }

    /* ======================================================================
       TOWER CRANE  (foundation-2 → -4). Climbs with the frame, slews slowly,
       hoists a load, and is dismantled before the handover shot. Steel and
       crimson, not the yellow of the reference plant — yellow is not an Alipson
       colour.
       ====================================================================== */
    {
      const crane = new THREE.Group();
      crane.position.set(BW / 2 + 3.8, 0, -BD / 2 - 2.2);
      world.add(crane);

      const mast = new THREE.Group();
      crane.add(mast);
      const CH = 0.44;
      const legs = mkIM(fromBase(new THREE.BoxGeometry(0.085, 1, 0.085), 1), steelMat, 4, false, mast);
      const braceN = 20;
      const braces = mkIM(fromEnd(new THREE.BoxGeometry(1, 0.045, 0.045), 1), steelMat, braceN * 2, false, mast);

      const slew = new THREE.Group();
      crane.add(slew);
      const jib = new THREE.Mesh(fromEnd(new THREE.BoxGeometry(1, 0.2, 0.28), 1), steelMat);
      jib.scale.x = 10.5;
      const cjib = new THREE.Mesh(fromEnd(new THREE.BoxGeometry(1, 0.28, 0.34), 1), steelMat);
      cjib.rotation.y = Math.PI; cjib.scale.x = 3.6;
      const cw = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.72, 0.7), darkMat);
      cw.position.x = -3.2;
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.15, 0.74), accentMat);
      band.position.set(-3.2, 0.16, 0);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.42), darkMat);
      cab.position.set(0.6, -0.28, 0);
      const cable = new THREE.Mesh(new THREE.BoxGeometry(0.018, 1, 0.018), steelMat);
      cable.geometry.translate(0, -0.5, 0);
      const load = new THREE.Group();
      const hook = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.26), steelMat);
      const bundle = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.34), rebarMat);
      bundle.position.y = -0.24;
      load.add(hook, bundle);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), new THREE.MeshBasicMaterial({ color: ACCENT }));
      lamp.position.y = 0.5;
      slew.add(jib, cjib, cw, band, cab, cable, load, lamp);

      tick.push((t, dt) => {
        const inK = ease(span(P.crane[0], P.crane[1], t));
        const out = ease(span(P.clear[0], P.clear[1], t));
        crane.visible = inK > 0.02 && out < 0.98;
        if (!crane.visible) return;
        // The mast CLIMBS: always a little above whatever has been built.
        const built = TOP * clamp01((t - P.frame[0]) / (P.frame[1] - P.frame[0]));
        const h = (2.6 + built + 3.0) * inK * (1 - out * 0.9);
        for (let i = 0; i < 4; i++) {
          dummy.position.set(i < 2 ? -CH : CH, 0, i % 2 ? -CH : CH);
          dummy.rotation.set(0, 0, 0);
          grow(h, 1, h, 1);
          put(legs, i);
        }
        legs.instanceMatrix.needsUpdate = true;
        const stepB = h / braceN;
        for (let i = 0; i < braceN; i++) {
          const y = i * stepB;
          const flip = i % 2 ? 1 : -1;
          for (let s = 0; s < 2; s++) {
            dummy.position.set(-CH, flip < 0 ? y + stepB : y, s ? CH : -CH);
            dummy.rotation.set(0, 0, Math.atan2(stepB, CH * 2) * flip);
            dummy.scale.set(s0(Math.hypot(CH * 2, stepB)), 1, 1);
            put(braces, i * 2 + s);
          }
        }
        braces.instanceMatrix.needsUpdate = true;
        slew.position.y = h;
        /* Slew and hoist are driven by the PLAYHEAD, not by wall-clock time, so
           the crane is part of the scrub: drag back up and the load comes back
           down with everything else. `dt` only carries the idle drift. */
        slew.rotation.y = t * 5.2 + dt * 0.02;
        const reach = 5.6 + Math.sin(t * 11) * 2.4;
        cable.position.x = reach;
        const drop = Math.max(0.4, h - 1.4 - Math.abs(Math.sin(t * 7)) * (h - 2.6));
        cable.scale.y = s0(drop);
        load.position.set(reach, -drop, 0);
      });
    }

    /* ======================================================================
       FACADE  (foundation-4 → foundation-5)
       Stone piers, dark spandrels, then curtain wall bay by bay. Every pane
       flies in along its own outward normal and settles into a recessed reveal
       — the frame is never "revealed", it is assembled.
       ====================================================================== */
    type Bay = { x: number; z: number; w: number; rot: number; nx: number; nz: number };
    const BAYS: Bay[] = [];
    for (let i = 0; i < NX; i++) {
      BAYS.push({ x: nodeX(i) + GX / 2, z: BD / 2, w: GX, rot: 0, nx: 0, nz: 1 });
      BAYS.push({ x: nodeX(i) + GX / 2, z: -BD / 2, w: GX, rot: Math.PI, nx: 0, nz: -1 });
    }
    for (let j = 0; j < NZ; j++) {
      BAYS.push({ x: BW / 2, z: nodeZ(j) + GZ / 2, w: GZ, rot: Math.PI / 2, nx: 1, nz: 0 });
      BAYS.push({ x: -BW / 2, z: nodeZ(j) + GZ / 2, w: GZ, rot: -Math.PI / 2, nx: -1, nz: 0 });
    }
    const GH = FH - 0.13;                          // clear glass height per storey
    const paneCount = BAYS.length * FLOORS;

    {
      const glassIM = mkIM(new THREE.PlaneGeometry(1, 1), glassMat, paneCount, false);
      const MUL = lite ? 2 : 3;
      const mulIM = mkIM(new THREE.BoxGeometry(0.05, 1, 0.09), darkMat, paneCount * MUL, false);
      /* PRECAST, NOT ANODISED BLACK. This band is the slab edge — the one
         element that tells a viewer where one storey stops and the next
         starts — and it was in the same near-black metal as the mullions and
         the reveals, so six floor lines read as six black stripes and the
         elevation lost its storeys. In pale precast it separates the floors by
         VALUE rather than by another dark line, which is what the photographs
         of this building type actually show. Deeper too: 240 mm reads at hero
         distance where 170 did not. */
      const spanIM = mkIM(new THREE.BoxGeometry(1, 0.24, 0.17), spandrelMat, paneCount, false);
      /* A recessed dark reveal behind every pane. Glass set flush with its
         surround is what makes a facade look printed on; 90 mm of shadow gap is
         what makes it look built — and it is what the AO pass then picks up. */
      const revealIM = mkIM(new THREE.BoxGeometry(1, 1, 0.06), darkMat, paneCount, false);
      /* THE FRAME IS THE REVEAL, SEEN ROUND THE EDGE OF A SMALLER PANE. The
         glass used to fill 98% of its bay, so the dark box behind it showed as
         a 20 mm line — a shadow gap, not a frame, and at hero distance not
         even that. At 0.86 the surround reads as the 140 mm aluminium section
         it is meant to be, all four sides, and the AO pass has something to
         sit in. No extra geometry: the frame was always there, it was simply
         hidden behind the pane. */
      const PANE = 0.86;
      /* One horizontal transom per pane, at the head of the vision panel. It is
         what stops a storey-height sheet of glass reading as a slot. */
      const tranIM = mkIM(new THREE.BoxGeometry(1, 0.05, 0.1), darkMat, paneCount, false);

      /* BALCONIES, ON ALTERNATE BAYS OF THE MIDDLE FLOORS.
         Every bay would be a housing block and none is a curtain-walled slab;
         alternating gives the elevation a rhythm and, more usefully, gives it
         DEPTH — a projecting slab with a rail on it is the one element that
         casts a real shadow across the glass and proves the facade is built
         rather than printed.
         Floors 2 to FLOORS-2 only. Floor 1 is inside the double-height lobby
         volume and would hang over the entrance canopy; the top floor carries
         the Alipson sign on the front elevation, and a balcony there would
         stand in front of it. */
      const balcIdx = new Int16Array(FLOORS * BAYS.length).fill(-1);
      let balcN = 0;
      for (let s2 = 2; s2 <= FLOORS - 2; s2++) {
        for (let b = 0; b < BAYS.length; b++) {
          if (b % 2) continue;
          balcIdx[s2 * BAYS.length + b] = balcN++;
        }
      }
      const balcIM = mkIM(new THREE.BoxGeometry(1, 0.1, 0.7), spandrelMat, balcN, false);
      const railIM = mkIM(new THREE.BoxGeometry(1, 0.42, 0.04), darkMat, balcN, false);
      /* A shading fin on every floor line. 300 mm of projecting metal is a real
         detail on a curtain-walled office in this climate, and it is what breaks
         a flat glazed elevation into storeys from a distance — the elevation
         reads as banded rather than as one printed sheet, and the AO pass picks
         up a shadow under each one. */
      const finIM = mkIM(new THREE.BoxGeometry(1, 0.05, 0.3), darkMat, paneCount, false);

      /* OCCUPANCY, not jitter. The old spread was 0.72-1.05 on a term that
         only tinted the glass, so every window was the same window. Three
         tiers instead — one pane in six is an unlit or blinded room, half are
         a working office at normal level, the rest are a bright open floor —
         and because the shader patch above runs this into the emissive as
         well, that is now the interior light rather than the tint. Warm, and
         warmer in the reds, because it is tungsten behind the glass. */
      for (let i = 0; i < paneCount; i++) {
        const occ = rnd(i, 83);
        const b = occ < 0.17 ? mix(0.12, 0.26, rnd(i, 89))
          : occ < 0.62 ? mix(0.5, 0.82, rnd(i, 97))
            : mix(0.95, 1.35, rnd(i, 101));
        glassIM.setColorAt(i, col.setRGB(
          b * mix(1.0, 1.08, rnd(i, 103)),
          b * mix(0.88, 0.97, rnd(i, 107)),
          b * mix(0.74, 0.88, rnd(i, 109)),
        ));
      }
      if (glassIM.instanceColor) glassIM.instanceColor.needsUpdate = true;

      type Pier = { x: number; z: number; w: number; rot: number; nx: number; nz: number };
      const piers: Pier[] = [];
      const PWID = 0.8;
      ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).forEach(([sx, sz]) => {
        piers.push({ x: sx * (BW / 2 - PWID / 2), z: sz * BD / 2, w: PWID, rot: 0, nx: 0, nz: sz });
        piers.push({ x: sx * BW / 2, z: sz * (BD / 2 - PWID / 2), w: PWID, rot: Math.PI / 2, nx: sx, nz: 0 });
      });
      /* Mid-face piers on the LONG elevations only. The short returns have
         three bays whose centres are -2, 0 and +2, so a pier on the centre line
         lands on a bay centre and bricks up the middle window — which is what
         put a dark void down the flank of the finished building. The long
         elevations' bay centres straddle x = 0, so a pier there falls on a
         column line, which is where a pier belongs. */
      piers.push({ x: 0, z: BD / 2, w: PWID, rot: 0, nx: 0, nz: 1 });
      piers.push({ x: 0, z: -BD / 2, w: PWID, rot: 0, nx: 0, nz: -1 });
      const pierIM = mkIM(fromBase(new THREE.BoxGeometry(1, 1, 0.34), 1), stoneMat, piers.length);

      const washIM = mkIM(new THREE.PlaneGeometry(0.14, 1), glowMat, piers.length, false);
      washIM.renderOrder = 4;
      const coveIM = mkIM(new THREE.BoxGeometry(1, 0.06, 0.06), glowMat, 4, false);
      coveIM.renderOrder = 4;

      // Parapet, plus roof plant — a lift overrun and two AHU blocks, so the
      // roof is a roof and not a lid.
      const parapet = new THREE.Group();
      parapet.position.y = TOP;
      ([[0, BD / 2, BW + 0.66, 0], [0, -BD / 2, BW + 0.66, 0], [BW / 2, 0, BD + 0.66, Math.PI / 2], [-BW / 2, 0, BD + 0.66, Math.PI / 2]] as const)
        .forEach(([x, z, len, rot]) => {
          const m = new THREE.Mesh(fromBase(new THREE.BoxGeometry(len, 0.36, 0.38), 0.36), stoneMat);
          m.position.set(x, 0, z);
          m.rotation.y = rot;
          m.castShadow = !lite;
          parapet.add(m);
        });
      const overrun = new THREE.Mesh(fromBase(new THREE.BoxGeometry(1.9, 1.05, 1.7), 1.05), concMat);
      overrun.position.set(-1.4, 0, -0.6);
      overrun.castShadow = !lite;
      const ahu1 = new THREE.Mesh(fromBase(new THREE.BoxGeometry(1.3, 0.42, 0.8), 0.42), steelMat);
      ahu1.position.set(1.6, 0, 0.9);
      const ahu2 = new THREE.Mesh(fromBase(new THREE.BoxGeometry(0.9, 0.34, 0.7), 0.34), steelMat);
      ahu2.position.set(2.4, 0, -1.1);
      parapet.add(overrun, ahu1, ahu2);
      world.add(parapet);

      tick.push((t) => {
        const pk = span(P.pier[0], P.pier[1], t);
        const litK = ease(span(P.lit[0], P.lit[1], t));
        const cap = outCubic(span(P.pier[0] + 0.05, P.pier[1] + 0.02, t));
        // SET EVERY VISIBILITY THIS TICKER OWNS BEFORE THE EARLY RETURN.
        pierIM.visible = pk > 0.005;
        parapet.visible = cap > 0.02;
        parapet.scale.set(1, s0(cap), 1);
        glowMat.opacity = 0.55 * litK;
        washIM.visible = coveIM.visible = litK > 0.02;
        const anyGlass = t > P.glass[0] - 0.01;
        glassIM.visible = mulIM.visible = spanIM.visible = revealIM.visible = finIM.visible = anyGlass;
        tranIM.visible = balcIM.visible = railIM.visible = anyGlass;
        glassMat.emissiveIntensity = 2.4 * litK;

        piers.forEach((p, i) => {
          const k = outCubic(stagger(t, P.pier[0], P.pier[1], i, piers.length, 2.4));
          dummy.position.set(p.x + p.nx * 0.1, LEV(0), p.z + p.nz * 0.1);
          dummy.rotation.set(0, p.rot, 0);
          grow(k, p.w, (TOP + 0.1) * k, 1);
          put(pierIM, i);
          // Pier wash — a strip of light ON the stone, not a light source.
          dummy.position.set(p.x + p.nx * 0.28, LEV(0) + (TOP + 0.1) / 2, p.z + p.nz * 0.28);
          dummy.rotation.set(0, p.rot, 0);
          dummy.scale.set(1, s0(TOP - 0.5), 1);
          put(washIM, i);
        });
        pierIM.instanceMatrix.needsUpdate = true;
        washIM.instanceMatrix.needsUpdate = true;

        ([[0, BD / 2 + 0.22, BW + 0.55, 0], [0, -BD / 2 - 0.22, BW + 0.55, 0], [BW / 2 + 0.22, 0, BD + 0.55, Math.PI / 2], [-BW / 2 - 0.22, 0, BD + 0.55, Math.PI / 2]] as const)
          .forEach(([x, z, len, rot], i) => {
            dummy.position.set(x, TOP - 0.02, z);
            dummy.rotation.set(0, rot, 0);
            dummy.scale.set(s0(len), 1, 1);
            put(coveIM, i);
          });
        coveIM.instanceMatrix.needsUpdate = true;

        if (!anyGlass) return;
        for (let s = 0; s < FLOORS; s++) {
          const y0 = LEV(s) + 0.09;
          for (let b = 0; b < BAYS.length; b++) {
            const bay = BAYS[b];
            const idx = s * BAYS.length + b;
            const k = outBack(stagger(t, P.glass[0], P.glass[1], idx, paneCount, 5));
            const kk = clamp01(k);
            const off = (1 - k) * 0.55;      // flies in along the bay's normal
            const cx = bay.x + bay.nx * (0.02 + off), cz = bay.z + bay.nz * (0.02 + off);
            const cy = y0 + GH / 2;
            dummy.position.set(cx, cy, cz);
            dummy.rotation.set(0, bay.rot, 0);
            grow(kk, bay.w * PANE * kk, GH * PANE * kk, 1);
            put(glassIM, idx);
            // Transom, a third down from the head of the pane.
            dummy.position.set(cx + bay.nx * 0.015, cy + GH * PANE * 0.17, cz + bay.nz * 0.015);
            dummy.rotation.set(0, bay.rot, 0);
            grow(kk, bay.w * PANE * kk, 1, 1);
            put(tranIM, idx);
            // Shadow gap behind the pane.
            dummy.position.set(bay.x - bay.nx * 0.06, cy, bay.z - bay.nz * 0.06);
            dummy.rotation.set(0, bay.rot, 0);
            grow(kk, bay.w * kk, GH * kk, 1);
            put(revealIM, idx);
            const bi = balcIdx[idx];
            if (bi >= 0) {
              // Slab: projects 350 mm past the glass line, on the bay's normal.
              dummy.position.set(bay.x + bay.nx * 0.36, LEV(s) + 0.06, bay.z + bay.nz * 0.36);
              dummy.rotation.set(0, bay.rot, 0);
              grow(kk, bay.w * 0.94 * kk, 1, 1);
              put(balcIM, bi);
              // Rail, at the outer edge of the slab.
              dummy.position.set(bay.x + bay.nx * 0.68, LEV(s) + 0.32, bay.z + bay.nz * 0.68);
              dummy.rotation.set(0, bay.rot, 0);
              grow(kk, bay.w * 0.94 * kk, kk, 1);
              put(railIM, bi);
            }
            // Spandrel band under the head of every bay, with its shade fin.
            dummy.position.set(bay.x + bay.nx * 0.06, LEV(s + 1) - 0.05, bay.z + bay.nz * 0.06);
            dummy.rotation.set(0, bay.rot, 0);
            grow(kk, bay.w * kk, 1, 1);
            put(spanIM, idx);
            dummy.position.set(bay.x + bay.nx * 0.19, LEV(s + 1) - 0.14, bay.z + bay.nz * 0.19);
            dummy.rotation.set(0, bay.rot, 0);
            grow(kk, bay.w * 1.02 * kk, 1, 1);
            put(finIM, idx);
            for (let m = 0; m < MUL; m++) {
              const u = (m + 1) / (MUL + 1) - 0.5;
              dummy.position.set(cx + Math.cos(bay.rot) * u * bay.w * PANE, cy, cz - Math.sin(bay.rot) * u * bay.w * PANE);
              dummy.rotation.set(0, bay.rot, 0);
              grow(kk, 1, GH * PANE * kk, 1);
              put(mulIM, idx * MUL + m);
            }
          }
        }
        glassIM.instanceMatrix.needsUpdate = true;
        tranIM.instanceMatrix.needsUpdate = true;
        balcIM.instanceMatrix.needsUpdate = true;
        railIM.instanceMatrix.needsUpdate = true;
        revealIM.instanceMatrix.needsUpdate = true;
        spanIM.instanceMatrix.needsUpdate = true;
        finIM.instanceMatrix.needsUpdate = true;
        mulIM.instanceMatrix.needsUpdate = true;
      });
    }

    /* ======================================================================
       ENTRANCE + SIGNAGE  (foundation-5)
       Canopy, steps, entrance screen, and the two lit Alipson signs the
       finished building carries — one on the canopy fascia at eye level, one on
       the upper elevation. Both are PHYSICALLY MOUNTED: a lit box with a face,
       not a decal floating on the render. There are exactly three marks on the
       whole property — these two and the gate pier.
       ====================================================================== */
    const brand = brandTexture(1024, 256);
    /* WHITE BRANDING ON A RED BOARD.
       The artwork is NOT redrawn. `brandTexture` returns a greyscale mask
       built from the supplied PNG's own alpha channel, so filling that mask
       with a flat colour reproduces the lockup's exact silhouette — every
       curve of the mark, every letter of "BUILDERS PVT LTD" — in whatever ink
       the signage calls for. Shape from the file, colour from the brief.
       #f7f8f9 rather than pure #ffffff: on an unlit material a full-white fill
       clips against the red and starts to read as an illuminated sign, which
       is the neon look the brief rules out. A shade under white stays crisp
       and stays paint. */
    const signMat = new THREE.MeshBasicMaterial({ color: 0xf7f8f9, alphaMap: brand.alpha, transparent: true, opacity: 0, depthWrite: false });
    /* The panel. Its own material, NOT the shared `darkMat` — that one also
       carries the door frames, railings and curtain-wall mullions, and this is
       a signage finish rather than a structural one.
       #d31018 is the project's own brand red, the same value the navbar
       wordmark, the footer glow and the section accents already use, so the
       boards in the 3D world and the UI around it are one colour rather than
       two that nearly match. Satin, not gloss: roughness 0.38 is a
       powder-coated panel that returns a soft highlight from the entrance
       uplights without becoming a mirror or a light source. */
    const signBoardMat = new THREE.MeshStandardMaterial({
      color: 0xd31018, roughness: 0.38, metalness: 0.08, envMapIntensity: 0.85,
    });
    {
      const entry = new THREE.Group();
      entry.position.z = BD / 2;
      world.add(entry);
      texs.push(brand.map, brand.alpha);
      dispose.push(signMat, signBoardMat);

      /* DOUBLE-HEIGHT ENTRANCE. The entry volume now reads to LEV(2) instead
         of LEV(1) — one storey taller, which is how a premium lobby is
         actually built.
         NOTHING STRUCTURAL MOVES. The columns, beams and slabs are untouched
         and every floor above sits exactly where it did; what changes is the
         height of the entrance OPENING and the canopy over it, so the ground
         floor reads as a two-storey lobby behind a taller glazed screen. That
         is a real detail, and it is also the only version of "raise the
         entrance" that does not shift the whole building and the camera keys
         framing it. */
      const ENTRY_H = LEV(2);
      /* ---- CANOPY ---------------------------------------------------------
         A cast slab on the facade, not a floating lid: 730 mm of structural
         depth read as a stone edge over a flush dark soffit, running from the
         building line out 2.5 units (~7 m) — deep enough to cover the doors
         and the top of the steps and no deeper. */
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.26, 2.5), stoneMat);
      canopy.position.set(0, ENTRY_H - 0.2, 1.25);
      canopy.castShadow = !lite;
      const soffit = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.05, 2.2), darkMat);
      soffit.position.set(0, ENTRY_H - 0.34, 1.25);
      const fascia = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.58, 0.16), signBoardMat);
      fascia.position.set(0, ENTRY_H + 0.06, 2.46);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), signMat);
      sign.position.set(0, ENTRY_H + 0.06, 2.55);
      const topBoard = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.98, 0.14), signBoardMat);
      topBoard.position.set(-BW / 2 + 1.9, TOP - 0.72, 0.18);
      const topSign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), signMat);
      topSign.position.set(-BW / 2 + 1.9, TOP - 0.72, 0.26);

      /* ======================================================================
         THE MAIN ENTRANCE — A DOORSET, NOT A GLAZED PANEL
         ----------------------------------------------------------------------
         An automatic sliding entrance the way one is actually built: two fixed
         sidelights, two sliding leaves between them, an operator header over
         the opening carrying the sensor, a floor track under it, and a lit
         lobby behind that you can see into.

         EVERY PANE IS ITS OWN MESH. One big sheet of glass with bars drawn on
         it is what made this read as a facade panel rather than as doors —
         from the hero camera the divisions have to be REAL geometry with real
         edges catching the canopy light, or the eye reads one surface.

         The screen has its own transparent material because the curtain wall's
         cannot be transparent (84 panes in one instanced draw call cannot be
         depth-sorted). These are a handful of one-off meshes, so they sort
         correctly and cost nothing.
         ====================================================================== */
      const SCR_W = 4.0, SCR_H = ENTRY_H - 0.42;   // screen 11 m x 5.8 m
      const DH = 0.80;                              // door head — 2.24 m
      const LEAF = 0.98;                            // one leaf / one sidelight
      const entryGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0x9fbccf, roughness: 0.05, metalness: 0,
        clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.8,
        transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
      });
      /* The lobby's back wall takes the same fitted-out-floor texture the
         curtain wall uses for its interiors, so what you see through the doors
         belongs to the same building as what you see through the windows. */
      const lobbyMat = new THREE.MeshBasicMaterial({ map: interiorTex, color: 0xffcb92 });
      dispose.push(entryGlassMat, lobbyMat);

      const screen = new THREE.Group();
      screen.position.z = 0.04;
      const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z = 0) => {
        const o = new THREE.Mesh(g, m);
        o.position.set(x, y, z);
        screen.add(o);
        return o;
      };
      /* ---- lobby, seen through the doors ---------------------------------
         Back wall, reception desk with the brand panel behind it, two lobby
         columns for depth, and three ceiling coves. The coves use the scene's
         shared additive strip material, so they light with the rest of the
         building's interiors and need no ticker of their own. */
      mesh(new THREE.PlaneGeometry(SCR_W + 1.2, SCR_H), lobbyMat, 0, SCR_H / 2, -1.6);
      mesh(fromBase(new THREE.BoxGeometry(1.7, 0.34, 0.46), 0.34), darkMat, -0.4, 0, -1.1);
      mesh(new THREE.PlaneGeometry(1.4, 0.46), signBoardMat, -0.4, 0.62, -1.54);
      ([-1.45, 1.45] as const).forEach((x) => {
        mesh(fromBase(new THREE.BoxGeometry(0.22, SCR_H, 0.22), SCR_H), stoneMat, x, 0, -1.05);
      });
      ([-0.45, -0.95, -1.45] as const).forEach((z) => {
        const cove = mesh(new THREE.BoxGeometry(2.9, 0.05, 0.07), glowMat, 0, SCR_H - 0.16, z);
        cove.renderOrder = 4;
      });

      /* ---- the glazed screen ---------------------------------------------
         Four panes below the transom — sidelight, leaf, leaf, sidelight — and
         one over it. The two centre panes are the sliding leaves. */
      ([-1.5, -0.5, 0.5, 1.5] as const).forEach((x) => {
        const pane = mesh(new THREE.PlaneGeometry(LEAF - 0.08, DH - 0.16), entryGlassMat, x, (DH - 0.16) / 2 + 0.08);
        pane.renderOrder = 3;
      });
      const fanlight = mesh(new THREE.PlaneGeometry(SCR_W - 0.16, SCR_H - DH - 0.22), entryGlassMat, 0, (DH + 0.16 + SCR_H) / 2 - 0.03);
      fanlight.renderOrder = 3;

      /* ---- the frame ------------------------------------------------------ */
      mesh(new THREE.BoxGeometry(SCR_W + 0.16, 0.12, 0.17), darkMat, 0, SCR_H, 0.01);          // head
      mesh(new THREE.BoxGeometry(SCR_W, 0.07, 0.15), darkMat, 0, DH + 0.16, 0.01);             // transom
      mesh(new THREE.BoxGeometry(SCR_W, 0.09, 0.16), darkMat, 0, 0.045, 0.01);                 // threshold
      /* Operator header — the box that actually carries a sliding doorset's
         motor and belt. It spans only the opening, which is what tells the eye
         which two of the four panels move. */
      mesh(new THREE.BoxGeometry(2.06, 0.16, 0.22), steelMat, 0, DH + 0.05, 0.05);
      mesh(new THREE.BoxGeometry(1.9, 0.035, 0.06), darkMat, 0, DH - 0.05, 0.13);              // sensor strip
      mesh(new THREE.BoxGeometry(2.02, 0.035, 0.14), steelMat, 0, 0.02, 0.06);                 // floor track
      ([-1, 1] as const).forEach((sx) => {
        mesh(fromBase(new THREE.BoxGeometry(0.13, SCR_H, 0.18), SCR_H), darkMat, sx * SCR_W / 2, 0, 0.01);   // jamb
        mesh(fromBase(new THREE.BoxGeometry(0.09, SCR_H, 0.15), SCR_H), darkMat, sx * LEAF, 0, 0.01);        // mullion
        // Leaf stiles and rails — each moving panel framed on all four sides.
        mesh(fromBase(new THREE.BoxGeometry(0.07, DH - 0.1, 0.13), DH - 0.1), darkMat, sx * 0.06, 0.08, 0.05);
        mesh(fromBase(new THREE.BoxGeometry(LEAF, 0.11, 0.12), 0.11), darkMat, sx * 0.5, 0.05, 0.05);
        // A vertical pull near the leading edge of each leaf.
        mesh(fromBase(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 8), 0.34), steelMat, sx * 0.19, 0.3, 0.1);
        // Sensor eye — a warm point on the header, the one lit detail up there.
        const eye = mesh(new THREE.PlaneGeometry(0.05, 0.05), glowMat, sx * 0.5, DH + 0.05, 0.17);
        eye.renderOrder = 5;
      });
      entry.add(screen);

      /* Entrance mat, on the landing outside the doors — dark, matt, and the
         one thing that says "people walk in here". */
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.85).rotateX(-Math.PI / 2), darkMat);
      mat.position.set(0, 0.03, 0.78);
      /* THE APPROACH. Road -> footway -> this run of paving -> steps -> doors.
         A pale band across the darker drop-off asphalt, on the entrance axis:
         it is what joins the pavement to the building instead of leaving the
         steps landing in a car park. */
      const approach = new THREE.Mesh(fromBase(new THREE.BoxGeometry(2.6, 0.03, 2.4), 0.03), stoneMat);
      approach.position.set(0, 0.025, 4.5);
      approach.receiveShadow = !lite;
      entry.add(mat, approach);

      /* Canopy downlights. Recessed warm discs in the soffit — the light that
         actually falls on the doors and the top of the steps at dusk, and the
         reason the glass reads as glass rather than as a dark panel. One point
         light does the work; the discs are what you SEE doing it. */
      const downs = ([-1.7, -0.85, 0, 0.85, 1.7] as const).map((x) => {
        const d = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12).rotateX(Math.PI / 2), glowMat);
        d.position.set(x, ENTRY_H - 0.375, 1.1);
        d.renderOrder = 4;
        return d;
      });
      entry.add(...downs);
      const canopyLight = new THREE.PointLight(0xffd6a8, 0, 8, 1.7);
      canopyLight.position.set(0, ENTRY_H - 0.6, BD / 2 + 1.1);
      world.add(canopyLight);
      /* The lobby's own light, thrown back OUT through the doors onto the steps
         — which is what makes an entrance read at dusk. Small radius: this lights
         the threshold, not the forecourt (the uplights already do that). */
      const lobbyLight = new THREE.PointLight(0xffd0a0, 0, 9, 1.6);
      lobbyLight.position.set(0, 1.1, BD / 2 - 0.9);
      world.add(lobbyLight);
      /* NO SIGN PYLON. Two full-height fins on a stone plinth used to carry the
         fascia board down to the ground here — a defensible way to mount a sign
         and, standing at z 2.46, exactly the wrong place for one: the posts
         framed the doorway from the hero camera and the plinth crossed the top
         of the steps. The board is mounted where a canopy sign belongs, on the
         canopy's own fascia, and the approach is clear. */
      entry.add(canopy, soffit, fascia, sign, topBoard, topSign);

      const STEPN = 5;
      const steps = mkIM(new THREE.BoxGeometry(6.0, 0.15, 0.44), stoneMat, STEPN, true, entry);
      /* Ground lights, moved off the old single row onto the EDGES of the
         approach, which is where a real forecourt puts them — they now mark the
         walk rather than washing the middle of the paving. */
      const uplights = mkIM(new THREE.PlaneGeometry(0.4, 0.4).rotateX(-Math.PI / 2), glowMat, 8, false, entry);

      tick.push((t) => {
        const k = outCubic(span(P.site[0] - 0.04, P.site[1] - 0.02, t));
        entry.visible = k > 0.02;
        if (!entry.visible) return;
        canopy.scale.set(s0(k), 1, s0(k));
        soffit.scale.set(s0(k), 1, s0(k));
        fascia.scale.set(s0(k), s0(k), 1);
        topBoard.scale.set(s0(k), s0(k), 1);
        signMat.opacity = ease(span(P.site[0] - 0.02, P.site[1] - 0.04, t));
        screen.scale.set(s0(k), s0(k), 1);
        mat.scale.set(s0(k), 1, s0(k));
        approach.scale.set(s0(k), 1, s0(k));
        /* The glass, the coves and both entrance lights come up with the
           building's own interiors, not with the structure — an unlit lobby
           behind clear glass at dusk is a black hole in the elevation. */
        const litE = ease(span(P.lit[0], P.lit[1], t));
        entryGlassMat.opacity = 0.32 * k;
        lobbyMat.color.setRGB(mix(0.34, 1.0, litE), mix(0.3, 0.8, litE), mix(0.26, 0.57, litE));
        lobbyLight.intensity = 7 * litE;
        canopyLight.intensity = 9 * litE;
        downs.forEach((d) => d.scale.setScalar(s0(litE)));
        for (let i = 0; i < STEPN; i++) {
          const kk = outCubic(stagger(t, P.site[0] - 0.02, P.site[1] - 0.02, i, STEPN, 1.6));
          dummy.position.set(0, -0.03 - i * 0.15, 1.3 + i * 0.44);
          dummy.rotation.set(0, 0, 0);
          grow(kk, kk, 1, 1);
          put(steps, i);
        }
        steps.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < 8; i++) {
          dummy.position.set((i % 2 ? 1 : -1) * 1.45, 0.045, 3.4 + Math.floor(i / 2) * 0.75);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(s0(k * 1.5));
          put(uplights, i);
        }
        uplights.instanceMatrix.needsUpdate = true;
      });
    }

    /* ======================================================================
       LIVE SITE  (foundation-1 → -3): hoarding, floods, plant, materials.
       The hoarding is deliberately LOW (4 m) and runs on THREE sides only — the
       fourth, between the camera and the building for most of the flight, is
       left open. A tall foreground fence is the fastest way to make a render
       look like a game level, and the brief is explicit that the building must
       stay visible.
       ====================================================================== */
    {
      const site = new THREE.Group();
      world.add(site);

      const HX = BX + 0.4, HZ = BZ + 0.4;
      const hoardMat = new THREE.MeshStandardMaterial({ color: 0x8a9199, roughness: 0.7, metalness: 0.3, roughnessMap: rough, normalMap: conc.normalMap });
      dispose.push(hoardMat);
      ([[0, -HZ, HX * 2, 0], [-HX, 0, HZ * 2, Math.PI / 2], [HX, 0, HZ * 2, Math.PI / 2]] as const)
        .forEach(([x, z, len, rot]) => {
          const m = new THREE.Mesh(fromBase(new THREE.BoxGeometry(len, 1.4, 0.08), 1.4), hoardMat);
          m.position.set(x, 0, z);
          m.rotation.y = rot;
          m.receiveShadow = !lite;
          site.add(m);
        });
      // Site branding on the hoarding — the one place a banner belongs.
      const bannerBack = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.0, 0.05), signBoardMat);
      bannerBack.position.set(-3.0, 0.78, -HZ + 0.07);
      // Same white-on-red as the other three boards — the site hoarding is the
      // contractor's own sign, so it carries the same identity, not a variant.
      const bannerMat = new THREE.MeshBasicMaterial({ color: 0xf7f8f9, alphaMap: brand.alpha, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
      dispose.push(bannerMat);
      const bannerFace = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 0.9), bannerMat);
      // NO rotation: a plane already faces +z, which is the side of the far
      // hoarding the camera is on. Turning it round mirrored the wordmark.
      bannerFace.position.set(-3.0, 0.78, -HZ + 0.11);
      site.add(bannerBack, bannerFace);

      const dot = softDot(64);
      texs.push(dot);
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff0d2 });
      const spriteMat = new THREE.SpriteMaterial({ map: dot, color: WARM, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
      dispose.push(lampMat, spriteMat);
      /* Masts on the BACK corners and the mid-flanks only. The camera arc runs
         from +x round through +z to -x — anything on the +z boundary stands in
         the foreground of half the film, which is where the front masts were
         planting a pole across the building. */
      /* ALL FOUR ON THE FLANKS, none on the back boundary. The two rear masts
         used to stand at z = -9.0 — squarely behind the building — and an
         11.8 m steel pole back there is a vertical line rising past the
         parapet against open sky, which is exactly what reads as "another
         structure going up". Moved onto the east and west flanks, where they
         light the elevations they are actually for and are seen against the
         hoarding rather than against the sky. The original note still holds:
         nothing goes on the +z boundary, which is the foreground of half the
         camera arc. */
      const MAST = [[-HX + 0.8, -2.0], [HX - 0.8, -2.0], [-HX + 0.8, 3.2], [HX - 0.8, 3.2]];
      MAST.forEach(([x, z]) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 4.2, 6), steelMat);
        pole.position.set(x, 2.1, z);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.18), lampMat);
        head.position.set(x, 4.12, z);
        const sp = new THREE.Sprite(spriteMat);
        sp.position.set(x, 4.12, z);
        sp.scale.setScalar(1.4);
        site.add(pole, head, sp);
      });

      /* ---- PLANT ------------------------------------------------------------
         Real machines, built from extruded side profiles like the cars: a
         tracked excavator with a glazed cab and a three-piece boom, and a
         forward-control mixer on six wheels. Both in the site contractor's
         charcoal-and-crimson rather than the reference photographs' yellow,
         which is not an Alipson colour. */
      /* CONTRACTOR LIVERY — Alipson red over white, not plant-hire grey.
         `plantMat` is the painted bodywork: a deep red with a CLEARCOAT rather
         than raw metalness. Machinery paint is a pigment layer under lacquer,
         which is a dielectric; pushing metalness up to fake gloss is what makes
         a red machine look like red foil. Metalness stays low, the coat does
         the shine, and the roughness map underneath keeps it from being a
         mirror — these are working machines, not showroom pieces. */
      const plantMat = new THREE.MeshPhysicalMaterial({
        color: 0x9c1118, roughness: 0.42, metalness: 0.08, roughnessMap: rough,
        clearcoat: 0.85, clearcoatRoughness: 0.22, envMapIntensity: 1.5,
      });
      /* Cabin and upper panels. Off-white, not pure white: #ffffff on a lit
         machine at dusk clips to a flat silhouette with no form in it. */
      const bodyMat = new THREE.MeshPhysicalMaterial({
        color: 0xe8e9ea, roughness: 0.34, metalness: 0.06,
        clearcoat: 0.9, clearcoatRoughness: 0.16, envMapIntensity: 1.35,
      });
      const plantGlassMat = new THREE.MeshPhysicalMaterial({ color: 0x0e131b, roughness: 0.09, metalness: 0.25, clearcoat: 1, envMapIntensity: 1.2 });
      const trackMat = new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.92, metalness: 0.2 });
      const tyrePMat = new THREE.MeshStandardMaterial({ color: 0x141619, roughness: 0.94 });
      /* CHROME. Rims, hydraulic rams and the grab rails read as polished steel
         only if metalness is near 1 AND roughness is low enough to return a
         sharp environment — 0.36 was a satin finish that went grey at dusk. */
      const rimPMat = new THREE.MeshStandardMaterial({ color: 0xc6cbd2, roughness: 0.14, metalness: 0.98, envMapIntensity: 2.4 });
      const lampPMat = new THREE.MeshBasicMaterial({ color: 0xfff2d6 });
      dispose.push(plantMat, plantGlassMat, trackMat, bodyMat, tyrePMat, rimPMat, lampPMat);

      /** Tyre + rim on one hub, so wheels are wheels rather than discs. */
      const wheelAt = (parent: THREE.Object3D, x: number, y: number, z: number, r: number, w: number) => {
        const t = new THREE.Mesh(new THREE.TorusGeometry(r * 0.78, r * 0.24, 6, 14), tyrePMat);
        const rm = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.56, r * 0.56, w, 12).rotateX(Math.PI / 2), rimPMat);
        t.position.set(x, y, z); rm.position.set(x, y, z);
        t.castShadow = rm.castShadow = !lite;
        parent.add(t, rm);
      };

      /* EXCAVATOR — 9.5 m over the tracks, 3 m to the cab roof. */
      const dig = new THREE.Group();
      dig.position.set(HX - 2.6, 0, PD / 2 + 1.0);
      dig.rotation.y = -2.35;
      const trackGeo = extrudeProfile(trackProfile(1.72, 0.19), 0.3, 0.03, 8);
      ([-0.38, 0.38] as const).forEach((z) => {
        const tr = new THREE.Mesh(trackGeo, trackMat);
        tr.position.set(0, 0, z);
        tr.castShadow = !lite;
        dig.add(tr);
        // Rollers along the bottom run, the detail that says "tracked".
        for (let i = 0; i < 5; i++) {
          const rl = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 10).rotateX(Math.PI / 2), trackMat);
          rl.position.set(-0.6 + i * 0.3, 0.11, z);
          dig.add(rl);
        }
      });
      const slew = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.14, 14), plantMat);
      slew.position.y = 0.42;
      dig.add(slew);
      const upper = new THREE.Group();
      upper.position.y = 0.49;
      upper.rotation.y = 0.5;
      const hs = excavatorHouse();
      const house = new THREE.Mesh(extrudeProfile(hs.body, 0.86, 0.045), plantMat);
      house.castShadow = !lite;
      const houseGl = new THREE.Mesh(extrudeProfile(hs.glass, 0.8, 0.01), plantGlassMat);
      const cwStripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.9), accentMat);
      cwStripe.position.set(-0.76, 0.30, 0);
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 8), trackMat);
      stack.position.set(-0.2, 0.68, -0.3);
      upper.add(house, houseGl, cwStripe, stack);
      // Boom, dipper and bucket — a three-piece arm that folds like the real thing.
      const boom = new THREE.Mesh(extrudeProfile(armProfile(1.55, 0.26, 0.17), 0.22, 0.02), plantMat);
      boom.position.set(0.62, 0.34, 0);
      boom.rotation.z = 0.62;
      boom.castShadow = !lite;
      const dipper = new THREE.Group();
      dipper.position.set(0.62 + Math.cos(0.62) * 1.55, 0.34 + Math.sin(0.62) * 1.55, 0);
      const dipArm = new THREE.Mesh(extrudeProfile(armProfile(1.15, 0.19, 0.12), 0.17, 0.02), plantMat);
      dipArm.rotation.z = -1.28;
      dipArm.castShadow = !lite;
      const bucket = new THREE.Mesh(
        extrudeProfile((() => {
          const b = new THREE.Shape();
          b.moveTo(0, 0); b.lineTo(0.34, -0.06);
          b.quadraticCurveTo(0.40, -0.34, 0.12, -0.42);
          b.lineTo(-0.06, -0.30);
          b.closePath();
          return b;
        })(), 0.42, 0.02), trackMat);
      bucket.position.set(Math.cos(-1.28) * 1.15, Math.sin(-1.28) * 1.15, 0);
      bucket.castShadow = !lite;
      dipper.add(dipArm, bucket);
      const ram = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.9, 8), rimPMat);
      ram.position.set(0.9, 0.72, 0);
      ram.rotation.z = -0.5;
      /* Second and third rams. A real excavator has one cylinder per joint —
         boom, dipper and bucket — and the polished chrome rods are most of what
         reads as "hydraulic" at a glance. The boom ram was carrying that on its
         own. */
      const dipRam = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.72, 8), rimPMat);
      dipRam.position.set(0.42, 0.62, 0);
      dipRam.rotation.z = 0.42;
      dipper.add(dipRam);
      const bktLink = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.34, 6), rimPMat);
      bktLink.position.set(Math.cos(-1.28) * 0.86, Math.sin(-1.28) * 0.86 + 0.1, 0);
      bktLink.rotation.z = -0.9;
      dipper.add(bktLink);

      /* SIDE GLAZING + FRAMES. The house was extruded with a single windscreen
         opening, so from any angle other than dead ahead the cab read as a
         solid block. Real machine cabs are glazed on three sides. These are
         thin panels set just proud of the house flanks, with a dark surround so
         the glass sits IN a frame rather than being a hole in the bodywork. */
      ([-0.44, 0.44] as const).forEach((z) => {
        const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), plantGlassMat);
        sg.position.set(0.12, 0.42, z);
        sg.rotation.y = z > 0 ? 0 : Math.PI;
        upper.add(sg);
        const fr = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.46, 0.012), darkMat);
        fr.position.set(0.12, 0.42, z + (z > 0 ? -0.008 : 0.008));
        upper.add(fr);
      });
      // Surround for the windscreen, same reason.
      const wsFrame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.84), darkMat);
      wsFrame.position.set(0.53, 0.44, 0);
      upper.add(wsFrame);

      /* TWO HEADLAMPS on the cab front, plus one small warm light so they
         actually put something on the ground in front of the machine. Compact
         on purpose — a work lamp on an excavator is a 200 mm unit, and scaling
         it up to be "readable" is what turns it into a glowing sphere. */
      const digLampMat = new THREE.MeshStandardMaterial({
        color: 0x141210, emissive: 0xffe9c2, emissiveIntensity: 2.9, roughness: 0.3,
      });
      dispose.push(digLampMat);
      ([-0.3, 0.3] as const).forEach((z) => {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.1), digLampMat);
        hl.position.set(0.55, 0.66, z);
        upper.add(hl);
      });
      const digBeam = new THREE.PointLight(0xffdca8, 5.5, 6.5, 2);
      digBeam.position.set(1.5, 0.5, 0);
      upper.add(digBeam);

      /* COUNTERWEIGHT, ENGINE DECK AND HOUSING SPLIT.
         A tracked excavator is read by its rear as much as its arm: the slab
         counterweight balancing the boom, the low engine housing beside the
         cab, and the deck plate they all sit on. Without them the upper was one
         extruded silhouette with nothing behind the cab, which is what made it
         look like a single moulded shape. */
      const cWeight = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.82), plantMat);
      cWeight.position.set(-0.86, 0.24, 0);
      cWeight.castShadow = !lite;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.07, 0.92), trackMat);
      deck.position.set(-0.1, 0.0, 0);
      // Engine housing beside the cab, a step down from the cab roof.
      const engine = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.86), plantMat);
      engine.position.set(-0.46, 0.19, 0);
      engine.castShadow = !lite;
      // Louvre line where the housing panel meets the counterweight.
      const louvre = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.84), trackMat);
      louvre.position.set(-0.7, 0.2, 0);
      upper.add(cWeight, deck, engine, louvre);

      upper.add(boom, dipper, ram);
      dig.add(upper);
      /* GROUSERS — the track plates. A smooth extruded track reads as a rubber
         capsule; the cross-plates are what make it a track. Instanced, seven a
         side along the visible bottom run, so the whole detail is one draw
         call. */
      const grouser = mkIM(new THREE.BoxGeometry(0.11, 0.035, 0.30), trackMat, 14, false, dig);
      for (let i = 0, n = 0; i < 7; i++) {
        for (const z of [-0.38, 0.38] as const) {
          dummy.position.set(-0.66 + i * 0.22, 0.012, z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(1);
          put(grouser, n++);
        }
      }
      grouser.instanceMatrix.needsUpdate = true;
      /* 13% up. The machine was sized off the tracks alone and read a little
         light against a 22 m frontage and a 32 m excavation; this puts it back
         in proportion without changing where it stands or what it does. */
      dig.scale.setScalar(1.13);
      site.add(dig);

      /* MIXER TRUCK — 8.5 m forward-control chassis on six wheels. */
      const mixer = new THREE.Group();
      mixer.position.set(-HX + 2.8, 0, -2.4);
      mixer.rotation.y = 0.62;
      const lc = lorryCab();
      const mcab = new THREE.Mesh(extrudeProfile(lc.body, 0.86, 0.045), bodyMat);
      mcab.position.set(1.18, 0.30, 0);
      mcab.castShadow = !lite;
      const mcabGl = new THREE.Mesh(extrudeProfile(lc.glass, 0.82, 0.012), plantGlassMat);
      mcabGl.position.set(1.18, 0.30, 0);
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.16, 0.74), trackMat);
      chassis.position.set(0, 0.30, 0);
      const mStripe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.88), accentMat);
      mStripe.position.set(1.18, 0.36, 0);
      // Drum: a cone pair, tilted on its axis the way a mixer barrel sits.
      const drum = new THREE.Group();
      drum.position.set(-0.28, 0.98, 0);
      drum.rotation.z = -0.17;
      const barrel = new THREE.Group();
      drum.add(barrel);
      /* Drum in the red, cab in the white — the livery the brief asks for, and
         also how a real mixer is painted: the barrel takes the brand because it
         is the part that turns and is seen from every angle. 24 sides, not 16:
         a drum is the one part of this machine that is a pure surface of
         revolution, so facets on it are the most visible in the scene. */
      const d1 = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.46, 0.9, 24).rotateZ(Math.PI / 2), plantMat);
      d1.position.x = 0.48;
      const d2 = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.36, 0.85, 24).rotateZ(Math.PI / 2), plantMat);
      d2.position.x = -0.41;
      // Helical fins — the band that makes a drum read as a mixer at a glance.
      for (let i = 0; i < 8; i++) {
        // Steel bands over the red drum — chrome, so they catch the site
        // floods and read as the fins they are instead of vanishing into it.
        const f = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.022, 6, 18).rotateY(Math.PI / 2), rimPMat);
        f.position.x = -0.5 + i * 0.14;
        f.scale.setScalar(0.72 + Math.sin(i * 0.8) * 0.2);
        barrel.add(f);
      }
      barrel.add(d1, d2);
      d1.castShadow = d2.castShadow = !lite;
      const chute = new THREE.Mesh(extrudeProfile(armProfile(0.7, 0.26, 0.16), 0.2, 0.02), plantMat);
      chute.position.set(-1.3, 0.72, 0);
      chute.rotation.z = -0.55;
      mixer.add(chassis, mcab, mcabGl, mStripe, drum, chute);
      for (let i = 0; i < 6; i++) {
        wheelAt(mixer, 1.15 - (i >> 1) * 1.05, 0.19, i % 2 ? 0.42 : -0.42, 0.19, 0.16);
      }
      ([-0.3, 0.3] as const).forEach((z) => {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.14), lampPMat);
        hl.position.set(1.62, 0.42, z);
        mixer.add(hl);
      });
      site.add(mixer);

      /* ---- PLANT UPGRADE --------------------------------------------------
         The excavator and the mixer are one-off GROUPS, not instanced, so the
         swap is simpler than the road fleet's: hang the loaded model on the
         same transform and hide the procedural build. They upgrade one at a
         time — unlike the parked fleet, two different machines on a site are
         two different machines, so a real mixer beside a procedural digger
         reads as a site, not as a mistake.

         `site.visible` is driven by the timeline, so anything added to it
         appears and clears with the works for free. */
      const plantSwap = (slot: PlantSlot, proc: THREE.Group | null, x: number, z: number, ry: number) =>
        void loadModel(slot).then((m) => {
          if (!m) return;
          const at = (mesh: THREE.Object3D) => { mesh.position.set(x, 0, z); mesh.rotation.y = ry; };
          const body = new THREE.Mesh(m.body, m.materials.length === 1 ? m.materials[0] : m.materials);
          at(body);
          body.castShadow = body.receiveShadow = !lite;
          site.add(body);
          // Cab glazing takes the SCENE's glass, so it reflects this dusk.
          if (m.glass) { const g = new THREE.Mesh(m.glass, plantGlassMat); at(g); site.add(g); }
          if (proc) proc.visible = false;
          renderer.shadowMap.needsUpdate = true;
        });
      plantSwap('excavator', dig, HX - 2.6, PD / 2 + 1.0, -2.35);
      plantSwap('mixer', mixer, -HX + 2.8, -2.4, 0.62);
      /* The lorry has NO procedural counterpart — there is no lorry in this
         scene to replace, so this is a spawn point rather than a swap. Parked
         along the hoarding clear of the digger, the mixer and the rebar stacks;
         move it if a model turns out to want more room. */
      plantSwap('lorry', null, -HX + 3.2, PD / 2 + 1.4, 1.15);

      /* ---- DUMP TRUCK -----------------------------------------------------
         Backed in toward the excavation on the east side of the plot, which is
         where a tipper waits to be loaded. Built from the SAME parts the mixer
         uses — `lorryCab` for the flat-fronted cab profile, `extrudeProfile`
         for the body, `wheelAt` for tyre-on-rim wheels — so it shares the
         fleet's proportions and materials rather than being a second style of
         vehicle parked next to the first.
         Clear of everything: the pit rim is at z 4.7 and this sits at 7.0, the
         driveway runs x 4.9-7.9 and this occupies 1.9-2.9, and the excavator is
         6+ units away. */
      const tipper = new THREE.Group();
      tipper.position.set(2.4, 0, 7.0);
      tipper.rotation.y = -Math.PI / 2;          // nose to +z, bed toward the pit
      const tc = lorryCab();
      const tCab = new THREE.Mesh(extrudeProfile(tc.body, 0.84, 0.045), plantMat);
      tCab.position.set(1.05, 0.34, 0);
      tCab.castShadow = !lite;
      const tCabGl = new THREE.Mesh(extrudeProfile(tc.glass, 0.80, 0.012), plantGlassMat);
      tCabGl.position.set(1.05, 0.34, 0);
      // Chassis rails the whole thing sits on.
      const tChassis = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.16, 0.76), trackMat);
      tChassis.position.set(0, 0.34, 0);
      /* Tipping body: sides, headboard and floor rather than one solid box, so
         it reads as a container with a rim and a shadow inside it. */
      const bodyG = new THREE.Group();
      bodyG.position.set(-0.62, 0.44, 0);
      const floorB = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.07, 0.86), plantMat);
      bodyG.add(floorB);
      ([-0.46, 0.46] as const).forEach((z) => {
        const w = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.34, 0.05), plantMat);
        w.position.set(0, 0.2, z);
        w.castShadow = !lite;
        bodyG.add(w);
      });
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.9), plantMat);
      head.position.set(0.96, 0.24, 0);
      bodyG.add(head);
      // Ram that would tip it, tucked under the front of the body.
      const tipRam = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.42, 8), rimPMat);
      tipRam.position.set(0.62, 0.16, 0);
      tipRam.rotation.z = 0.5;
      bodyG.add(tipRam);
      // Grille, mirrors and lamps — the details that stop a cab being a box.
      const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.66), trackMat);
      grille.position.set(1.62, 0.42, 0);
      const tLampMat = new THREE.MeshStandardMaterial({
        color: 0x141210, emissive: 0xffe9c2, emissiveIntensity: 2.9, roughness: 0.3,
      });
      dispose.push(tLampMat);
      ([-0.28, 0.28] as const).forEach((z) => {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.12), tLampMat);
        hl.position.set(1.63, 0.3, z);
        tipper.add(hl);
        // Mirror on its stalk, off the A-pillar.
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.14), darkMat);
        arm.position.set(1.3, 0.72, z * 1.6);
        tipper.add(arm);
        const mir = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.19, 0.07), darkMat);
        mir.position.set(1.3, 0.66, z * 2.05);
        tipper.add(mir);
      });
      /* Bumper, fenders and mudguards. A truck cab without a bumper and
         without arches over its wheels is a box on wheels — these three are
         most of what the eye uses to tell a lorry from a crate. */
      const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.94), trackMat);
      bumper.position.set(1.66, 0.22, 0);
      ([-0.42, 0.42] as const).forEach((z) => {
        const fend = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.26), plantMat);
        fend.position.set(1.15, 0.41, z);
        tipper.add(fend);
      });
      ([-0.44, 0.44] as const).forEach((z) => {
        const mud = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.05, 0.28), trackMat);
        mud.position.set(-0.84, 0.42, z);
        tipper.add(mud);
      });
      /* SIDE GLAZING + FRAMES on the cab. `lorryCab` gives a windscreen only,
         so the cab was blind from the side — which is the angle the hero camera
         actually sees it from. */
      ([-0.425, 0.425] as const).forEach((z) => {
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.24), plantGlassMat);
        sw.position.set(0.92, 0.63, z);
        sw.rotation.y = z > 0 ? 0 : Math.PI;
        tipper.add(sw);
        const swf = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.28, 0.012), darkMat);
        swf.position.set(0.92, 0.63, z + (z > 0 ? -0.008 : 0.008));
        tipper.add(swf);
      });
      // Windscreen surround, so the glass sits in a frame rather than in a hole.
      const wsF = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.86), darkMat);
      wsF.position.set(1.44, 0.66, 0);
      /* REAR LAMPS. Red, small, and on the tail of the tipping body — the truck
         is backed toward the excavation, so its rear is what faces the camera
         for most of the build. */
      const tTailMat = new THREE.MeshStandardMaterial({
        color: 0x1a0304, emissive: 0xff2f26, emissiveIntensity: 2.4, roughness: 0.35,
      });
      dispose.push(tTailMat);
      ([-0.34, 0.34] as const).forEach((z) => {
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.08), tTailMat);
        tl.position.set(-1.60, 0.36, z);
        tipper.add(tl);
      });
      tipper.add(tChassis, tCab, tCabGl, bodyG, grille, bumper, wsF);
      // Six wheels: steer axle plus a twin-tyred rear bogie, on the ground.
      ([[1.15, 0.42], [1.15, -0.42], [-0.62, 0.44], [-0.62, -0.44], [-1.06, 0.44], [-1.06, -0.44]] as const)
        .forEach(([x, z]) => wheelAt(tipper, x, 0.21, z, 0.21, 0.17));
      site.add(tipper);

      const stackN = lite ? 14 : 26;
      const stackIM = mkIM(new THREE.CylinderGeometry(0.042, 0.042, 4.4, 6).rotateZ(Math.PI / 2), rebarMat, stackN, false, site);
      /* THE TIMBER STACK IS GONE. Ten 4.7 m planks of shuttering, and wherever
         they were staged they read as a second structure rather than as
         material: behind the building they silhouetted between the columns, on
         the flank they still put two long horizontal wooden members in frame
         beside a concrete frame that has none. A site does not need a visible
         timber pile to read as a site — it has the hoarding, the plant, the
         crews, the rebar and the crane — and this one was costing more in
         "what is that building behind it?" than it returned. */
      /* Rebar stock restaged from z = -7.4 to the west flank. These are 12 m
         rods and they lie flat, so they never silhouetted the way the masts
         did — but a bundle of long horizontal members directly behind the
         foundation still reads as beams belonging to something. Beside the
         elevation they are destined for, they read as what they are: steel
         waiting to be placed. Kept in full; this is stock for the building's
         own reinforcement, not clutter. */
      for (let i = 0; i < stackN; i++) {
        dummy.position.set(-HX + 2.2 + (i % 5) * 0.1, 0.05 + Math.floor(i / 5) * 0.09, -1.4 + (i % 5) * 0.11 + Math.floor(i / 5) * 0.02);
        dummy.rotation.set(0, 0.22, 0);
        dummy.scale.setScalar(1);
        put(stackIM, i);
      }
      stackIM.instanceMatrix.needsUpdate = true;

      tick.push((t, dt) => {
        const inK = ease(span(0.02, 0.1, t));
        const out = ease(span(P.clear[0], P.clear[1], t));
        site.visible = inK > 0.02 && out < 0.99;
        if (!site.visible) return;
        site.scale.setScalar(s0(inK * (1 - out)));
        // Site lighting comes up as the sun goes, and hands over to the building.
        const lampsOn = ease(span(0.05, 0.24, t)) * (1 - ease(span(P.clear[0], 1.0, t)) * 0.6);
        spriteMat.opacity = 0.7 * lampsOn;
        lampMat.color.setScalar(mix(0.25, 1, lampsOn));
        flood.forEach((l, i) => { l.intensity = (i === 2 ? 30 : 70) * lampsOn; });
        barrel.rotation.x += dt * 1.4;
      });
    }

    /* ======================================================================
       THE COMPLETED PROPERTY  (foundation-5)
       Forecourt, driveway, parking, cars, boundary, gate, planting, street.
       One group whose materials fade from transparent to OPAQUE — a
       depth-sorted transparent plaza at opacity 1 drops whatever stands on it.
       ====================================================================== */
    {
      const done = new THREE.Group();
      world.add(done);

      const poolTexS = softDot(64);
      texs.push(poolTexS);
      const pav = pavingMaps(lite ? 128 : 256);
      texs.push(...Object.values(pav));
      // ~1.2 m slabs across a 40 m forecourt.
      Object.values(pav).forEach((tx) => { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(32, 28); });
      const pavMat = new THREE.MeshStandardMaterial({ ...pav, color: 0x8f9298, roughness: 0.62, metalness: 0.06, transparent: true, opacity: 0, envMapIntensity: 0.55 });
      dispose.push(pavMat);
      const plaza = new THREE.Mesh(new THREE.PlaneGeometry(BX * 2, BZ * 2).rotateX(-Math.PI / 2), pavMat);
      plaza.position.set(0, 0.015, 0);
      plaza.receiveShadow = !lite;
      done.add(plaza);

      /* Asphalt for the driveway and the parking apron — darker than the
         forecourt paving, which is what makes the two read as different
         surfaces rather than as one grey field. */
      /* ASPHALT, not a flat dark plane. The driveway, the apron and the
         drop-off are the ground directly under the entrance — they are in
         nearly every frame of the build and the whole of the car exit — and
         they were a single uncontrasted colour, which is most of what made the
         forecourt read as a plane rather than a surface.
         `concreteMaps` TAKES A TINT, so the granular albedo/normal/roughness
         set it already generates for concrete becomes asphalt by asking for it
         in asphalt's colour. No new generator: a second noise routine that
         produced the same thing in a different file is exactly the kind of
         duplication this scene does not need.
         Repeat is tight — 0.9 m per tile across the forecourt — because
         asphalt aggregate is small; at the paving's 1.2 m the grain reads as
         tiling instead of as texture. */
      const tar = concreteMaps(lite ? 128 : 256, [44, 47, 54], true);
      texs.push(...Object.values(tar));
      Object.values(tar).forEach((tx) => { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(42, 38); });
      const tarMat = new THREE.MeshStandardMaterial({
        ...tar, color: 0x2a2d33, roughness: 0.72, metalness: 0.12,
        // Normals kept shallow: asphalt is rough, not lumpy, and a strong
        // normal on a near-flat plane catches the street lights as a rash of
        // specular dots.
        normalScale: new THREE.Vector2(0.35, 0.35),
        transparent: true, opacity: 0, envMapIntensity: 0.5,
      });
      dispose.push(tarMat);
      const drive = new THREE.Mesh(new THREE.PlaneGeometry(3.0, BZ + 4.0).rotateX(-Math.PI / 2), tarMat);
      drive.position.set(DRIVE_X, 0.02, BD / 2 - 1.0);
      drive.receiveShadow = !lite;
      const apron = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 9.4).rotateX(-Math.PI / 2), tarMat);
      apron.position.set(BW / 2 + 2.7, 0.02, -0.4);
      apron.receiveShadow = !lite;
      const dropoff = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 2.8).rotateX(-Math.PI / 2), tarMat);
      dropoff.position.set(1.2, 0.021, BD / 2 + 3.5);
      dropoff.receiveShadow = !lite;
      done.add(drive, apron, dropoff);

      /* PARKING. Eight bays along the boundary plus four visitor bays at the
         drop-off, marked out properly — a car park without bay lines reads as
         cars dumped on tarmac. */
      const markMat = new THREE.MeshBasicMaterial({ color: 0xd8d4c6, transparent: true, opacity: 0 });
      dispose.push(markMat);
      const BAY_W = 0.92, BAY_D = 1.9;
      type Slot = { x: number; z: number; rot: number };
      const slots: Slot[] = [];
      for (let i = 0; i < 8; i++) slots.push({ x: BW / 2 + 2.7, z: -3.5 + i * BAY_W, rot: 0 });
      for (let i = 0; i < 4; i++) slots.push({ x: -1.8 - i * BAY_W, z: BD / 2 + 4.7, rot: Math.PI / 2 });
      const markIM = mkIM(new THREE.PlaneGeometry(BAY_D, 0.05).rotateX(-Math.PI / 2), markMat, slots.length + 2, false, done);
      markIM.renderOrder = 1;

      /* THE CAR PARK. Three body types (see carGeometry) rather than one shape
         repeated, each with its own paint from a real-world spread of car
         colours — a car park where every vehicle is the same object in the same
         colour is one of the loudest "this is a game" tells there is.

         Metallic paint: low roughness, high metalness and a strong environment
         reflection, so the dusk sky and the lit facade sit on the panels. Six
         instanced meshes carry the whole car park — bodies, glazing, tyres,
         rims, tail lamps, head lamps — one draw call each. */
      /* Automotive paint is a DIELECTRIC base with metallic flake under a clear
         coat — not chrome. At metalness 0.65 a dark car has no diffuse term at
         all and goes pure black the moment the sun is down, which is exactly how
         the first pass read. 0.45 with a full clearcoat keeps the flake sparkle
         and still lets the body take light from the street and the facade. */
      /* NOT metalness 0.85. A metal surface has NO diffuse term — it is lit
         entirely by what it reflects — so at 0.85 a dark car at night has
         almost nothing to reflect and goes pure black. That is the note above,
         and it is also the exact symptom being fixed here: cars swallowed in
         shadow. Raising metalness would deepen the hole, not fill it.
         What actually makes a dark car read at night is REFLECTION, which is
         how it works in real night photography: you see a black car by the
         street lights and the lit facade running along its shoulder, not by
         its paint. So metalness stays dielectric-with-flake and the
         ENVIRONMENT term goes up hard — 2.8 to 3.8 — with a slightly sharper
         coat so those reflections are legible shapes rather than a sheen. */
      const carMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.22, metalness: 0.40, envMapIntensity: 3.8,
        clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0,
      });
      /* Glazing DARKER than the paint, not brighter. At 2.2 the windows mirrored
         the sky so hard they read as white panels stuck on a black car. */
      const carGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0x0d1119, roughness: 0.08, metalness: 0.25, envMapIntensity: 1.0,
        clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0,
      });
      const tyreMat = new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.94, transparent: true, opacity: 0 });
      // Rims carry the only bright note low on a dark car; they are what stops
      // the silhouette dissolving into the road under it.
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xc2c8cf, roughness: 0.2, metalness: 0.95, envMapIntensity: 2.6, transparent: true, opacity: 0 });
      /* LAMPS THAT ACTUALLY BURN. These were MeshBasicMaterial — flat, unlit,
         and capped at the colour value, so at dusk they sat at exactly the same
         brightness as a white kerb and read as painted-on decals.
         Emissive on a standard material can exceed 1.0, and ACES tone mapping
         then rolls that off into a hot core with a falling edge — which is what
         a lamp looks like through a camera. The base colour is near-black so
         the lens is a dark lens when the intensity ramp has it off, instead of
         a pale rectangle. No bloom pass is involved: the glow is the tone
         curve doing its job, which is why it cannot smear over the building. */
      const tailMat = new THREE.MeshStandardMaterial({
        color: 0x1a0304, emissive: 0xff2f26, emissiveIntensity: 2.8,
        roughness: 0.35, transparent: true, opacity: 0,
      });
      const headMatC = new THREE.MeshStandardMaterial({
        color: 0x14120f, emissive: 0xfff4de, emissiveIntensity: 3.6,
        roughness: 0.28, transparent: true, opacity: 0,
      });
      dispose.push(carMat, carGlassMat, tyreMat, rimMat, tailMat, headMatC);

      const SALOON = carGeometry('saloon');
      const SUV = carGeometry('suv');
      const VAN = carGeometry('van');
      const CARN = lite ? 7 : 11;
      /* Which body each bay gets. The van is a service vehicle at the far end of
         the run, where a delivery would actually park. */
      const kindOf = (i: number) => (i === CARN - 2 ? VAN : i % 3 === 1 ? SUV : SALOON);
      const carIM = mkIM(SALOON.body, carMat, CARN, true, done);
      const carIM2 = mkIM(SUV.body, carMat, CARN, true, done);
      const carIM3 = mkIM(VAN.body, carMat, CARN, true, done);
      const glassIM1 = mkIM(SALOON.glass, carGlassMat, CARN, false, done);
      const glassIM2 = mkIM(SUV.glass, carGlassMat, CARN, false, done);
      const glassIM3 = mkIM(VAN.glass, carGlassMat, CARN, false, done);
      const bodySets = [
        { g: SALOON, im: carIM, gl: glassIM1 },
        { g: SUV, im: carIM2, gl: glassIM2 },
        { g: VAN, im: carIM3, gl: glassIM3 },
      ];
      /* THE "WHEEL-WELL TUB" IS GONE, and it was mine.
         It was a near-black 1.34 x 0.46 x 0.5 box drawn inside every car to
         darken the cabin seen through the glazing. That worked against the old
         profile. When the saloon was re-authored as a long-bonnet luxury sedan
         its roofline dropped to 0.556 and its screens were raked much further,
         while this box stayed where it was — so it ended up standing proud of
         the bodywork along nearly the whole greenhouse: 4 cm at the roof panel,
         27 cm over the windscreen, 62 cm over the boot. That is the black block
         on the roof.
         Deleted rather than resized, because it is now redundant: the glazing
         is its own extrusion filling the window opening, in a dark clearcoat
         glass that reaches full opacity with the rest of the car, so the cabin
         already reads dark without a box inside it. */
      /* 10 x 24, up from 6 x 14. A six-segment tube gives a tyre with a hexagonal
         cross-section, which catches specular in six flat bands — the single
         most legible "low-poly" tell on a car at this distance. Tube radius up a
         touch too: 0.033 was a bicycle tyre on a saloon. */
      const tyreGeo = new THREE.TorusGeometry(0.104, 0.038, 10, 24);
      const rimGeo = new THREE.CylinderGeometry(0.076, 0.076, 0.085, 20).rotateX(Math.PI / 2);
      const tyreIM = mkIM(tyreGeo, tyreMat, CARN * 4, false, done);
      const rimIM = mkIM(rimGeo, rimMat, CARN * 4, false, done);
      const tailIM = mkIM(new THREE.BoxGeometry(0.035, 0.04, 0.2), tailMat, CARN * 2, false, done);
      /* WIDER AND THINNER. 0.05 x 0.16 is 14 x 45 cm — a lamp from before
         about 1995. A modern unit is a shallow bar, and at this distance the
         PROPORTION is the only part of it that reads. */
      const headIM = mkIM(new THREE.BoxGeometry(0.03, 0.035, 0.22), headMatC, CARN * 2, false, done);
      /* A real-world spread: two whites, two silvers, graphite, navy, a single
         crimson. Nothing saturated — car parks are overwhelmingly monochrome. */
      /* A real-world spread — nothing saturated, car parks are monochrome. The
         LAST entry is the hero car, and it is deliberately the palest: a dark
         car at blue hour is a silhouette, and the hero has to hold the eye all
         the way down the road. */
      /* Darkened toward graphite, navy and gunmetal — a prestige car park, not
         a supermarket one. THE LAST ENTRY IS STILL DELIBERATELY PALE: it is the
         hero car, and a dark car at blue hour is a silhouette. It has to hold
         the eye all the way down the road once it leaves the gate, so it keeps
         its light paint while everything parked around it goes dark. */
      /* Still a dark fleet, but the two near-black entries (0x191d24,
         0x1f2733) are lifted: below roughly #22 a car at blue hour has no
         value left to reflect INTO and reads as a hole in the render rather
         than as a dark car. */
      const CAR_COL = [0x2e3540, 0x252b34, 0x39414d, 0x6d0f16, 0x2a3038, 0x2b3240, 0x4c5866, 0x272d36, 0x333a44, 0x2c3542, 0xd8dde2];
      bodySets.forEach(({ im }) => {
        for (let i = 0; i < CARN; i++) im.setColorAt(i, col.setHex(CAR_COL[i % CAR_COL.length]));
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      });
      /* Where each car ends up. Bay-aligned, nose-in, with a little jitter so
         they are parked rather than placed on a grid. The LAST one is the hero:
         it waits at the drop-off and then drives out — see the outro. */
      const parkedAt: Slot[] = slots.slice(0, CARN - 1).map((s, i) => ({
        ...s,
        x: s.x + (rnd(i, 211) - 0.5) * 0.16,
        z: s.z + (rnd(i, 223) - 0.5) * 0.1,
        rot: s.rot + (rnd(i, 227) - 0.5) * 0.07,
      }));
      /* OFF THE ENTRANCE AXIS. The hero car waits at the drop-off for the
         whole build and then drives out in act two — and at x = 1.0 it waited
         squarely on the walk to the front door, which is now a paved approach
         with lights down it. Moved to the far side of the drop-off: still at
         the kerb where a waiting car belongs, still on the asphalt, and the
         steps and the doors are clear behind it. `PATH` starts here too. */
      parkedAt.push({ x: 3.2, z: BD / 2 + 3.5, rot: Math.PI });

      // Boundary: a LOW wall with a slim railing over it — 1.6 m all in.
      const wallMat = new THREE.MeshStandardMaterial({ map: stoneTex.map, roughnessMap: stoneTex.rough, roughness: 1, transparent: true, opacity: 0 });
      dispose.push(wallMat);
      /* THE FRONT WALL IS IN TWO RUNS, with the vehicle entrance between them.
         It used to be a single span the full width of the site — so the boundary
         wall, and the railing above it, ran straight across the gate opening.
         The gate then swung open into a wall of bars, which is exactly the
         "grills inside the gate" that had to go. `GAP` is the clear opening; the
         gate leaves, the piers and the driveway are all set out from the same
         DRIVE_X, so the three can never drift apart. */
      const GAP = 2.0;
      const frontRuns: [number, number][] = [
        [(-BX + (DRIVE_X - GAP)) / 2, (DRIVE_X - GAP) + BX],   // centre, length
        [((DRIVE_X + GAP) + BX) / 2, BX - (DRIVE_X + GAP)],
      ];
      /* COPING CAP. A boundary wall with a square top edge is the giveaway that
         it was extruded rather than built — every real compound wall is capped,
         both to throw water clear of the face and because the shadow line under
         the overhang is what gives the wall its thickness. 40 mm proud on each
         side and 60 mm deep, in the darker stone so it reads as a separate
         course rather than a bevel. */
      const CAP_T = 0.06, CAP_OVER = 0.04;
      const capMat = new THREE.MeshStandardMaterial({
        map: stoneTex.map, roughnessMap: stoneTex.rough, color: 0x8f949b,
        roughness: 0.86, metalness: 0.04, transparent: true, opacity: 0,
      });
      dispose.push(capMat);
      /** One wall run plus its cap, laid along +x and rotated by the caller. */
      const wallRun = (len: number, x: number, z: number, ry: number) => {
        const m = new THREE.Mesh(fromBase(new THREE.BoxGeometry(len, 0.4, 0.22), 0.4), wallMat);
        const cap = new THREE.Mesh(
          fromBase(new THREE.BoxGeometry(len, CAP_T, 0.22 + CAP_OVER * 2), CAP_T), capMat,
        );
        cap.position.y = 0.4;
        m.add(cap);
        m.position.set(x, 0, z);
        m.rotation.y = ry;
        m.receiveShadow = cap.castShadow = cap.receiveShadow = !lite;
        done.add(m);
        return m;
      };
      frontRuns.forEach(([cx, len]) => wallRun(len, cx, BZ, 0));
      ([-BX, BX] as const).forEach((x) => wallRun(BZ * 2, x, 0, Math.PI / 2));
      const railN = lite ? 46 : 92;
      const railIM = mkIM(fromBase(new THREE.BoxGeometry(0.026, 0.4, 0.026), 0.4), darkMat, railN, false, done);
      const railTop = new THREE.Group();
      frontRuns.forEach(([cx, len]) => {
        const r = new THREE.Mesh(fromBase(new THREE.BoxGeometry(len, 0.05, 0.06), 0.05), darkMat);
        r.position.set(cx, 0.78, BZ);
        railTop.add(r);
      });
      done.add(railTop);

      // Gate: two stone piers, two leaves, a signed pier and a gatehouse.
      const gate = new THREE.Group();
      gate.position.set(DRIVE_X, 0, BZ);
      const gp1 = new THREE.Mesh(fromBase(new THREE.BoxGeometry(0.4, 1.3, 0.4), 1.3), wallMat);
      gp1.position.x = -1.7;
      const gp2 = new THREE.Mesh(fromBase(new THREE.BoxGeometry(0.4, 1.3, 0.4), 1.3), wallMat);
      gp2.position.x = 1.7;
      /* A LEAF, not a slab: two rails and eleven balusters, merged once and used
         twice, hung on a PIVOT at each pier so the gate swings the way a gate
         swings. `rotation.y` on the pivot is the whole animation, and because it
         is a pure function of act-two progress it closes again on the way up. */
      const LEAF_W = 1.5;
      const leafGeo = mergeGeometries([
        new THREE.BoxGeometry(LEAF_W, 0.07, 0.05).translate(LEAF_W / 2, 0.9, 0),
        new THREE.BoxGeometry(LEAF_W, 0.06, 0.05).translate(LEAF_W / 2, 0.16, 0),
        ...Array.from({ length: 11 }, (_, i) =>
          new THREE.BoxGeometry(0.035, 0.85, 0.035).translate(0.11 + i * 0.132, 0.5, 0)),
      ])!;
      const hinge1 = new THREE.Group();
      hinge1.position.x = -1.62;
      const leaf1 = new THREE.Mesh(leafGeo, darkMat);
      leaf1.castShadow = !lite;
      hinge1.add(leaf1);
      const hinge2 = new THREE.Group();
      hinge2.position.x = 1.62;
      hinge2.rotation.y = Math.PI;      // mirrored, so it swings the other way
      const leaf2 = new THREE.Mesh(leafGeo, darkMat);
      leaf2.castShadow = !lite;
      hinge2.add(leaf2);
      // Pier-cap lamps — the gate lights that come on before the gate moves.
      const gateLampMat = new THREE.MeshBasicMaterial({ color: 0xffe6bd, transparent: true, opacity: 0 });
      dispose.push(gateLampMat);
      const capL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.2), gateLampMat);
      capL.position.set(-1.7, 1.36, 0);
      const capR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.2), gateLampMat);
      capR.position.set(1.7, 1.36, 0);
      const gateBoard = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.44, 0.06), signBoardMat);
      gateBoard.position.set(-2.7, 0.9, 0.02);
      const gateSign = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.33), signMat);
      gateSign.position.set(-2.7, 0.9, 0.06);
      gate.add(gp1, gp2, hinge1, hinge2, capL, capR, gateBoard, gateSign);
      const gateLight = new THREE.PointLight(0xffd9a2, 0, 9, 2);
      gateLight.position.set(DRIVE_X, 1.5, BZ - 0.4);
      done.add(gateLight);
      rig.hinge1 = hinge1; rig.hinge2 = hinge2;
      rig.lampMat = gateLampMat; rig.light = gateLight;
      /* GATEHOUSE. The previous version was a plain white box with one glazed
         panel stuck on the front, and beside the gate it read as a valve or a
         standpipe rather than as a building. A real one has a stone base, a
         glazed upper storey on every face, a capping slab that oversails, and a
         light — so that is what this is now. */
      const guard = new THREE.Group();
      guard.position.set(DRIVE_X - 3.1, 0, BZ - 1.05);
      guard.rotation.y = -0.18;
      const gBase = new THREE.Mesh(fromBase(new THREE.BoxGeometry(1.05, 0.42, 1.0), 0.42), wallMat);
      const gPost = new THREE.Mesh(fromBase(new THREE.BoxGeometry(1.0, 0.72, 0.95), 0.72), glassMat);
      gPost.position.y = 0.42;
      // Corner mullions, so the glazing reads as a frame and not as a fish tank.
      const gFrame = mergeGeometries(([[-0.5, -0.47], [0.5, -0.47], [-0.5, 0.47], [0.5, 0.47]] as const)
        .map(([x, z]) => new THREE.BoxGeometry(0.06, 0.74, 0.06).translate(x, 0.79, z)))!;
      const gMull = new THREE.Mesh(gFrame, darkMat);
      const gRoof = new THREE.Mesh(fromBase(new THREE.BoxGeometry(1.3, 0.12, 1.24), 0.12), stoneMat);
      gRoof.position.y = 1.14;
      const gLamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), gateLampMat);
      gLamp.position.set(0, 1.3, 0);
      guard.add(gBase, gPost, gMull, gRoof, gLamp);
      guard.traverse((o) => { o.castShadow = !lite; });
      done.add(gate, guard);

      /* PLANTING. Varied heights, three canopy lobes per tree at different
         scales and rotations, three green tones — the single-sphere trees all at
         one size were the most game-like thing in the scene. */
      const treeN = lite ? 12 : 22;
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x35291f, roughness: 0.95, transparent: true, opacity: 0 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0 });
      dispose.push(trunkMat, leafMat);
      /* Six clusters, not three. Three sit at 120 degrees and read as a
         trefoil however they are scaled; six overlap into a silhouette with no
         obvious symmetry, which is the whole difference between a canopy and a
         lollipop. Phones keep three — the count is the cost here. */
      const LOBES = lite ? 3 : 6;
      type Tree = { x: number; z: number; s: number };
      const TREES: Tree[] = [];
      for (let i = 0; i < treeN; i++) {
        const r = rnd(i, 101);
        let x: number, z: number;
        if (i < treeN * 0.42) { x = -BX + 0.9 + r * (BX * 2 - 1.8); z = BZ - 1.05 + (rnd(i, 103) - 0.5) * 0.5; }
        else if (i < treeN * 0.78) { x = (i % 2 ? -1 : 1) * (BX - 0.9 - rnd(i, 107) * 0.5); z = (r - 0.5) * BZ * 1.7; }
        else { x = -BX + 1.2 + rnd(i, 109) * 2.6; z = BD / 2 + 1.2 + rnd(i, 113) * 3.4; }
        // Keep the drive, the apron and the entrance axis clear.
        if (Math.abs(x - DRIVE_X) < 2.2 && z > -2) continue;
        if (x > BW / 2 + 1.2 && Math.abs(z) < 5.2) continue;
        /* Nothing inside the entrance cone — the drop-off, the steps, the
           screen and both signs have to stay clear from every camera key.
           WIDER AND DEEPER than it was (5.0 x 6.4). The hero keys stand ~10 m
           to the +x side and look back across the forecourt, so a tree at
           x = 5.5 is not beside the entrance from there, it is in front of it;
           and the canopy fascia is 5.4 m wide, so a 5.0 half-width was cutting
           the cone inside the thing it was protecting. */
        if (Math.abs(x) < 6.4 && z > BD / 2 && z < BD / 2 + 7.6) continue;
        TREES.push({ x, z, s: 0.62 + rnd(i, 127) * 0.75 });
      }
      /* 8-sided and more tapered than the old hexagon: at this distance a
         6-sided trunk catches light on flat facets and reads as a pencil. */
      const trunkIM = mkIM(fromBase(new THREE.CylinderGeometry(0.038, 0.072, 1, 8), 1), trunkMat, TREES.length, true, done);
      /* AN ICOSAHEDRON IS A SPHERE, and a sphere is exactly what makes these
         read as toy trees. Pushed in and out once, here, by a smooth function
         of each vertex's own direction — low frequency on purpose, so
         neighbouring vertices move together and the result is lumpy rather
         than spiky. One deformation shared by every instance is enough,
         because each lobe is placed at its own rotation and its own
         non-uniform scale, so no two present the same profile to the camera. */
      const lobeGeo = new THREE.IcosahedronGeometry(1, lite ? 0 : 1);
      {
        const lp = lobeGeo.attributes.position as THREE.BufferAttribute;
        const lv = new THREE.Vector3();
        for (let i = 0; i < lp.count; i++) {
          lv.fromBufferAttribute(lp, i);
          const n = Math.sin(lv.x * 3.1 + 1.7) * Math.cos(lv.y * 2.6) * Math.sin(lv.z * 3.7 + 0.4);
          lv.multiplyScalar(1 + n * 0.28);
          lp.setXYZ(i, lv.x, lv.y, lv.z);
        }
        lp.needsUpdate = true;
        lobeGeo.computeVertexNormals();
      }
      const leafIM = mkIM(lobeGeo, leafMat, TREES.length * LOBES, true, done);
      const LEAF_COL = [0x35502f, 0x2a4429, 0x40573a];
      for (let i = 0; i < TREES.length * LOBES; i++) leafIM.setColorAt(i, col.setHex(LEAF_COL[i % 3]));
      if (leafIM.instanceColor) leafIM.instanceColor.needsUpdate = true;
      /* A real tree model replaces BOTH the trunk cylinder and the icosahedron
         canopy lobes — the lobes are the low-poly tell, and a loaded tree
         brings its own. The trunk mesh becomes the carrier so the placement
         loop keeps its positions, its stagger and its growth timing; the only
         thing that changes is that the instance scale goes uniform, because a
         whole tree cannot be stretched on Y the way a bare trunk could. */
      let treeGLB = false;
      void loadModel('tree').then((tm) => {
        if (!tm) return;
        trunkIM.geometry.dispose();
        trunkIM.geometry = tm.body;
        setMats(trunkIM, tm.materials);
        leafIM.geometry.dispose();
        leafIM.geometry = EMPTY_GEO();
        treeGLB = true;
        renderer.shadowMap.needsUpdate = true;
      });

      const grass = grassMaps(lite ? 128 : 256);
      texs.push(...Object.values(grass));
      Object.values(grass).forEach((tx) => { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(8, 2); });
      const lawnMat = new THREE.MeshStandardMaterial({ ...grass, roughness: 0.96, transparent: true, opacity: 0 });
      const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x2c4429, roughness: 0.95, transparent: true, opacity: 0 });
      dispose.push(lawnMat, hedgeMat);
      const lawn = new THREE.Mesh(new THREE.PlaneGeometry(BX * 2 - 1.2, 1.5).rotateX(-Math.PI / 2), lawnMat);
      lawn.position.set(0, 0.022, BZ - 1.9);
      lawn.receiveShadow = !lite;
      done.add(lawn);
      const hedgeIM = mkIM(fromBase(new THREE.BoxGeometry(1, 0.4, 0.55), 0.4), hedgeMat, 14, false, done);

      // Street lighting, set out to CLEAR the building.
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x30353c, roughness: 0.55, metalness: 0.5, transparent: true, opacity: 0 });
      const headMat = new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: 0 });
      dispose.push(poleMat, headMat);
      [-16.5, -9.4, 9.4, 16.5].forEach((x) => {
        const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 2.8, 6), poleMat);
        pl.position.set(x, 1.4, BZ + 1.2);
        const hd = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.15), headMat);
        hd.position.set(x + 0.24, 2.78, BZ + 1.2);
        done.add(pl, hd);
      });
      const bollardIM = mkIM(fromBase(new THREE.CylinderGeometry(0.045, 0.05, 0.32, 8), 0.32), darkMat, 8, false, done);

      /* Street: a real carriageway with markings and a wet sheen, so the
         property sits ON something rather than floating on a ground plane. */
      const roadTex = roadTexture(lite ? 256 : 512);
      texs.push(roadTex);
      roadTex.repeat.set(9, 1);
      /* SEMI-WET ASPHALT. metalness 0.55 was the bug: asphalt is a DIELECTRIC,
         and a half-metal road reflects like sheet steel — hard, bright, and
         mirror-sharp, which is exactly what turned the lamp throw into solid
         white circles. 0.1 metalness with 0.35 roughness is a damp dielectric:
         it returns long soft streaks from headlights and the lit facade
         instead of a hotspot. envMap up, because on a wet road the reflection
         IS the surface. */
      const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, color: 0x8d9199, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0, envMapIntensity: 2.1 });
      dispose.push(roadMat);
      const road = new THREE.Mesh(new THREE.PlaneGeometry(200, 9.6).rotateX(-Math.PI / 2), roadMat);
      road.position.set(0, 0.008, ROAD_Z);
      /* Kerbs, in the same family. Cast concrete rather than asphalt, so the
         tint is pale and the pitting is off — a kerb is float-finished and
         does not carry the aggregate the road does. Coarser repeat: these are
         long thin runs, and a fine grain on a 0.15 m face is invisible. */
      const kerbTex = concreteMaps(128, [158, 163, 169], false);
      texs.push(...Object.values(kerbTex));
      Object.values(kerbTex).forEach((tx) => { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(18, 2); });
      const kerbMat = new THREE.MeshStandardMaterial({
        ...kerbTex, color: 0x9ba0a6, roughness: 0.8,
        normalScale: new THREE.Vector2(0.4, 0.4),
        transparent: true, opacity: 0,
      });
      dispose.push(kerbMat);
      const kerb = new THREE.Mesh(fromBase(new THREE.BoxGeometry(200, 0.11, 0.3), 0.11), kerbMat);
      kerb.position.set(0, 0, ROAD_Z - 4.9);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(200, 2.0).rotateX(-Math.PI / 2), pavMat);
      walk.position.set(0, 0.016, ROAD_Z - 5.9);
      /* THE FAR SIDE. The camera ends the film looking across the carriageway,
         so the opposite pavement, kerb and boundary have to exist or the shot
         resolves onto bare ground. Mirrors of the near side, plus a low frontage
         wall — the far-side BUILDINGS stay well back (see the city block) so the
         portrait camera, which stands in the street, never has one between it
         and the landmark. */
      const kerbF = new THREE.Mesh(fromBase(new THREE.BoxGeometry(200, 0.11, 0.3), 0.11), kerbMat);
      kerbF.position.set(0, 0, ROAD_Z + 4.9);
      const walkF = new THREE.Mesh(new THREE.PlaneGeometry(200, 5.0).rotateX(-Math.PI / 2), pavMat);
      walkF.position.set(0, 0.016, ROAD_Z + 7.5);
      const wallF = new THREE.Mesh(fromBase(new THREE.BoxGeometry(200, 0.55, 0.26), 0.55), wallMat);
      wallF.position.set(0, 0, ROAD_Z + 10.0);
      done.add(road, kerb, walk, kerbF, walkF, wallF);
      /* Street lighting on the far kerb too, offset half a bay from the near
         side the way a real carriageway is lit. */
      [-13.0, -5.5, 5.5, 13.0].forEach((x) => {
        const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 2.8, 6), poleMat);
        pl.position.set(x, 1.4, ROAD_Z + 4.4);
        const hd = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.15), headMat);
        hd.position.set(x - 0.24, 2.78, ROAD_Z + 4.4);
        done.add(pl, hd);
      });

      /* URBAN GROUND. Outside the hoarding the world is a building plot, which
         is right for the construction but wrong the moment the project hands
         over — the finished shots were resolving onto bare dirt out to the
         horizon. One large plane, faded in with the rest of the landscape,
         turns the surroundings into city. */
      /* The back city used to crush to pure black once the sun was gone, which
         put a hard cut-out edge behind the landmark instead of depth. A small
         NAVY EMISSIVE gives it a floor it cannot fall below — the value real
         atmosphere puts on a distant building at blue hour — so the skyline
         sits back in the haze and the landmark separates from it. Emissive
         rather than a lighter base colour: this must not brighten when the
         site floods come on, only ever hold its own dim blue. */
      const urbanMat = new THREE.MeshStandardMaterial({
        color: 0x33373d, roughness: 0.84, metalness: 0.08,
        emissive: 0x1a2740, emissiveIntensity: 0.55,
        transparent: true, opacity: 0,
      });
      dispose.push(urbanMat);
      const urban = new THREE.Mesh(new THREE.PlaneGeometry(190, 190).rotateX(-Math.PI / 2), urbanMat);
      urban.position.set(0, 0.004, 0);
      done.add(urban);

      /* A pool of light under every street lamp. Additive quads, not lights —
         eight more point lights would cost a shader recompile and a per-fragment
         loop for something the eye reads as a smudge on the tarmac. */
      const lampPoolMat = new THREE.MeshBasicMaterial({
        map: poolTexS, color: 0xffdcae, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      dispose.push(lampPoolMat);
      /* WIDER AND ELLIPTICAL. A 4.4-unit square gave a tight round disc, which
         is what read as a hard white circle stamped on the asphalt. Real lamp
         throw is an ellipse stretched ALONG the carriageway, and spreading the
         same energy over ~2.4x the area is most of what turns a stamp into a
         pool. 7.6 across the road by 5.2 into it. */
      const lampPool = mkIM(new THREE.PlaneGeometry(7.6, 5.2).rotateX(-Math.PI / 2), lampPoolMat, 8, false, done);
      lampPool.renderOrder = 3;
      const POOLS: [number, number][] = [
        [-16.3, BZ + 1.2], [-9.2, BZ + 1.2], [9.6, BZ + 1.2], [16.7, BZ + 1.2],
        [-13.2, ROAD_Z + 4.4], [-5.7, ROAD_Z + 4.4], [5.3, ROAD_Z + 4.4], [12.8, ROAD_Z + 4.4],
      ];

      /* ROAD TRAFFIC — three lanes and one overtaker, and it CANNOT go wrong.
         The positions are pure functions of the clock and the guarantee that no
         two vehicles ever occupy the same point is arithmetic rather than a
         proximity test: see src/lib/traffic.ts for the argument, and
         traffic.check.ts, which sweeps the clock and asserts it.

         The hero car's lane is left EMPTY. It is the one vehicle whose position
         is authored rather than generated, so rather than police a gap around
         it, nothing else is ever put in front of it. */
      const LANES: Lane[] = lite
        /* TWO LANES ON A PHONE, NOT ONE. A single carriageway of cars all
           sliding the same way does not read as a road, it reads as a
           conveyor — and the phone is where most people meet this scene. The
           second lane uses the same z and speed as its desktop counterpart, so
           the separation the collision check proves for desktop covers this
           set too; only the counts are smaller. */
        ? [
          { z: ROAD_Z + 1.7, dir: -1, speed: 0.85, n: 3, kind: 0 },
          { z: ROAD_Z - 3.0, dir: 1, speed: 0.62, n: 2, kind: 0 },
        ]
        : [
          /* LEFT-HAND TRAFFIC, which is what Kerala drives. Keep left: a car
             heading -x has its left on the +z side, one heading +x has its
             left on -z. Every lane here ran the other way — the whole
             carriageway was right-hand convention, which is why the hero car
             appeared to exit into oncoming traffic. Only the signs changed;
             positions, speeds, counts and the overtaking pair are untouched. */
          { z: ROAD_Z + 1.7, dir: -1, speed: 0.85, n: 4, kind: 0 },   // far side, -x
          { z: ROAD_Z + 3.0, dir: -1, speed: 1.25, n: 3, kind: 1 },   // outside lane, quicker
          { z: ROAD_Z - 3.0, dir: 1, speed: 0.62, n: 3, kind: 0 },    // near side, +x
        ];
      const TRN = LANES.reduce((a, l) => a + l.n, 0);
      /* ONE OVERTAKER, and it cannot hit anything. See the block that drives it
         below for why — the guarantee is in its speed and phase, not in a
         proximity check. Desktop only: on a phone there is a single lane, so
         there is nothing to overtake. */
      const OVT = lite ? 0 : 1;
      const TOTN = TRN + OVT;
      /* THE MOVING FLEET NOW CASTS. Every parked car has cast and received
         shadow since the car park was built; the traffic was flagged `false`,
         so ten vehicles crossed a lit road with nothing under them. That is the
         single thing that reads as "the cars are floating" — a car is joined to
         the road by its shadow, not by its wheels, and no amount of body
         modelling substitutes for the dark patch under the sills.
         Cost is two draws in the shadow pass (an InstancedMesh casts all its
         instances in one), and `mkIM` already gates shadows on `!lite`, so the
         phone is untouched. Wheels stay off: the body's shadow covers the
         contact patch and four more shadow-casting meshes buy nothing. */
      const trafficIM = mkIM(SALOON.body, carMat, TOTN, true, done);
      const trafficEs = mkIM(SUV.body, carMat, TOTN, true, done);
      const trafficGl = mkIM(SALOON.glass, carGlassMat, TOTN, false, done);
      const trafficTail = mkIM(new THREE.BoxGeometry(0.035, 0.04, 0.2), tailMat, TOTN * 2, false, done);
      const trafficHead = mkIM(new THREE.BoxGeometry(0.03, 0.035, 0.22), headMatC, TOTN * 2, false, done);
      /* LIGHT SPILL ON THE ROAD. The lamps are emissive lenses — they read as
         lit, but they put nothing on the tarmac, so at blue hour the traffic
         floated on a dark road. One additive quad per car, ahead of it in its
         own heading, reusing the same soft-dot texture the street lamps use.
         Very low alpha: the asphalt is a damp dielectric now and returns its
         own reflection from the environment, so this only has to add the
         direct throw, not carry the whole effect. Instanced, so the entire
         fleet's spill is a single draw call. */
      const carPoolMat = new THREE.MeshBasicMaterial({
        map: poolTexS, color: 0xffd9a4, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      dispose.push(carPoolMat);
      /* THE TRAFFIC HAD NO WHEELS. `place()` writes four per parked car, but
         `putCar()` — which draws everything on the road — never did, so every
         moving vehicle was a body hovering over dark arches. Four per car, and
         they ROLL: the spin is geared off the car's own x position, so it is
         distance-based like the hero car's and can never skid. */
      const trafficTyre = mkIM(tyreGeo, tyreMat, TOTN * 4, false, done);
      const trafficRim = mkIM(rimGeo, rimMat, TOTN * 4, false, done);
      const carPool = mkIM(new THREE.PlaneGeometry(2.0, 3.2).rotateX(-Math.PI / 2), carPoolMat, TOTN, false, done);
      carPool.renderOrder = 3;
      /* ONE FLEET PER DIRECTION.
         The palette used to be a single list indexed by the raw instance
         number, so a colour landed wherever the counting happened to put it
         and the two directions were made of the same cars in the same paints.
         Now each carriageway has its OWN set — deep navy, off-white and
         graphite running one way; silver, white and crimson the other — and
         the body type is chosen per flow as well, so a glance at the road
         tells you which way a vehicle is going before you have watched it
         move. Built by walking the lane table in exactly the order the draw
         loop below walks it, which is what keeps index i pointing at the same
         car in both places. */
      /* COLOUR AND BODY TOGETHER, because "a white SUV" is one decision, not
         two that happen to land on the same car. Each flow gets three
         archetypes and they are cycled in order down the lane. */
      const FLEET = {
        // right-to-left
        '-1': [
          { hex: 0xe9ecef, es: true },    // white SUV
          { hex: 0x7d1219, es: false },   // deep red sedan
          { hex: 0x2f3742, es: false },   // graphite sedan
        ],
        // left-to-right
        '1': [
          { hex: 0xc9a227, es: true },    // gold SUV
          { hex: 0xb9bec4, es: false },   // silver sedan
          { hex: 0x14171c, es: false },   // near-black sedan
        ],
      } as const;
      /** Colour and body type for traffic instance `i`, in draw order. */
      const fleet: { hex: number; es: boolean }[] = [];
      LANES.forEach((L, li) => {
        for (let j = 0; j < L.n; j++) {
          const pal = FLEET[L.dir > 0 ? '1' : '-1'];
          fleet.push(pal[(j + li) % pal.length]);
        }
      });
      // The overtaker rides the far carriageway, so it takes that fleet.
      if (OVT) fleet.push(FLEET['-1'][2]);
      [trafficIM, trafficEs].forEach((im) => {
        for (let i = 0; i < TOTN; i++) im.setColorAt(i, col.setHex(fleet[i].hex));
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      });

      /* ---- GLB UPGRADE, IN PLACE ------------------------------------------
         The procedural fleet above is the FALLBACK. If real models are present
         under /models/ they replace it here — and the only thing that changes
         is the geometry and material hanging off instanced meshes that already
         exist. Not one line of the per-frame placement code below knows or
         cares which fleet it is drawing, which is the whole reason the swap is
         eight lines instead of a rewrite.

         ALL THREE OR NONE. A photoreal sedan parked next to an extruded estate
         reads worse than either fleet on its own, so a missing model keeps the
         whole set procedural rather than mixing them.

         Fire-and-forget: the hero is already on screen and interactive before
         this resolves, and a rejected promise cannot reach here — loadModel
         resolves null for the (currently normal) case of no file at all. */
      void Promise.all([loadModel('sedan'), loadModel('suv'), loadModel('van')])
        .then(([sedan, suv, vanM]) => {
          if (!sedan || !suv || !vanM) return;
          const swap = (im: THREE.InstancedMesh, geo: THREE.BufferGeometry, mats: THREE.Material[]) => {
            im.geometry.dispose();
            im.geometry = geo;
            setMats(im, mats);
          };
          // Bodies: parked and traffic share one geometry per kind.
          swap(carIM, sedan.body, sedan.materials);
          swap(carIM2, suv.body, suv.materials);
          swap(carIM3, vanM.body, vanM.materials);
          swap(trafficIM, sedan.body.clone(), sedan.materials);
          swap(trafficEs, suv.body.clone(), suv.materials);
          // Glazing keeps the SCENE's glass material, not the model's — the
          // windows have to mirror this dusk sky and this lit facade to sit in
          // the frame, and a model ships with whatever its author's HDRI gave it.
          const glassOf = (m: typeof sedan) => m.glass ?? EMPTY_GEO();
          swap(glassIM1, glassOf(sedan), []);
          swap(glassIM2, glassOf(suv), []);
          swap(glassIM3, glassOf(vanM), []);
          swap(trafficGl, sedan.glass ? sedan.glass.clone() : EMPTY_GEO(), []);
          /* The model brings its own wheels, so the procedural tyres, rims and
             wheel-well tub have to go. Collapsing their geometry is how: every
             placement loop keeps writing their matrices harmlessly, and nothing
             downstream needs a new branch. */
          [tyreIM, rimIM].forEach((im) => {
            im.geometry.dispose();
            im.geometry = EMPTY_GEO();
          });
          /* The shadow map is only redrawn when the playhead moves, so a fleet
             that changed shape while the page sat still would keep casting the
             old fleet's shadows until the next scroll. */
          renderer.shadowMap.needsUpdate = true;
        });

      /* PEOPLE on the footway. Same trick as the site crews: a figure at true
         height is the cheapest scale reference there is, and an empty pavement
         is what makes a street read as a model. */
      /* Pedestrians had the same problem as the crew: one dark value for the
         whole person, head included, so they read as cut-outs against a dark
         road. Two groups now — clothing and skin — which is the minimum that
         makes a figure look like a person rather than a shadow. Lighter than
         the crew's trousers because these are people in ordinary clothes, not
         site uniform, and the same small emissive floor keeps them off black. */
      const walkerMat = new THREE.MeshStandardMaterial({
        color: 0x6d737f, roughness: 0.86, envMapIntensity: 1.3,
        emissive: 0x6d737f, emissiveIntensity: 0.12,
        transparent: true, opacity: 0,
      });
      const walkSkinMat = new THREE.MeshStandardMaterial({
        color: 0xb98a68, roughness: 0.72, envMapIntensity: 1.35,
        emissive: 0xb98a68, emissiveIntensity: 0.1,
        transparent: true, opacity: 0,
      });
      dispose.push(walkSkinMat);
      dispose.push(walkerMat);
      /* Same figure as the site crew, minus the hard hat — these are people
         walking past on the footway, not workers, and one uniform dark material
         is all a pedestrian at this distance needs. Merged into a single
         geometry because there is nothing here to colour separately. */
      const WALK_FIG = figureParts();
      const walkerGeo = mergeGeometries([WALK_FIG.legs, WALK_FIG.torso], false)!;
      const walkSkinGeo = WALK_FIG.skin;
      WALK_FIG.helmet.dispose();          // pedestrians, not workers
      /* Four, not six. The near footway is 2.0 deep (5.6 m) and the camera only
         ever sees ~40 units of its length; six figures on that read as a queue.
         Four is the "normal city pavement" count the brief asks for. */
      const WKN = lite ? 3 : 4;
      /* THE FOOTWAY, MEASURED — not eyeballed. The paving plane is 2.0 deep
         centred on ROAD_Z - 5.9, so it spans z 7.6..9.6, and its walking
         surface sits at y 0.016. The pedestrians were being placed at
         ROAD_Z - 4.6 (z 9.5..10.3) at y 0 — which is ON the kerb line and out
         into the strip between the kerb and the carriageway, at road level
         rather than on the raised path. Feet on the pavement, on the pavement's
         own surface, with the jitter kept inside its width. */
      const WALK_Z = ROAD_Z - 5.9, WALK_Y = 0.016, WALK_HALF = 0.55;
      const walkerIM = mkIM(walkerGeo, walkerMat, WKN, false, done);
      const walkSkinIM = mkIM(walkSkinGeo, walkSkinMat, WKN, false, done);
      /* The same model as the site crew — memoised in loadModel, so this does
         not fetch it twice. It keeps its hi-vis here, which is wrong for a
         passer-by but right for the only model this project defines a slot for;
         give pedestrians their own slot if that ever grates. */
      void loadModel('worker').then((w) => {
        if (!w) return;
        walkerIM.geometry.dispose();
        walkerIM.geometry = w.body.clone();
        setMats(walkerIM, w.materials);
        walkSkinIM.geometry.dispose();
        walkSkinIM.geometry = EMPTY_GEO();
      });

      tick.push((t, dt, o) => {
        const k = ease(span(P.site[0] - 0.05, P.site[1], t));
        done.visible = k > 0.01;
        if (!done.visible) return;
        urbanMat.opacity = k * 0.96;
        walkerMat.opacity = walkSkinMat.opacity = k;
        // 0.32 -> 0.17: additive over a now semi-wet road, which returns its
        // own reflection, so the quad no longer has to carry the whole effect.
        lampPoolMat.opacity = 0.17 * k;
        carPoolMat.opacity = 0.13 * k;
        POOLS.forEach((q, i) => {
          dummy.position.set(q[0], 0.025, q[1]);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(s0(k));
          put(lampPool, i);
        });
        lampPool.instanceMatrix.needsUpdate = true;
        /* Scroll IS the clock. Both acts advance it, so traffic and pedestrians
           keep moving through the whole ending and run backwards on the way up. */
        const clk = t * 26 + o * 30;
        /* One vehicle written from a position and a heading — body, glazing,
           wheel tub and four lamps. Shared by the lane cars and the overtaker,
           so the one that changes lanes cannot drift out of step with the ones
           that do not. */
        const putCar = (ti: number, x: number, z: number, rot: number, isEs: boolean) => {
          dummy.position.set(x, 0, z);
          dummy.rotation.set(0, rot, 0);
          grow(isEs ? 0 : k, 1, 1, 1); put(trafficIM, ti);
          grow(isEs ? k : 0, 1, 1, 1); put(trafficEs, ti);
          grow(isEs ? 0 : k, 1, 1, 1); put(trafficGl, ti);
          const c = Math.cos(rot), sn = Math.sin(rot);
          // Four wheels, in the car's own frame, rolling off distance travelled.
          const gw = isEs ? SUV : SALOON;
          const spin = -x / gw.wheelR;
          for (let w = 0; w < 4; w++) {
            const lx = w < 2 ? gw.axle : -gw.axle;
            const lz = w % 2 ? gw.track : -gw.track;
            dummy.position.set(x + c * lx - sn * lz, gw.wheelR, z - sn * lx - c * lz);
            dummy.rotation.set(0, rot, spin);
            grow(k, 1, 1, 1);
            put(trafficTyre, ti * 4 + w);
            put(trafficRim, ti * 4 + w);
          }
          // The throw, 1.9 units up the road in the car's own heading.
          dummy.position.set(x + c * 1.9, 0.028, z - sn * 1.9);
          dummy.rotation.set(0, rot, 0);
          grow(k, 1, 1, 1);
          put(carPool, ti);
          for (let l = 0; l < 2; l++) {
            const across = l ? 0.24 : -0.24;
            // Tail lamps behind, heads in front — both in the car's own frame.
            dummy.position.set(x + c * -0.79 - sn * across, 0.315, z - sn * -0.79 - c * across);
            dummy.rotation.set(0, rot, 0);
            grow(k, 1, 1, 1);
            put(trafficTail, ti * 2 + l);
            dummy.position.set(x + c * 0.79 - sn * across, 0.315, z - sn * 0.79 - c * across);
            dummy.rotation.set(0, rot, 0);
            grow(k, 1, 1, 1);
            put(trafficHead, ti * 2 + l);
          }
        };

        let ti = 0;
        LANES.forEach((L) => {
          for (let j = 0; j < L.n; j++, ti++) {
            // dir +1 travels toward +x, and the body's nose is +x at rot 0.
            putCar(ti, laneX(L, j, clk), L.z, L.dir > 0 ? 0 : Math.PI, fleet[ti].es);
          }
        });

        /* ---- THE OVERTAKER ---------------------------------------------------
           A car that pulls out, passes the slow lane and tucks back in — WITHOUT
           a traffic simulation, without a proximity test, and without any state
           carried between frames. State would be the end of reverse scrubbing:
           every other value in this file is a pure function of the scroll, so
           dragging back up runs the street backwards, and an integrated car
           position would smear instead.

           The guarantee is arithmetic, in two halves:

           FAST LANE — it travels at EXACTLY lane 1's speed. Same speed means its
           offset from every lane-1 car is a constant for all time, and PHASE is
           set to half of lane 1's headway, so it sits permanently in the middle
           of a 50-unit gap. It can move into that lane at any moment, for any
           duration, and the clearance is 25 units at both ends. Always.

           SLOW LANE — it is 0.40/unit quicker than lane 0, so it repeatedly
           catches lane-0 cars: that closing IS the overtake. `d` is its signed
           offset within lane 0's repeating pattern, so d = 0 means exactly
           alongside a slow car, and d runs continuously to ±H0/2. The lateral
           blend is a bump on |d|: fully in lane 1 within 6 units of a slow car,
           fully back in lane 0 beyond 14. It is therefore ALREADY OUT of the
           lane before it is within 6 units of anything, and the only place `d`
           jumps is ±H0/2 — the midpoint between two slow cars, where the blend
           has been flat at zero for four units either side. Continuous.

           Between the lanes it is 0.65 off each centreline against a 0.31
           half-width, so the transit itself is clear too. */
        if (OVT) {
          const ov = overtaker(LANES[0], LANES[1], clk);
          putCar(ti, ov.x, ov.z, ov.yaw, fleet[ti].es);
          ti++;
        }
        trafficIM.instanceMatrix.needsUpdate = true;
        trafficEs.instanceMatrix.needsUpdate = true;
        trafficGl.instanceMatrix.needsUpdate = true;
        trafficTail.instanceMatrix.needsUpdate = true;
        trafficHead.instanceMatrix.needsUpdate = true;
        carPool.instanceMatrix.needsUpdate = true;
        trafficTyre.instanceMatrix.needsUpdate = true;
        trafficRim.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < WKN; i++) {
          const dir = i % 2 ? 1 : -1;
          /* Evenly spaced along the wrap by index rather than by a random
             offset: at four figures a random x lets two land on top of each
             other, which is the one thing a pavement crowd must never do. */
          const lane = Math.floor(i / 2), perDir = Math.ceil(WKN / 2);
          const base = (lane / perDir) * 40 + rnd(i, 241) * 4;
          const x = (((clk * 0.16 * dir + base) % 40) + 40) % 40 - 20;
          // Across the path, never past its edge — and standing ON it.
          dummy.position.set(x, WALK_Y, WALK_Z + (rnd(i, 251) - 0.5) * 2 * WALK_HALF);
          dummy.rotation.set(0, dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
          grow(k, 1, 1, 1);
          put(walkerIM, i);
          put(walkSkinIM, i);
        }
        walkerIM.instanceMatrix.needsUpdate = true;
        walkSkinIM.instanceMatrix.needsUpdate = true;
        void dt;
        const solid = k > 0.995;
        [pavMat, tarMat, wallMat, capMat, hedgeMat, lawnMat, poleMat, headMat, roadMat, kerbMat,
          trunkMat, leafMat, markMat].forEach((m) => {
          m.opacity = k;
          // Once opaque, LEAVE the transparent pass — these are ground planes
          // and solid objects, and a sorted transparent plaza drops whatever
          // stands on it.
          if (m.transparent === solid) { m.transparent = !solid; m.needsUpdate = true; }
        });
        railIM.visible = railTop.visible = k > 0.5;
        gate.visible = guard.visible = k > 0.4;

        for (let i = 0; i < railN; i++) {
          const rx = -BX + 0.3 + (i / railN) * (BX * 2 - 0.6);
          dummy.position.set(rx, 0.4, BZ);
          dummy.rotation.set(0, 0, 0);
          // Nothing stands in the vehicle entrance.
          grow(Math.abs(rx - DRIVE_X) < GAP ? 0 : 1, 1, 1, 1);
          put(railIM, i);
        }
        railIM.instanceMatrix.needsUpdate = true;

        slots.forEach((s, i) => {
          const kk = outCubic(stagger(t, P.site[0], P.site[1] - 0.04, i, slots.length, 3));
          dummy.position.set(s.x, 0.03, s.z - BAY_W / 2);
          dummy.rotation.set(0, s.rot, 0);
          grow(kk, kk, 1, 1);
          put(markIM, i);
        });
        [0, 1].forEach((i) => {
          const kk = ease(span(P.site[0], P.site[1] - 0.04, t));
          dummy.position.set(BW / 2 + 2.7, 0.03, (i ? -3.5 + 8 * BAY_W : -3.5) - BAY_W / 2);
          dummy.rotation.set(0, 0, 0);
          grow(kk, kk, 1, 1);
          put(markIM, slots.length + i);
        });
        markIM.instanceMatrix.needsUpdate = true;

        /* Cars arrive one after another as the property comes into use, rolling
           the last few metres into the bay rather than materialising in it.
           `place` writes a whole vehicle — body, glazing, four wheels with their
           rims, lamps — from one position and heading, which is what keeps the
           parked cars and the moving hero car sharing exactly one code path. */
        const place = (i: number, x: number, z: number, rot: number, on: number, spin: number, head: number) => {
          const g = kindOf(i);
          const set = g === VAN ? bodySets[2] : g === SUV ? bodySets[1] : bodySets[0];
          const c = Math.cos(rot), sn = Math.sin(rot);
          // Local (along, across) -> world, once, for every part of the car.
          const at = (along: number, across: number) => dummy.position.set(x + c * along - sn * across, 0, z - sn * along - c * across);
          at(0, 0);
          dummy.rotation.set(0, rot, 0);
          grow(on, 1, 1, 1);
          bodySets.forEach((b) => {
            // Only the set this car belongs to gets a real matrix; the other two
            // collapse, so one bay never shows two bodies stacked.
            const mine = b === set ? on : 0;
            grow(mine, 1, 1, 1);
            put(b.im, i); put(b.gl, i);
          });
          for (let w = 0; w < 4; w++) {
            const lx = w < 2 ? g.axle : -g.axle, lz = w % 2 ? g.track : -g.track;
            at(lx, lz);
            dummy.position.y = g.wheelR;
            /* Euler XYZ composes as Ry(yaw) * Rz(spin), so `z` spins the wheel
               about its own axle AFTER the car's heading is applied — which is
               why the tyres roll instead of skidding sideways. */
            dummy.rotation.set(0, rot, spin);
            grow(on, 1, 1, 1);
            put(tyreIM, i * 4 + w); put(rimIM, i * 4 + w);
          }
          for (let l = 0; l < 2; l++) {
            const lz = l ? 0.24 : -0.24;
            at(-g.lampX, lz);
            dummy.position.y = g.lampY;
            dummy.rotation.set(0, rot, 0);
            grow(on, 1, 1, 1);
            put(tailIM, i * 2 + l);
            at(g.lampX, lz);
            dummy.position.y = g.lampY;
            dummy.rotation.set(0, rot, 0);
            grow(head, 1, 1, 1);
            put(headIM, i * 2 + l);
          }
        };

        for (let i = 0; i < CARN - 1; i++) {
          const sl = parkedAt[i];
          const a = outCubic(stagger(t, P.cars[0], P.cars[1], i, CARN, 2.6));
          const on = a > 0.02 ? 1 : 0;
          const roll = (1 - a) * 1.9;
          const g = kindOf(i);
          place(i, sl.x + Math.cos(sl.rot) * roll, sl.z - Math.sin(sl.rot) * roll, sl.rot, on, -roll / g.wheelR, 0);
        }
        // The hero car is placed by the outro ticker, which owns its path.
        rig.place = place;
        rig.heroIdx = CARN - 1;
        rig.heroKind = kindOf(CARN - 1);
        bodySets.forEach((b) => { b.im.instanceMatrix.needsUpdate = true; b.gl.instanceMatrix.needsUpdate = true; });
        tyreIM.instanceMatrix.needsUpdate = true;
        rimIM.instanceMatrix.needsUpdate = true;
        tailIM.instanceMatrix.needsUpdate = true;
        headIM.instanceMatrix.needsUpdate = true;
        [carMat, carGlassMat, tyreMat, rimMat].forEach((m) => {
          m.opacity = k;
          if (m.transparent === solid) { m.transparent = !solid; m.needsUpdate = true; }
        });
        tailMat.opacity = ease(span(P.cars[0] + 0.04, 1.0, t)) * 0.85;

        TREES.forEach((tr, i) => {
          const g = outCubic(stagger(t, P.site[0] - 0.02, 1.0, i, TREES.length, 3)) * tr.s;
          dummy.position.set(tr.x, 0, tr.z);
          dummy.rotation.set(0, i * 1.13, 0);
          /* Trunk thickness now scales WITH the tree. It used to be pinned at
             x/z scale 1 while only the height took `g`, so a 8 m tree and a
             4 m tree had identical trunks and the big ones read as saplings
             stretched on a photocopier. */
          if (treeGLB) grow(g, g, g, g); else grow(g, g, g * 2.1, g);
          put(trunkIM, i);
          for (let l = 0; l < LOBES; l++) {
            /* Every cluster gets its own reach, height and size off the shared
               deterministic `rnd`, so the canopy is irregular but still a pure
               function of the tree index — it cannot shimmer between frames or
               differ on a re-mount. */
            const seed = i * 8 + l;
            const a = (l / LOBES) * Math.PI * 2 + i * 1.7 + rnd(seed, 131) * 0.9;
            const reach = 0.20 + rnd(seed, 137) * 0.34;
            const lift = 1.58 + rnd(seed, 139) * 0.92;
            const size = 0.38 + rnd(seed, 149) * 0.32;
            dummy.position.set(
              tr.x + Math.cos(a) * g * reach,
              g * lift,
              tr.z + Math.sin(a) * g * reach,
            );
            dummy.rotation.set(l * 0.7 + rnd(seed, 151), i * 1.7 + l, l * 0.4);
            const ls = g * size;
            // Slightly flattened: a canopy spreads wider than it is tall.
            grow(g, ls, ls * 0.84, ls * 0.96);
            put(leafIM, i * LOBES + l);
          }
        });
        trunkIM.instanceMatrix.needsUpdate = true;
        leafIM.instanceMatrix.needsUpdate = true;

        for (let i = 0; i < 14; i++) {
          const x = -BX + 0.9 + (i / 14) * (BX * 2 - 1.8);
          const clear = Math.abs(x - DRIVE_X) < 2.0 ? 0 : 1;
          dummy.position.set(x, 0, BZ - 1.35);
          dummy.rotation.set(0, 0, 0);
          grow(k * clear, 1.5 * k * clear, k, 1);
          put(hedgeIM, i);
        }
        hedgeIM.instanceMatrix.needsUpdate = true;

        for (let i = 0; i < 8; i++) {
          const kk = outCubic(stagger(t, P.site[0], 1.0, i, 8, 2));
          dummy.position.set(-3.1, 0, BD / 2 + 1.4 + i * 0.9);
          dummy.rotation.set(0, 0, 0);
          grow(kk, 1, kk, 1);
          put(bollardIM, i);
        }
        bollardIM.instanceMatrix.needsUpdate = true;
      });
    }

    /* ======================================================================
       ACT TWO — THE GATE, THE HERO CAR, THE ROAD.
       One continuous shot with no cut in it. The stats settle over the finished
       property, the gate lights come up, the leaves swing, the hero car's lamps
       come on and it drives out under its own steam, and the camera goes with
       it. Every value below is a pure function of `o`, which IS the scroll — so
       scrolling back up shuts the gate, reverses the car down the drive and puts
       it back on the drop-off, wheels turning the other way.
       ====================================================================== */
    {
      /* The route out. A real vehicle path: sit on the drop-off, swing onto the
         drive, run straight through the gate opening at DRIVE_X, cross the
         footway, turn onto the near carriageway lane and go. Arc-length
         parameterised, so `getPointAt(u)` moves at a constant rate along the
         road and the wheels can be geared off distance rather than off u. */
      /* THE EXIT ROUTE LIVES IN `lib/exit.ts`, NOT HERE — and that is the point.
         It used to turn LEFT out of the gate and run +x, which is screen-RIGHT
         from every hero key: the correct side for its direction under
         left-hand convention, and the wrong direction for the shot, which is
         meant to read "the car leaves and goes". It now turns RIGHT, crosses
         the oncoming +x lane and settles on the leftward carriageway heading
         -x — screen-LEFT — merging with the traffic already running that way.

         That crossing is a car cutting through a live lane, so it is PROVEN
         rather than eyeballed: `exit.check.ts` sweeps the whole outro against
         the same `laneX` the road is drawn from and asserts the envelope is
         never breached (4.73 units of clearance against a 2.1 envelope, in a
         crossing that lasts 3% of the drive). It imports the same module this
         line does, so there is no second copy of the route to drift out of
         step. */
      const PATH = exitCurve();
      const PATH_LEN = PATH.getLength();
      const _cp = new THREE.Vector3(), _ct = new THREE.Vector3();

      /* Headlamps. ONE spotlight, no shadow — it is the only thing in the scene
         that has to actually throw light onto the road, and a second one buys
         nothing at this distance. Desktop only; the phone gets the emissive
         lenses and the ground pool, which carry the read on their own. */
      const beam = lite ? null : new THREE.SpotLight(0xfff0d2, 0, 26, 0.42, 0.6, 1.3);
      if (beam) { world.add(beam, beam.target); }
      /* The pool of light the lamps put on the tarmac ahead of the car. An
         additive quad, not a light — it costs nothing and it is what actually
         reads at this scale. */
      const poolTex = softDot(64);
      texs.push(poolTex);
      const poolMat = new THREE.MeshBasicMaterial({
        map: poolTex, color: 0xffd9a4, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      dispose.push(poolMat);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 8.0).rotateX(-Math.PI / 2), poolMat);
      pool.renderOrder = 5;
      world.add(pool);

      tick.push((t, dt, o) => {
        const live = t > 0.985 && o > 0.001;
        pool.visible = live;
        if (beam) beam.intensity = 0;
        if (rig.light) rig.light.intensity = 0;

        // Gate lights first, then the leaves — a gate announces itself before it
        // moves. Both are eased, so the swing has weight at each end.
        const lampK = ease(span(0.16, 0.30, o));
        const openK = ease(span(0.24, 0.48, o));
        if (rig.lampMat) rig.lampMat.opacity = lampK;
        if (rig.light) rig.light.intensity = 16 * lampK;
        // 82° — far enough back against the piers to leave the opening clear.
        if (rig.hinge1) rig.hinge1.rotation.y = -openK * 1.43;
        if (rig.hinge2) rig.hinge2.rotation.y = Math.PI + openK * 1.43;

        if (!live || !rig.place) return;

        const lampsOn = ease(span(0.34, 0.44, o));
        // Gentle acceleration, unchanged — the easing lives with the route now.
        const u = exitU(o);
        PATH.getPointAt(u, _cp);
        PATH.getTangentAt(u, _ct);
        const rot = Math.atan2(-_ct.z, _ct.x);
        const kind = rig.heroKind;
        // Wheels are geared off DISTANCE TRAVELLED, so they can never skid.
        const spin = -(PATH_LEN * u) / kind.wheelR;
        rig.place(rig.heroIdx, _cp.x, _cp.z, rot, 1, spin, lampsOn > 0.02 ? 1 : 0);
        heroPos.set(_cp.x, 0, _cp.z);
        heroDir.set(_ct.x, 0, _ct.z).normalize();

        poolMat.opacity = 0.5 * lampsOn;
        pool.position.set(_cp.x + heroDir.x * 3.4, 0.03, _cp.z + heroDir.z * 3.4);
        pool.rotation.y = rot;
        if (beam) {
          beam.intensity = 42 * lampsOn;
          beam.position.set(_cp.x + heroDir.x * 0.8, 0.36, _cp.z + heroDir.z * 0.8);
          beam.target.position.set(_cp.x + heroDir.x * 9, 0.05, _cp.z + heroDir.z * 9);
          beam.target.updateMatrixWorld();
        }
        void dt;
      });
    }

    /* ======================================================================
       CITY — THREE DEPTH LAYERS.
       A near street wall of mid-rise, a mid band, and a far band, each one
       deeper into the fog than the last. That gradient IS the atmospheric
       perspective; a single ring of near-black slabs reads as a backdrop flat,
       which is the thing the brief calls out. Laid out along STREETS, not on a
       ring — a ring of towers around a plot is the clearest tell of a
       procedural backdrop.
       ====================================================================== */
    {
      const fac = facadeTexture(lite ? 128 : 256);
      texs.push(fac.map, fac.emissive);
      fac.map.repeat.set(3, 6);
      fac.emissive.repeat.set(3, 6);
      /* Deliberately DESATURATED and mid-toned, not black. A silhouette that
         dark against a lit sky is what made the neighbours read as cardboard. */
      /* SECONDARY BY VALUE, not by distance alone. The neighbours were lit at
         1.1 in the same warm white as the hero building's own interiors, so a
         tower two streets back read at the same brightness as the facade the
         shot is about. Down a third on the windows and a shade darker on the
         stone: still a real, lit city — just clearly the background of one. */
      const cityMat = new THREE.MeshStandardMaterial({
        map: fac.map, emissiveMap: fac.emissive, emissive: 0xffe6c8, emissiveIntensity: 0.72,
        color: 0x5c6374, roughness: 0.62, metalness: 0.15, envMapIntensity: 0.42,
      });
      dispose.push(cityMat);

      type Blk = { x: number; z: number; w: number; d: number; h: number; r: number };
      const blocks: Blk[] = [];
      const push = (x: number, z: number, i: number, hMin: number, hMax: number) => {
        blocks.push({
          x, z, r: (rnd(i, 137) - 0.5) * 0.14,
          w: 3.4 + rnd(i, 139) * 3.6, d: 3.0 + rnd(i, 149) * 3.4,
          h: hMin + rnd(i, 151) * (hMax - hMin),
        });
      };
      /* Opposite side of the street. Set BACK behind a wide boulevard, because
         portrait needs the camera ~28 units out to fit a 22 m frontage in a 0.46
         aspect frame — and at the old set-out that put the far-side street wall
         BETWEEN the lens and the building, so the phone's hero shot was a city
         block with the landmark hidden behind it. */
      /* Hard up behind the far-side boundary wall, the way a street frontage
         actually sits — EXCEPT across the corridor the outro camera flies down,
         which is set back by a block depth. The camera ends the film at
         z ≈ 26 on the far side of the carriageway, and a frontage at its
         natural depth put a building squarely around the lens: the last frame
         was a black wall with lit windows floating in it. Set back, the gap
         reads as a forecourt opposite and the camera has somewhere to be. */
      for (let i = 0; i < 11; i++) {
        const bx = -38 + i * 7.4 + rnd(i, 157) * 1.4;
        const clearCam = bx > -2 && bx < 30 ? 17 : 0;
        push(bx, ROAD_Z + 11.5 + clearCam + rnd(i, 163) * 5, i, 5, 13);
      }
      /* ---- THE STREET THE ROAD ACTUALLY RUNS THROUGH ----------------------
         The car exit was playing against darkness, and the reason is a camera
         fact rather than a missing-model one: through the outro the lens sits
         at z ~20 and looks toward z ~6-9, so everything that fills the frame
         behind the carriageway is at z < 9. The existing far-side street wall
         lives at z 26-43 — BEHIND the camera for that whole shot. It was never
         going to be seen there.
         So the frontage that matters is the near side, beyond the plot, along
         the same street Alipson fronts. Row one is the street wall proper
         (shops and low blocks, z ~0-6, set back clear of the footway at 7.6);
         row two sits further in at z ~-6 and runs taller, so there is a second
         plane behind the first and the gap reads as depth rather than a flat.
         They go through the same `push()` as every other block, which is what
         keeps them secondary BY CONSTRUCTION: same instanced draw call, same
         desaturated mid-tone, same facade texture and lit-window map, same
         atmospheric falloff. They cannot out-compete the hero building because
         they are made of the same material. */
      ([-1, 1] as const).forEach((side, si) => {
        for (let i = 0; i < 5; i++) {            // street wall, low and close
          const x = side * (13.5 + i * 7.2 + rnd(i + si * 9, 211) * 2.2);
          push(x, 2.6 + rnd(i + si * 9, 223) * 2.4, 100 + i + si * 9, 3.2, 8.0);
        }
        for (let i = 0; i < 5; i++) {            // second plane, taller
          const x = side * (16.0 + i * 7.6 + rnd(i + si * 9, 227) * 2.4);
          push(x, -6.5 - rnd(i + si * 9, 229) * 3.5, 140 + i + si * 9, 6.0, 14.0);
        }
      });

      /* Behind the site. TWO OF THESE EIGHT ARE SKIPPED and rebuilt below as a
         hospital and a shopping mall — the brief's "replace the generic blocks
         with believable buildings", done literally: same band, same set-out,
         same depth into the haze, so nothing about the skyline's rhythm moves.
         Indices 2 and 5 are the ones the camera arc reads most squarely. */
      const NAMED = new Set([2, 5]);
      for (let i = 0; i < 8; i++) {
        if (NAMED.has(i)) continue;
        push(-30 + i * 8.2, -BZ - 15 - rnd(i, 167) * 5, i + 20, 5, 11);
      }
      // Mid band.
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + 0.3;
        const r = 54 + rnd(i, 173) * 18;
        push(Math.cos(a) * r, Math.sin(a) * r, i + 40, 7, 17);
      }
      // Far band — mostly haze by the time it reaches the lens.
      for (let i = 0; i < (lite ? 12 : 22); i++) {
        const a = (i / 22) * Math.PI * 2 + 1.1;
        const r = 94 + rnd(i, 179) * 50;
        push(Math.cos(a) * r, Math.sin(a) * r, i + 70, 12, 30);
      }
      const cityIM = mkIM(fromBase(new THREE.BoxGeometry(1, 1, 1), 1), cityMat, blocks.length, false);
      blocks.forEach((b, i) => {
        dummy.position.set(b.x, 0, b.z);
        dummy.rotation.set(0, b.r, 0);
        dummy.scale.set(b.w, b.h, b.d);
        put(cityIM, i);
      });
      cityIM.instanceMatrix.needsUpdate = true;

      /* PODIUMS — massing variety, not labels.
         The blocks already vary in height, footprint and rotation, but every
         one of them was a plain extruded box, and a street of plain boxes reads
         as procedural however much you jitter the dimensions. What actually
         distinguishes a hospital, a school, a hotel or a civic hall from an
         office slab at this distance is MASSING: a wide low base with a
         narrower mass rising out of it. That is one extra box per building.
         Near bands only — the first 19 blocks are the ones the camera reads as
         architecture; the mid and far bands are silhouette and haze, where a
         podium is a triangle nobody resolves and 30 more instances for nothing.
         About 55% get one, so the street still has plain slabs among them. */
      const pods: Blk[] = [];
      blocks.forEach((b, i) => {
        if (i >= 19 || rnd(i, 181) < 0.45) return;
        pods.push({
          x: b.x, z: b.z, r: b.r,
          w: b.w * (1.26 + rnd(i, 191) * 0.18),
          d: b.d * (1.22 + rnd(i, 193) * 0.16),
          h: b.h * (0.20 + rnd(i, 197) * 0.15),
        });
      });
      /* ---- TWO TYPED NEIGHBOURS -------------------------------------------
         A hospital and a shopping mall, told entirely through MASSING and
         glazing — no signage, no text, nothing readable. At this distance that
         is the only channel that survives anyway, and it is how you actually
         recognise these two building types from across a city:

           HOSPITAL   a long ward slab on a wide low entrance podium, with a
                      taller stair/lift core breaking the roofline. Deep window
                      grid, small punched openings, warm rooms behind them.
           MALL       low, wide and horizontal — three trading floors, not
                      storeys of offices — with a tall continuous glazed
                      frontage and a projecting entrance box.

         Built from the same `cityMat` as every other block, so they take the
         identical facade texture, lit-window emissive map and atmospheric
         falloff, and can never separate from the skyline they belong to. */
      const bgGlassMat = new THREE.MeshStandardMaterial({
        color: 0x2a3446, roughness: 0.22, metalness: 0.5,
        // Warm rooms behind the glass, dim enough to stay background.
        emissive: 0xffcf9a, emissiveIntensity: 0.34, envMapIntensity: 0.7,
      });
      dispose.push(bgGlassMat);
      const box = (w: number, h: number, d: number, x: number, y: number, z: number,
                   mat: THREE.Material, parent: THREE.Object3D) => {
        const m = new THREE.Mesh(fromBase(new THREE.BoxGeometry(w, h, d), h), mat);
        m.position.set(x, y, z);
        parent.add(m);
        return m;
      };

      // HOSPITAL — index 2's slot.
      {
        const g = new THREE.Group();
        g.position.set(-30 + 2 * 8.2, 0, -BZ - 15 - rnd(2, 167) * 5);
        g.rotation.y = -0.12;
        box(13.5, 8.4, 5.2, 0, 0, 0, cityMat, g);          // ward slab
        box(17.0, 2.6, 8.4, 0, 0, 3.4, cityMat, g);        // entrance podium
        box(3.6, 11.2, 4.0, -5.4, 0, 0.4, cityMat, g);     // stair / lift core
        box(11.0, 1.5, 0.35, 0, 0.7, 7.7, bgGlassMat, g);  // podium glazing band
        box(4.4, 0.45, 2.2, 0, 2.6, 6.6, cityMat, g);      // porte-cochere canopy
        world.add(g);
      }

      // SHOPPING MALL — index 5's slot.
      {
        const g = new THREE.Group();
        g.position.set(-30 + 5 * 8.2, 0, -BZ - 15 - rnd(5, 167) * 5);
        g.rotation.y = 0.16;
        box(19.0, 5.0, 11.0, 0, 0, 0, cityMat, g);         // trading floors, low and wide
        box(16.5, 3.9, 0.4, 0, 0.5, 5.7, bgGlassMat, g);   // full-height glazed frontage
        box(5.2, 6.2, 2.6, -2.0, 0, 6.2, cityMat, g);      // projecting entrance box
        box(4.2, 4.4, 0.3, -2.0, 0.6, 7.6, bgGlassMat, g); // its glazing
        box(21.0, 0.5, 12.0, 0, 5.0, 0, cityMat, g);       // roof parapet
        world.add(g);
      }

      if (pods.length) {
        const podIM = mkIM(fromBase(new THREE.BoxGeometry(1, 1, 1), 1), cityMat, pods.length, false);
        pods.forEach((p, i) => {
          dummy.position.set(p.x, 0, p.z);
          dummy.rotation.set(0, p.r, 0);
          dummy.scale.set(p.w, p.h, p.d);
          put(podIM, i);
        });
        podIM.instanceMatrix.needsUpdate = true;
      }

      /* A distant tree line threading between the blocks — cities are not made
         only of buildings, and the green band is what stops the middle distance
         reading as a wall. */
      const cTreeMat = new THREE.MeshStandardMaterial({ color: 0x24331f, roughness: 0.95 });
      dispose.push(cTreeMat);
      const cTreeN = lite ? 40 : 90;
      const cTreeIM = mkIM(new THREE.IcosahedronGeometry(1, 0), cTreeMat, cTreeN, false);
      for (let i = 0; i < cTreeN; i++) {
        const a = (i / cTreeN) * Math.PI * 2 + 0.7;
        const r = 48 + rnd(i, 181) * 44;
        const s = 0.5 + rnd(i, 191) * 0.8;
        dummy.position.set(Math.cos(a) * r, s * 0.85, Math.sin(a) * r);
        dummy.rotation.set(rnd(i, 193), rnd(i, 197) * 6, rnd(i, 199));
        dummy.scale.set(s, s * 1.25, s);
        put(cTreeIM, i);
      }
      cTreeIM.instanceMatrix.needsUpdate = true;

      const sk = skylineTexture(2048, 256);
      texs.push(sk);
      sk.repeat.set(4, 1);
      const skMat = new THREE.MeshBasicMaterial({ map: sk, transparent: true, side: THREE.BackSide, opacity: 0.42, depthWrite: false, fog: false });
      dispose.push(skMat);
      const skyline = new THREE.Mesh(new THREE.CylinderGeometry(200, 200, 40, 40, 1, true), skMat);
      skyline.position.y = 11;
      world.add(skyline);

      // The city lights up as the sun goes — one ramp, no state.
      tick.push((t) => { cityMat.emissiveIntensity = mix(0.12, 1.3, ease(span(0.3, 0.82, t))); });
    }

    /* ======================================================================
       AIR — dust over the working site. Desktop only; the first thing a phone
       should not be drawing.
       ====================================================================== */
    if (!lite) {
      const DN = 460;
      const pos = new Float32Array(DN * 3);
      const vel = new Float32Array(DN);
      for (let i = 0; i < DN; i++) {
        pos[i * 3] = (rnd(i, 1) - 0.5) * (BW + 10);
        pos[i * 3 + 1] = rnd(i, 2) * (TOP + 3) - 1.2;
        pos[i * 3 + 2] = (rnd(i, 3) - 0.5) * (BD + 10);
        vel[i] = 0.05 + rnd(i, 4) * 0.13;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const dotTex = softDot(32);
      texs.push(dotTex);
      const dm = new THREE.PointsMaterial({
        map: dotTex, color: 0xffd9ad, size: 0.07, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
      });
      dispose.push(dm);
      const dust = new THREE.Points(geo, dm);
      world.add(dust);
      tick.push((t, dt) => {
        const a = ease(span(0.1, 0.24, t)) * (1 - ease(span(0.8, 0.93, t)));
        dm.opacity = 0.26 * a;
        dust.visible = a > 0.01;
        if (!dust.visible) return;
        const p = geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < DN; i++) {
          let y = p.getY(i) + vel[i] * dt;
          if (y > TOP + 2.5) y = -1.4;
          p.setY(i, y);
          p.setX(i, p.getX(i) + Math.sin(y * 1.6 + i) * dt * 0.06);
        }
        p.needsUpdate = true;
      });
    }

    /* ---- the lighting story ------------------------------------------------
       Physically ordered, deliberately: late afternoon → golden hour → blue
       hour → night. The brief asks for blue hour BEFORE golden, which runs the
       sun backwards; a sunset that goes the wrong way is the one thing an
       audience notices without being able to say why. */
    const KEY_COL = [new THREE.Color(0xfff3e2), new THREE.Color(0xff9b52), new THREE.Color(0x6f88c8)];
    const HEMI_SKY = [new THREE.Color(0xa9c0dc), new THREE.Color(0xc78f6e), new THREE.Color(0x3d5482)];
    const HEMI_GND = [new THREE.Color(0x4a4034), new THREE.Color(0x54382a), new THREE.Color(0x191a20)];
    const FOG_COL = [new THREE.Color(0x8e9aa4), new THREE.Color(0x7c6a68), new THREE.Color(0x141d33)];
    const SUN_DIR = [new THREE.Vector3(-14, 22, 12), new THREE.Vector3(-24, 6.5, 9), new THREE.Vector3(-20, 9, -8)];
    const _c = new THREE.Color();
    /** hour(t) 0..2 — the whole time-of-day move in one number. Slow through the
     *  construction, then the sun drops as the facade closes. */
    const hour = (t: number) => (t < 0.42 ? span(0.0, 0.42, t) * 0.55 : 0.55 + span(0.42, 0.9, t) * 1.45);

    /* ---- camera drive ------------------------------------------------------ */
    const camP = new THREE.Vector3(), camL = new THREE.Vector3();
    const curP = new THREE.Vector3(7, 23, 25), curL = new THREE.Vector3();
    let yaw = 0;
    const YAW_MAX = 0.26;
    let focusOn = false, focusK = 0;
    let KEYS = KEYS_D, OUTK = OUT_D;
    const _oP = new THREE.Vector3(), _oL = new THREE.Vector3();
    const _fP = new THREE.Vector3(), _fL = new THREE.Vector3();
    const _side = new THREE.Vector3();
    /** The landmark, for the follow camera to keep over its shoulder. */
    const _bldg = new THREE.Vector3(0, 3.4, 2.0);
    const _gateP = new THREE.Vector3(), _gateL = new THREE.Vector3();

    /** Second-order smoothing on top of StoryScroll's own damping, then commit.
     *  Shared by both acts, so the hand-over cannot introduce a step. */
    const finishCamera = (dt: number, fov: number) => {
      const a = Math.min(1, dt * 7.5);
      curP.lerp(camP, a);
      curL.lerp(camL, a);
      camera.position.copy(curP);
      camera.lookAt(curL);
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    };

    const driveCamera = (t: number, dt: number, outro: number) => {
      const fov = camKey(KEYS, t, camP, camL);
      if (outro > 0.0005) {
        const ofov = camKey(OUTK, outro, _oP, _oL);
        /* THE FOLLOW SHOT. Between these bounds the authored key gives way to a
           rig hung off the car itself — behind it, out to the kerb side, a
           little above roof height, looking down the road ahead of it. Blended
           in and out rather than switched, so the camera drifts onto the car and
           drifts off it again; a hard swap here is the one thing that would read
           as a cut in a shot that is meant to have none. */
        const fw = 0.42 * ease(span(0.60, 0.74, outro)) * (1 - ease(span(0.86, 1.0, outro)));
        if (fw > 0.001) {
          _side.set(-heroDir.z, 0, heroDir.x);          // right of travel
          _fP.copy(heroPos).addScaledVector(heroDir, -11.5).addScaledVector(_side, -4.2);
          _fP.y = 4.4;
          /* Aimed ahead of the car but PULLED BACK toward the landmark, and the
             rig only ever takes 72% of the frame. A pure chase cam is correct
             for a car advert and wrong here: the brief is explicit that the
             building stays visible behind the vehicle, and a camera that looks
             only where the car is going loses it within a second. */
          _fL.copy(heroPos).addScaledVector(heroDir, 6.0);
          _fL.y = 1.2;
          _fL.lerp(_bldg, 0.45);
          _oP.lerp(_fP, fw);
          _oL.lerp(_fL, fw);
        }
        /* Act one blends into act two over the first slice of `o`. OUT[0] equals
           the last build key, so this is belt-and-braces against the build
           camera's drift term rather than a real crossfade. */
        const w = ease(span(0, 0.06, outro));
        camP.lerp(_oP, w);
        camL.lerp(_oL, w);
        finishCamera(dt, mix(fov, ofov, w));
        return;
      }
      if (yaw !== 0) {
        const c = Math.cos(yaw), s = Math.sin(yaw);
        const x = camP.x - camL.x, z = camP.z - camL.z;
        camP.x = camL.x + x * c - z * s;
        camP.z = camL.z + x * s + z * c;
      }
      focusK += ((focusOn ? 1 : 0) - focusK) * Math.min(1, dt * 2.4);
      if (focusK > 0.001) {
        camP.lerp(_gateP.copy(GATE_CAM), focusK);
        camL.lerp(_gateL.copy(GATE_LOOK), focusK);
      }
      /* A very slight low-frequency drift. A real crane shot is never perfectly
         still, and a perfectly still one is what reads as CGI. Amplitude is
         under 10 cm at 20 m, so it registers as life, not as wobble. */
      camP.x += Math.sin(t * 5.1) * 0.035 + Math.sin(t * 2.3) * 0.05;
      camP.y += Math.sin(t * 3.7 + 1.2) * 0.04;
      finishCamera(dt, fov);
    };

    /* ---- master update ----------------------------------------------------- */
    const update = (t: number, dt = 0, tail = 0) => {
      for (let i = 0; i < tick.length; i++) tick[i](t, dt, tail);

      const h = hour(t);
      skyBlend.value = h;
      const i = h < 1 ? 0 : 1, k = clamp01(h - i);
      key.color.copy(_c.copy(KEY_COL[i]).lerp(KEY_COL[i + 1], k));
      key.intensity = mix(mix(2.1, 1.45, clamp01(h)), 0.4, clamp01(h - 1));
      key.position.copy(SUN_DIR[i]).lerp(SUN_DIR[i + 1], k);
      hemi.color.copy(_c.copy(HEMI_SKY[i]).lerp(HEMI_SKY[i + 1], k));
      hemi.groundColor.copy(_c.copy(HEMI_GND[i]).lerp(HEMI_GND[i + 1], k));
      /* LIFTING THE NIGHT FLOOR, not the whole scene.
         Every value on these four lines is the value the ramp lands on at FULL
         NIGHT (h = 2), and together they are what made the late frames read as
         a dark game scene rather than an evening photograph. The daylight ends
         are untouched, so nothing gets brighter — only the bottom of the curve
         comes up off black.
         Sky fill 0.8 -> 1.0: the ambient a real dusk sky still throws.
         Bounce 0.16 -> 0.30: this light exists specifically to keep the near
         elevations off black once the sun is down (see where it is declared),
         and 0.16 was not enough to do that job. */
      hemi.intensity = mix(mix(1.1, 0.95, clamp01(h)), 1.0, clamp01(h - 1));
      bounce.intensity = mix(0.4, 0.30, clamp01(h));
      fog.color.copy(_c.copy(FOG_COL[i]).lerp(FOG_COL[i + 1], k));
      /* Haze thinned. 0.0132 at night put ~2 stops of atmosphere between the
         camera and a 22 m frontage seen from 20 m — the building was reading
         through a veil rather than through air. Enough is kept for depth. */
      fog.density = mix(0.0080, 0.0100, clamp01(h - 0.6));
      /* Image-based light carries all the material definition on glass, metal
         and wet asphalt; at 0.55 those surfaces had almost nothing to reflect
         and went matte, which is most of what reads as "plastic". */
      scene.environmentIntensity = mix(1.0, 0.72, clamp01(h - 0.7));
      /* Base 0.95 -> 1.02. Under 1.0 the whole frame was being pulled down
         before tone mapping even started. The top of the ramp is unchanged, so
         the finished, lit building is exactly as bright as it was. */
      /* Top trimmed 1.18 -> 1.06. The base stays at 1.02 — the scene genuinely
         was sitting too low and that lift is keeping the shadows off black —
         but pushing to 1.18 at full night was adding a sixth of a stop on top
         of lights that were already clipping. Exposure is the wrong tool for a
         local hot spot anyway: it moves the whole frame. The fix for the
         entrance is the entrance lights, above. */
      /* PHONE GETS A THIRD OF A STOP MORE. Not a correction to the render —
         a correction for the viewing condition. A phone is held in daylight,
         at arm's length, behind a reflective sheet of glass, and a blue-hour
         frame graded for a monitor in a dim room loses its shadow detail
         entirely there. Desktop and tablet are unchanged. */
      const expo = phoneView ? 1.13 : 1.02;
      renderer.toneMappingExposure = mix(expo, expo + 0.04, clamp01(h - 0.9));

      const litNow = ease(span(P.lit[0], P.lit[1], t));
      /* HALVED. These are the wall-washers on the entrance elevation and the
         lobby light behind the glazing, and at 55/26 with inverse-square decay
         they were putting far more than 1.0 on the stone within a metre or two
         of each source — everything inside that radius clipped to flat white
         and took the joints and the surface texture with it. Blown highlights
         are lost data: no exposure or tone curve downstream can bring a stone
         course back once the render has written 1.0 across it. */
      inner.intensity = 29 * litNow;
      uplight.forEach((l) => { l.intensity = 13 * litNow; });
      driveCamera(t, dt, tail);
    };

    /* ---- post ---------------------------------------------------------------
       AMBIENT OCCLUSION is the single biggest step from "3D model" to
       "architectural render": contact shading under slabs, inside the glazing
       reveals, behind the piers, under tyres and kerbs. N8AO, not three's
       SSAOPass — SSAO smears dark streaks off thin geometry at this scale.

       THE COMPOSER'S OWN TARGET IS WHERE THE ALIASING COMES FROM. `antialias`
       on the context only ever applies to the DEFAULT framebuffer, and nothing
       renders there once a composer is in play; its target defaults to
       `samples: 0`, so every mullion, scaffold tube and kerb draws hard
       stair-stepped. Hand it a target with MSAA on.

       NO DEPTH OF FIELD. BokehPass renders the whole scene a second time for
       its depth buffer — roughly double the draw calls on this scene — and on a
       scroll-scrubbed hero, frame rate is worth more than a background blur.
       The depth cue comes from the three fogged city layers instead, which is
       real geometry rather than a filter. */
    let composer: EffectComposer | null = null;
    let n8ao: N8AOPass | null = null;
    if (!lite) {
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 });
      composer = new EffectComposer(renderer, rt);
      // N8AOPass, not N8AOPostPass: the Post variant expects depth+normals to
      // already exist and renders BLACK without them. N8AOPass does the beauty
      // render itself, so it REPLACES RenderPass.
      n8ao = new N8AOPass(scene, camera, 1, 1);
      // Radius is in WORLD units — 1 unit is ~2.8 m here.
      n8ao.configuration.aoRadius = 0.5;
      n8ao.configuration.distanceFalloff = 0.55;
      n8ao.configuration.intensity = 2.4;
      n8ao.configuration.halfRes = true;
      n8ao.configuration.denoiseIterations = 1;
      // OutputPass owns tone mapping and sRGB; correcting here too washes out.
      n8ao.configuration.gammaCorrection = false;
      n8ao.configuration.color = new THREE.Color(0x0b1220);
      composer.addPass(n8ao);
      composer.addPass(new OutputPass());
    }

    /* ---- size, visibility, teardown ---------------------------------------- */
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      /* Re-evaluated on every resize, not just at mount — a phone rotating to
         landscape crosses the breakpoint, and the two key sets are different
         COMPOSITIONS, not a scale factor.
         CHOSEN BY ASPECT, NOT BY WIDTH. `isPhone()` is a 767px media query,
         which is the right question for LAYOUT and the wrong one for FRAMING: a
         768px tablet held upright is a 0.75 frame, and handing it the landscape
         keys — authored for ~1.6 — puts the 22 m frontage across a frame half
         that wide and loses the building. Anything taller than it is wide gets
         the portrait set, which is what those keys were actually written for. */
      const phone = isPhone() || w / h < 1.0;
      phoneView = isPhone();
      KEYS = phone ? KEYS_M : KEYS_D;
      OUTK = phone ? OUT_M : OUT_D;
      renderer.setPixelRatio(DPR_CAP);
      renderer.setSize(w, h, false);
      composer?.setSize(w, h);
      n8ao?.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    /* Renders CONTINUOUSLY while on screen — the crane slews, the drum turns and
       the dust drifts whether or not the wheel is moving. The
       IntersectionObserver keeps that honest: scrolled past, it costs nothing,
       and `visibility: hidden` lets the compositor drop the WebGL layer for the
       rest of the page. */
    let visible = true, raf = 0, last = 0, playhead = 0, tailv = 0;
    let shadowAt = -1;
    let shadowTail = -1;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) { last = now; return; }
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      update(playhead, dt, tailv);
      /* Shadows only need redrawing when geometry actually moved — and the
         TRAFFIC moves on the outro playhead, not the build one. This tested
         `playhead` alone, which is pinned at 1 for the whole car-exit shot, so
         a fleet that now casts would have dragged a frozen shadow down the road
         behind it. Both playheads, one condition. */
      if (!lite && (Math.abs(playhead - shadowAt) > 0.0015 || Math.abs(tailv - shadowTail) > 0.0015)) {
        renderer.shadowMap.needsUpdate = true;
        shadowAt = playhead;
        shadowTail = tailv;
      }
      if (composer) composer.render(); else renderer.render(scene, camera);
    };
    update(0);
    raf = requestAnimationFrame(loop);

    const releaseFocus = () => { focusOn = false; };
    api.current = {
      update: (t, tl = 0) => { playhead = clamp01(t); tailv = tl; },
      focusGate: () => { focusOn = true; },
    };

    /* A ResizeObserver, NOT just `window.resize`.
       `resize()` bails when the host has no layout yet, and this component is
       mounted lazily inside a Suspense boundary — so on the phone it ran once
       against a zero-size host, returned early, and NEVER RAN AGAIN. The camera
       kept aspect 1 on a 0.46 viewport, which is why the portrait hero framed
       the building at half the size it was authored for. The observer fires as
       soon as the element gets a box, and again on rotation and on every pin
       re-layout, which `window.resize` does not cover either. */
    const ro = new ResizeObserver(() => resize());
    ro.observe(el);
    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    (['wheel', 'touchstart', 'keydown', 'pointerdown'] as const)
      .forEach((e) => window.addEventListener(e, releaseFocus, { passive: true }));

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      el.style.visibility = visible ? '' : 'hidden';
    }, { threshold: 0 });
    io.observe(el);

    /* TOUCH ORBIT (phones). It can never lock the page scroll by construction:
       listeners are PASSIVE so preventDefault is impossible, the host keeps
       `touch-action: pan-y` and `pointer-events: none`, and a gesture is only
       claimed once the horizontal delta clearly beats the vertical one. */
    let tx = 0, ty = 0, dragging = false, claimed = false;
    const onTouchStart = (e: TouchEvent) => {
      if (!visible || !isPhone() || e.touches.length !== 1) return;
      tx = e.touches[0].clientX; ty = e.touches[0].clientY;
      dragging = true; claimed = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging || e.touches.length !== 1) { dragging = false; return; }
      const x = e.touches[0].clientX, y = e.touches[0].clientY;
      const dx = x - tx, dy = y - ty;
      if (!claimed) {
        if (Math.abs(dy) > Math.abs(dx)) { dragging = false; return; }
        if (Math.abs(dx) < 8) return;
        claimed = true;
      }
      yaw = Math.max(-YAW_MAX, Math.min(YAW_MAX, yaw + dx * 0.003));
      tx = x; ty = y;
    };
    const onTouchEnd = () => { dragging = false; };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      (['wheel', 'touchstart', 'keydown', 'pointerdown'] as const)
        .forEach((e) => window.removeEventListener(e, releaseFocus));
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      io.disconnect();
      ro.disconnect();
      api.current = null;
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      dispose.forEach((m) => m.dispose?.());
      texs.forEach((t) => t.dispose());
      composer?.dispose();
      envRT.texture.dispose();
      pmrem.dispose();
      scene.environment = null;
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    update: (t, tl) => api.current?.update(t, tl),
    focusGate: () => api.current?.focusGate(),
  }), []);

  return <div ref={host} className={className} aria-hidden />;
});

export default HeroSite;

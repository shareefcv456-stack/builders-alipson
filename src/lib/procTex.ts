/* ==========================================================================
   PROCEDURAL TEXTURE KIT
   --------------------------------------------------------------------------
   Every map the 3D hero uses is GENERATED at runtime on a <canvas>. That is a
   deliberate trade: a real PBR concrete set (albedo + normal + roughness at 2K)
   is 3–6 MB of downloads, and this hero already ships a 148 KB JS chunk. These
   are worse than photographed maps, but they are free, they cache with the JS,
   and they are the difference between "flat coloured box" and "surface".

   Swap any of these for real texture files later without touching HeroThree —
   it only consumes the returned THREE.Texture objects.
   ========================================================================== */
import * as THREE from 'three';

/** Stable integer hash → 0..1. Stable so the concrete looks the same on every
 *  load; `Math.random` would re-roll the surface on each mount. */
function h2(x: number, y: number, s: number): number {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 362437);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise with smoothstep interpolation, tiling on `period`. */
function valueNoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const wrap = (v: number) => ((v % period) + period) % period;
  const a = h2(wrap(xi), wrap(yi), seed);
  const b = h2(wrap(xi + 1), wrap(yi), seed);
  const c = h2(wrap(xi), wrap(yi + 1), seed);
  const d = h2(wrap(xi + 1), wrap(yi + 1), seed);
  const u = smooth(xf), v = smooth(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** Fractal brownian motion — the actual grain of the surface. */
function fbm(x: number, y: number, octaves: number, base: number, seed: number): number {
  let sum = 0, amp = 0.5, freq = base, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * freq, y * freq, freq, seed + o * 17) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

export type SurfaceMaps = { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture };

/**
 * A concrete-like surface: mottled albedo, a matching normal map derived from
 * the same height field (so bumps line up with stains), and a roughness map so
 * the surface is not uniformly matte.
 *
 * `pits` adds sparse dark specks — form-tie holes and aggregate blow-outs, the
 * detail that stops cast concrete reading as painted card.
 */
export function concreteMaps(size = 256, tint: [number, number, number] = [214, 217, 221], pits = true): SurfaceMaps {
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = fbm(x / size, y / size, 5, 8, 1);
      // Broad, low-frequency staining on top of the fine grain.
      h = h * 0.72 + fbm(x / size, y / size, 2, 2, 91) * 0.28;
      if (pits) {
        const p = h2(x >> 2, y >> 2, 404);
        if (p > 0.994) h -= 0.42;          // blow-out
        else if (p > 0.988) h -= 0.18;
      }
      height[y * size + x] = h;
    }
  }

  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return { c, d: c.getContext('2d')!.createImageData(size, size) };
  };

  const albedo = mk(), rough = mk(), norm = mk();
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const h = height[y * size + x];

      // Albedo: tint modulated by height, kept in a tight band — concrete varies
      // in value, not hue, and a wide band reads as camouflage.
      const k = 0.82 + h * 0.34;
      albedo.d.data[i] = Math.min(255, tint[0] * k);
      albedo.d.data[i + 1] = Math.min(255, tint[1] * k);
      albedo.d.data[i + 2] = Math.min(255, tint[2] * k);
      albedo.d.data[i + 3] = 255;

      // Roughness: pits and stains hold moisture and read rougher.
      const r = Math.max(0, Math.min(1, 0.9 - h * 0.22));
      rough.d.data[i] = rough.d.data[i + 1] = rough.d.data[i + 2] = r * 255;
      rough.d.data[i + 3] = 255;

      // Normal from the height field by central difference (Sobel-lite).
      const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 2.2;
      const len = Math.hypot(dx, dy, 1);
      norm.d.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      norm.d.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      norm.d.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      norm.d.data[i + 3] = 255;
    }
  }

  const tex = (o: { c: HTMLCanvasElement; d: ImageData }, srgb: boolean) => {
    o.c.getContext('2d')!.putImageData(o.d, 0, 0);
    const t = new THREE.CanvasTexture(o.c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };

  return { map: tex(albedo, true), normalMap: tex(norm, false), roughnessMap: tex(rough, false) };
}

/**
 * Site ground: compacted dirt with gravel scatter and tyre-tracked patches.
 * Coarser and browner than the concrete set, with hard-edged stones rather than
 * smooth mottling — gravel reads by its speckle, not its colour.
 */
export function dirtMaps(size = 256): SurfaceMaps {
  const height = new Float32Array(size * size);
  const stone = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      // Broad rutting + fine tilth.
      height[i] = fbm(x / size, y / size, 3, 3, 21) * 0.55 + fbm(x / size, y / size, 5, 14, 55) * 0.45;
      // Sparse hard stones, thresholded so they have edges.
      const g = h2(x >> 1, y >> 1, 909);
      stone[i] = g > 0.972 ? 1 : g > 0.955 ? 0.55 : 0;
    }
  }
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return { c, d: c.getContext('2d')!.createImageData(size, size) };
  };
  const albedo = mk(), rough = mk(), norm = mk();
  const at = (x: number, y: number) =>
    height[((y + size) % size) * size + ((x + size) % size)] + stone[((y + size) % size) * size + ((x + size) % size)] * 0.35;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4, j = y * size + x;
      const h = height[j], st = stone[j];
      // Earth base, lifted toward grey where a stone sits.
      const k = 0.72 + h * 0.5;
      const r = mix(122 * k, 168, st), gg = mix(101 * k, 168, st), b = mix(78 * k, 166, st);
      albedo.d.data[i] = r; albedo.d.data[i + 1] = gg; albedo.d.data[i + 2] = b; albedo.d.data[i + 3] = 255;
      const rv = Math.max(0, Math.min(1, 0.97 - st * 0.3 - h * 0.1));
      rough.d.data[i] = rough.d.data[i + 1] = rough.d.data[i + 2] = rv * 255;
      rough.d.data[i + 3] = 255;
      const dx = (at(x + 1, y) - at(x - 1, y)) * 3;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 3;
      const len = Math.hypot(dx, dy, 1);
      norm.d.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      norm.d.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      norm.d.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      norm.d.data[i + 3] = 255;
    }
  }
  const tex = (o: { c: HTMLCanvasElement; d: ImageData }, srgb: boolean) => {
    o.c.getContext('2d')!.putImageData(o.d, 0, 0);
    const t = new THREE.CanvasTexture(o.c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { map: tex(albedo, true), normalMap: tex(norm, false), roughnessMap: tex(rough, false) };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Asphalt: dark bitumen with visible aggregate. The aggregate is the whole
 * point — a flat dark plane reads as a shadow, not a road surface.
 */
export function asphaltMaps(size = 256): SurfaceMaps {
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      // Fine chip texture plus a low-frequency wear pattern.
      const chip = h2(x >> 1, y >> 1, 313);
      height[i] = fbm(x / size, y / size, 4, 22, 5) * 0.5
        + fbm(x / size, y / size, 2, 3, 77) * 0.2
        + (chip > 0.965 ? 0.5 : chip > 0.93 ? 0.24 : 0);
    }
  }
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return { c, d: c.getContext('2d')!.createImageData(size, size) };
  };
  const albedo = mk(), rough = mk(), norm = mk();
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4, h = height[y * size + x];
      const v = 42 + h * 78;
      albedo.d.data[i] = v; albedo.d.data[i + 1] = v * 1.02; albedo.d.data[i + 2] = v * 1.08;
      albedo.d.data[i + 3] = 255;
      const r = Math.max(0, Math.min(1, 0.94 - h * 0.3));
      rough.d.data[i] = rough.d.data[i + 1] = rough.d.data[i + 2] = r * 255;
      rough.d.data[i + 3] = 255;
      const dx = (at(x + 1, y) - at(x - 1, y)) * 2.6, dy = (at(x, y + 1) - at(x, y - 1)) * 2.6;
      const len = Math.hypot(dx, dy, 1);
      norm.d.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      norm.d.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      norm.d.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      norm.d.data[i + 3] = 255;
    }
  }
  const tex = (o: { c: HTMLCanvasElement; d: ImageData }, srgb: boolean) => {
    o.c.getContext('2d')!.putImageData(o.d, 0, 0);
    const t = new THREE.CanvasTexture(o.c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { map: tex(albedo, true), normalMap: tex(norm, false), roughnessMap: tex(rough, false) };
}

/**
 * Paving: concrete slabs on a grid, with recessed joints. One tile of the
 * texture is one 2×2 slab block, so the repeat controls slab size directly.
 */
export function pavingMaps(size = 256): SurfaceMaps {
  const c1 = document.createElement('canvas'); c1.width = c1.height = size;
  const g = c1.getContext('2d')!;
  const half = size / 2;
  // Slab faces, each very slightly different in value so the grid is not a
  // repeating stamp.
  for (let sy = 0; sy < 2; sy++) {
    for (let sx = 0; sx < 2; sx++) {
      const v = 196 + (h2(sx, sy, 41) - 0.5) * 18;
      g.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      g.fillRect(sx * half, sy * half, half, half);
    }
  }
  // Joints.
  g.fillStyle = 'rgba(120,124,130,0.85)';
  const j = Math.max(2, size / 90);
  g.fillRect(half - j / 2, 0, j, size);
  g.fillRect(0, half - j / 2, size, j);
  g.fillRect(0, 0, j / 2, size); g.fillRect(size - j / 2, 0, j / 2, size);
  g.fillRect(0, 0, size, j / 2); g.fillRect(0, size - j / 2, size, j / 2);

  // Normal + roughness derived from the joint mask, so joints read as recessed.
  const src = g.getImageData(0, 0, size, size);
  const nrm = document.createElement('canvas'); nrm.width = nrm.height = size;
  const rgh = document.createElement('canvas'); rgh.width = rgh.height = size;
  const nd = nrm.getContext('2d')!.createImageData(size, size);
  const rd = rgh.getContext('2d')!.createImageData(size, size);
  const lum = (x: number, y: number) => src.data[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = (lum(x + 1, y) - lum(x - 1, y)) * 3.5, dy = (lum(x, y + 1) - lum(x, y - 1)) * 3.5;
      const len = Math.hypot(dx, dy, 1);
      nd.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      nd.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      nd.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      nd.data[i + 3] = 255;
      const r = (0.96 - lum(x, y) * 0.16) * 255;
      rd.data[i] = rd.data[i + 1] = rd.data[i + 2] = r;
      rd.data[i + 3] = 255;
    }
  }
  nrm.getContext('2d')!.putImageData(nd, 0, 0);
  rgh.getContext('2d')!.putImageData(rd, 0, 0);
  const wrap = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { map: wrap(c1, true), normalMap: wrap(nrm, false), roughnessMap: wrap(rgh, false) };
}

/**
 * Distant city skyline as an alpha silhouette strip, for a backdrop cylinder.
 * Deliberately flat and hazy — it sits ~90 units out and only has to give the
 * horizon something other than empty sky.
 */
export function skylineTexture(w = 2048, h = 256): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, w, h);
  // Two ranks: a pale far rank, a slightly darker near rank.
  ([[0.30, 'rgba(150,164,182,0.40)', 3], [0.52, 'rgba(122,138,158,0.62)', 5]] as const)
    .forEach(([maxH, fill, seed]) => {
      g.fillStyle = fill;
      let x = 0;
      let i = 0;
      while (x < w) {
        const bw = 26 + h2(i, seed, 11) * 74;
        const bh = h * (0.1 + h2(i, seed, 29) * maxH);
        g.fillRect(x, h - bh, bw - 4, bh);
        // Occasional setback or mast so the roofline is not all flat tops.
        if (h2(i, seed, 71) > 0.72) {
          const sw = bw * 0.4;
          g.fillRect(x + bw * 0.3, h - bh - bh * 0.22, sw, bh * 0.22);
        }
        x += bw;
        i++;
      }
    });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Brushed-metal roughness variation — keeps big metal faces from looking like
 *  mirrors poured out of a single value. */
export function metalRoughness(size = 128): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const d = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Stretched along x so it reads as a brush direction, not noise.
      const v = fbm(x / size, (y / size) * 6, 4, 6, 7);
      const i = (y * size + x) * 4;
      const r = 0.16 + v * 0.26;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = r * 255;
      d.data[i + 3] = 255;
    }
  }
  ctx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Soft round sprite for dust motes and light points. */
export function softDot(size = 64): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

/** A single soft-edged light shaft, used as a camera-facing card for god rays. */
export function shaftTexture(w = 128, h = 256): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255,247,230,0.85)');
  grad.addColorStop(0.55, 'rgba(255,243,220,0.25)');
  grad.addColorStop(1, 'rgba(255,240,215,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // Feather the vertical edges so the card never shows a straight boundary.
  const side = g.createLinearGradient(0, 0, w, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)');
  side.addColorStop(0.5, 'rgba(0,0,0,0)');
  side.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = side;
  g.fillRect(0, 0, w, h);
  return new THREE.CanvasTexture(c);
}

/** A drafted floor plan, for the ground-plane blueprint. */
export function blueprintTexture(S = 512): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#123a6b';
  g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(255,255,255,0.16)';
  g.lineWidth = 1;
  for (let i = 0; i <= S; i += 26) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 3;
  g.strokeRect(64, 78, 384, 250);
  g.lineWidth = 2;
  g.strokeRect(96, 108, 150, 110);
  g.strokeRect(262, 108, 154, 110);
  g.strokeRect(96, 240, 320, 58);
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(64, 356); g.lineTo(448, 356); g.stroke();
  [64, 448].forEach((x) => { g.beginPath(); g.moveTo(x, 348); g.lineTo(x, 364); g.stroke(); });
  g.strokeRect(288, 392, 160, 78);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.font = '600 17px sans-serif';
  g.fillText('ALIPSON BUILDERS', 296, 418);
  g.font = '13px sans-serif';
  g.fillText('GROUND FLOOR PLAN', 296, 440);
  g.fillText('SCALE 1:100', 296, 458);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A procedural stand-in for an HDRI. Builds a tiny scene — sky dome, ground,
 * a sun disc and a ring of city blocks with lit faces — which PMREMGenerator
 * then convolves into an environment map.
 *
 * This is NOT as good as a real .hdr: it has no true high dynamic range beyond
 * the emissive discs, and the "city" is blocks rather than a skyline. What it
 * DOES give is directional variation — a bright sun side, a darker ground half,
 * and scattered highlights — which is what glass and metal need to stop looking
 * like flat grey. And it costs zero bytes of download.
 */
export function cityEnvironment(sunDir: THREE.Vector3): THREE.Scene {
  const env = new THREE.Scene();

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xdfeaf7, side: THREE.BackSide })
  );
  env.add(sky);

  // Warm horizon band — the single biggest cue that reflections are outdoors.
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(58, 58, 16, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe9cc, side: THREE.BackSide, transparent: true, opacity: 0.85 })
  );
  band.position.y = 2;
  env.add(band);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(58, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x6d727c })
  );
  ground.position.y = -8;
  env.add(ground);

  // The sun: a small, very bright disc. This is what puts a hot specular hit on
  // the glass and the crane steel.
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(4.5, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  sun.position.copy(sunDir).normalize().multiplyScalar(46);
  env.add(sun);

  // City blocks around the horizon, some with bright faces.
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const r = 34 + (i % 4) * 5;
    const h = 6 + ((i * 7) % 17);
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(5 + (i % 3) * 2, h, 5 + (i % 2) * 3),
      new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xf3f6fa : i % 3 === 1 ? 0x9aa6b6 : 0x5f6773 })
    );
    b.position.set(Math.cos(a) * r, -8 + h / 2, Math.sin(a) * r);
    env.add(b);
  }

  return env;
}

/** Mown lawn — fine blade noise, no large-scale structure (that reads as moss). */
export function grassMaps(size = 256): SurfaceMaps {
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Stretched vertically so the grain reads as blades, plus a faint
      // low-frequency band for mower stripes.
      height[y * size + x] = fbm(x / size * 2.2, y / size * 0.4, 4, 26, 13) * 0.8
        + Math.sin((y / size) * Math.PI * 6) * 0.06;
    }
  }
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return { c, d: c.getContext('2d')!.createImageData(size, size) };
  };
  const albedo = mk(), rough = mk(), norm = mk();
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4, h = height[y * size + x];
      albedo.d.data[i] = 58 + h * 46;
      albedo.d.data[i + 1] = 96 + h * 62;
      albedo.d.data[i + 2] = 48 + h * 38;
      albedo.d.data[i + 3] = 255;
      const r = Math.max(0, Math.min(1, 0.93 - h * 0.12));
      rough.d.data[i] = rough.d.data[i + 1] = rough.d.data[i + 2] = r * 255;
      rough.d.data[i + 3] = 255;
      const dx = (at(x + 1, y) - at(x - 1, y)) * 3.4, dy = (at(x, y + 1) - at(x, y - 1)) * 3.4;
      const len = Math.hypot(dx, dy, 1);
      norm.d.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      norm.d.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      norm.d.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      norm.d.data[i + 3] = 255;
    }
  }
  const tex = (o: { c: HTMLCanvasElement; d: ImageData }, srgb: boolean) => {
    o.c.getContext('2d')!.putImageData(o.d, 0, 0);
    const t = new THREE.CanvasTexture(o.c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { map: tex(albedo, true), normalMap: tex(norm, false), roughnessMap: tex(rough, false) };
}

/**
 * Curtain-wall façade for the background towers: a grid of tinted glass panes
 * with mullions between them. One tile = one floor of bays, so the repeat sets
 * the storey height directly.
 */
export function facadeTexture(size = 256): { map: THREE.Texture; emissive: THREE.Texture } {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!;
  const e = document.createElement('canvas'); e.width = e.height = size;
  const ge = e.getContext('2d')!;
  g.fillStyle = '#8d97a6'; g.fillRect(0, 0, size, size);      // spandrel / frame
  ge.fillStyle = '#000000'; ge.fillRect(0, 0, size, size);
  const COLS = 6, ROWS = 4;
  const cw = size / COLS, rh = size / ROWS;
  for (let r = 0; r < ROWS; r++) {
    for (let cx = 0; cx < COLS; cx++) {
      const k = h2(cx, r, 17);
      // Tinted glass, varying pane to pane — a uniform grid reads as a texture,
      // a varied one reads as a building.
      const b = 96 + k * 58;
      g.fillStyle = `rgb(${Math.round(b * 0.78)},${Math.round(b * 0.9)},${Math.round(b)})`;
      g.fillRect(cx * cw + cw * 0.1, r * rh + rh * 0.14, cw * 0.8, rh * 0.62);
      // A minority of panes are lit from inside.
      if (k > 0.82) {
        ge.fillStyle = `rgba(255,214,150,${0.35 + k * 0.4})`;
        ge.fillRect(cx * cw + cw * 0.1, r * rh + rh * 0.14, cw * 0.8, rh * 0.62);
      }
    }
  }
  const wrap = (cv: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: wrap(c), emissive: wrap(e) };
}

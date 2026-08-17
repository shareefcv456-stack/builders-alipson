import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { concreteMaps, dirtMaps, skylineTexture, metalRoughness, softDot, shaftTexture, blueprintTexture, cityEnvironment } from '../lib/procTex';

/**
 * The construction timeline as an architectural-visualisation render: daylight,
 * PBR surfaces, a live site (tower crane, mixers, hoarding, blueprints),
 * airborne dust, sun shafts, and a camera that cranes and orbits as it builds.
 *
 * `update(t)` takes the same 0..1 playhead StoryScroll drives everything else
 * with. Nothing here holds React state — scroll writes to transforms and
 * material properties directly, once per frame.
 *
 *   0    → 0.20  P1  hoarding snaps in, blueprint glows on the plot, pit opens
 *   0.20 → 0.40  P2  footings, rebar cages, steel columns extend; crane, mixers
 *   0.40 → 0.60  P3  slabs DROP into place, each throwing a puff of dust
 *   0.60 → 0.85  P4  glass panes slide in bay by bay, interiors light warmly
 *   0.85 → 1.00  P5  site clears, landscaping resolves the finished landmark
 */
export type ThreeHandle = { update: (t: number, tail?: number) => void };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const span = (a: number, b: number, v: number) => clamp01((v - a) / (b - a));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Smoothstep — the default for anything that grows. */
const ease = (t: number) => t * t * (3 - 2 * t);
/** Decelerating — for things that are PLACED rather than grown. */
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const stagger = (t: number, a: number, b: number, i: number, n: number, overlap = 0.5) => {
  const step = (b - a) / (n + overlap);
  return span(a + i * step, a + i * step + step * (1 + overlap), t);
};
/** Never let a scale hit exactly 0 — three warns on degenerate matrices. */
const s0 = (v: number) => Math.max(0.0001, v);

const ACCENT = 0xd32f2f;
const SKY_TOP = '#f8fafc', SKY_BOT = '#e2e8f0';
const BW = 6.4, BD = 4.2, FLOORS = 5, FH = 1.02;
const TOP = FLOORS * FH;
const PIT = 0.9;
const SUN = new THREE.Vector3(16, 20, 11);

const upright = <T extends THREE.BufferGeometry>(g: T, h: number): T => { g.translate(0, h / 2, 0); return g; };

function skyTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(1, SKY_BOT);
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const HeroThree = forwardRef<ThreeHandle, { className?: string }>(function HeroThree({ className }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<ThreeHandle | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    /* 1.5, not 2. Four post passes over a 2× buffer on a 1440-wide hero is
       ~8 megapixels a frame; at 1.5 it is half that, and the difference does not
       survive bloom and depth of field anyway. */
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = skyTexture();
    scene.fog = new THREE.Fog(new THREE.Color(SKY_BOT), 78, 175);

    /* Environment map. A real .hdr would be better and drops straight in here —
       see the note on cityEnvironment. This one is generated, so it costs no
       download, and it is what stops metal and glass rendering as flat grey. */
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = cityEnvironment(SUN);
    const envRT = pmrem.fromScene(envScene, 0.02);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.78;

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

    /* ---- daylight ---------------------------------------------------------- */
    scene.add(new THREE.AmbientLight(0xfff4e6, 0.8));
    const sun = new THREE.DirectionalLight(0xfffaf2, 2.3);
    sun.position.copy(SUN);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 70;
    sun.shadow.bias = -0.0001;
    sun.shadow.normalBias = 0.035;
    const shc = sun.shadow.camera as THREE.OrthographicCamera;
    shc.left = -22; shc.right = 22; shc.top = 24; shc.bottom = -18;
    shc.updateProjectionMatrix();
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdce8ff, 0.28);
    fill.position.set(-12, 8, -9);
    scene.add(fill);

    const interior = [-1.9, 0, 1.9].map((x) => {
      const l = new THREE.PointLight(0xffcf9a, 0, 14, 2);
      l.position.set(x, TOP * 0.5, 0);
      scene.add(l);
      return l;
    });

    /* ---- PBR materials ----------------------------------------------------- */
    const conc = concreteMaps(256, [214, 217, 221]);
    const slabConc = concreteMaps(256, [203, 207, 213]);
    const groundConc = concreteMaps(256, [176, 181, 189], false);
    [conc, slabConc].forEach((m) => Object.values(m).forEach((t) => t.repeat.set(2, 2)));
    Object.values(groundConc).forEach((t) => t.repeat.set(80, 80));

    const concreteMat = new THREE.MeshStandardMaterial({
      ...conc, roughness: 0.85, metalness: 0, normalScale: new THREE.Vector2(0.7, 0.7),
    });
    const slabMat = new THREE.MeshStandardMaterial({
      ...slabConc, roughness: 0.85, metalness: 0, normalScale: new THREE.Vector2(0.6, 0.6),
    });
    const metalRough = metalRoughness();
    const steel = (color: number, rough = 0.2) => new THREE.MeshStandardMaterial({
      color, roughness: rough, metalness: 0.85, roughnessMap: metalRough, envMapIntensity: 1.45,
    });
    const steelDark = steel(0x23272e);
    const steelRed = steel(ACCENT);
    const steelGrey = steel(0x9aa2ad, 0.25);
    const steelFrame = steel(0x3a4149, 0.22);   // dark metallic curtain-wall frame
    const rebarMat = new THREE.MeshStandardMaterial({ color: 0x6e4535, roughness: 0.45, metalness: 0.85, roughnessMap: metalRough });
    // Glass, to spec: ior 1.5, transmission 0.95, roughness 0.05.
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x8fb3cf, roughness: 0.1, metalness: 0,
      transmission: 0.9, thickness: 0.6, ior: 1.5,
      transparent: true, side: THREE.DoubleSide, envMapIntensity: 1.0,
    });
    const ledMat = new THREE.MeshStandardMaterial({ color: 0xfff6e8, emissive: 0xffc188, emissiveIntensity: 0, roughness: 1 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x5a1210, emissive: ACCENT, emissiveIntensity: 0, roughness: 0.6 });

    /* ---- ground, with a hole cut for the excavation ------------------------ */
    const plot = new THREE.Shape();
    plot.moveTo(-60, -60); plot.lineTo(60, -60); plot.lineTo(60, 60); plot.lineTo(-60, 60);
    const hole = new THREE.Path();
    const hx = BW / 2 + 0.5, hz = BD / 2 + 0.5;
    hole.moveTo(-hx, -hz); hole.lineTo(-hx, hz); hole.lineTo(hx, hz); hole.lineTo(hx, -hz);
    plot.holes.push(hole);
    const groundGeo = new THREE.ShapeGeometry(plot).rotateX(-Math.PI / 2);
    // ShapeGeometry emits UVs in WORLD units; without this the repeat would be
    // meaningless and the ground would render as one flat colour.
    const guv = groundGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) / 120, guv.getY(i) / 120);
    // Outermost layer: churned site dirt, not a clean floor.
    const dirt = dirtMaps(256);
    Object.values(dirt).forEach((t) => t.repeat.set(120, 120));
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({
      ...dirt, roughness: 0.9, metalness: 0, normalScale: new THREE.Vector2(0.7, 0.7),
    }));
    ground.receiveShadow = true;
    scene.add(ground);

    // Gravel hardstanding inside the hoarding — the working apron.
    const apronGeo = new THREE.PlaneGeometry(BW + 12, BD + 12).rotateX(-Math.PI / 2);
    const auv = apronGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < auv.count; i++) auv.setXY(i, auv.getX(i) * 9, auv.getY(i) * 9);
    const gravel = dirtMaps(256);
    Object.values(gravel).forEach((t) => t.repeat.set(6, 6));
    const apron = new THREE.Mesh(apronGeo, new THREE.MeshStandardMaterial({
      ...gravel, color: 0x9d9382, roughness: 0.9, metalness: 0, normalScale: new THREE.Vector2(0.75, 0.75),
    }));
    apron.position.y = 0.004; apron.receiveShadow = true;
    scene.add(apron);

    // Concrete blinding pad under the building. Sized to OVERLAP the excavation
    // rim — this is what closes the raw edge where the plot hole met the ground.
    const pad = new THREE.Mesh(new THREE.BoxGeometry(BW + 2.2, 0.12, BD + 2.2), concreteMat);
    pad.position.y = 0.008;
    pad.receiveShadow = true;
    scene.add(pad);

    // Setting-out markings sprayed on the pad: gridlines plus a red datum.
    const markMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.9 });
    const datumMat = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.9 });
    const marks = new THREE.Group();
    for (let i = 0; i <= 4; i++) {
      const x = mix(-BW / 2 - 0.6, BW / 2 + 0.6, i / 4);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, BD + 1.8), markMat);
      m.position.set(x, 0.075, 0);
      marks.add(m);
    }
    for (let i = 0; i <= 3; i++) {
      const z = mix(-BD / 2 - 0.5, BD / 2 + 0.5, i / 3);
      const m = new THREE.Mesh(new THREE.BoxGeometry(BW + 1.8, 0.01, 0.05), i === 0 ? datumMat : markMat);
      m.position.set(0, 0.075, z);
      marks.add(m);
    }
    scene.add(marks);

    const podium = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 + 0.1, 0.26, hz * 2 + 0.1), concreteMat);
    podium.position.y = -0.13;
    podium.receiveShadow = podium.castShadow = true;
    podium.visible = false;
    scene.add(podium);

    const pit = new THREE.Mesh(
      new THREE.BoxGeometry(hx * 2, PIT, hz * 2),
      new THREE.MeshStandardMaterial({ color: 0x8a7a63, roughness: 1, side: THREE.BackSide })
    );
    pit.position.y = -PIT / 2;
    scene.add(pit);

    /* ---- P1 · glowing blueprint, plan grid, hoarding ------------------------ */
    const bpTex = blueprintTexture();
    const blueprint = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 4.4).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({
        map: bpTex, emissiveMap: bpTex, emissive: 0x6fa8ff, emissiveIntensity: 0,
        roughness: 0.95, transparent: true, opacity: 0,
      })
    );
    blueprint.position.set(BW / 2 + 2.4, 0.012, BD / 2 + 1.4);
    blueprint.rotation.y = 0.32;
    blueprint.receiveShadow = true;
    scene.add(blueprint);

    const grid = new THREE.GridHelper(BW, 8, ACCENT, ACCENT);
    grid.position.y = 0.016;
    grid.scale.z = BD / BW;
    const gridMat = grid.material as THREE.LineBasicMaterial;
    gridMat.transparent = true;
    gridMat.depthWrite = false;
    scene.add(grid);

    const FENCE: { x: number; z: number; ry: number }[] = [];
    const fx = BW / 2 + 2.9, fz = BD / 2 + 2.6, PANEL = 1.6;
    for (let x = -fx; x < fx; x += PANEL) {
      FENCE.push({ x: x + PANEL / 2, z: -fz, ry: 0 });
      FENCE.push({ x: x + PANEL / 2, z: fz, ry: 0 });
    }
    for (let z = -fz; z < fz; z += PANEL) {
      FENCE.push({ x: -fx, z: z + PANEL / 2, ry: Math.PI / 2 });
      FENCE.push({ x: fx, z: z + PANEL / 2, ry: Math.PI / 2 });
    }
    const panelMesh = new THREE.InstancedMesh(
      upright(new THREE.BoxGeometry(PANEL * 0.94, 1.15, 0.05), 1.15), steel(0x8f9bab, 0.55), FENCE.length
    );
    const postMesh = new THREE.InstancedMesh(
      upright(new THREE.BoxGeometry(0.08, 1.3, 0.08), 1.3), steelRed, FENCE.length
    );
    panelMesh.castShadow = postMesh.castShadow = true;
    panelMesh.receiveShadow = postMesh.receiveShadow = true;
    scene.add(panelMesh, postMesh);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc3 = new THREE.Vector3();
    const YAXIS = new THREE.Vector3(0, 1, 0);
    const setFence = (k: number, clear = 0) => {
      panelMesh.visible = postMesh.visible = k > 0.002 && clear < 0.99;
      if (!panelMesh.visible) return;
      // Struck panels lift and travel outward off the plot.
      const ox = clear * 9, oy = clear * 2.6;
      FENCE.forEach((f, i) => {
        // Each panel SNAPS in — drops the last of its travel on a hard decel.
        const p = outCubic(clamp01(stagger(k, 0, 1, i, FENCE.length, 3)));
        q.setFromAxisAngle(YAXIS, f.ry);
        sc3.set(1, s0(p), 1);
        const dx = Math.sign(f.x) * ox, dz = Math.sign(f.z) * ox;
        m4.compose(v3.set(f.x + dx, mix(1.4, 0, p) + oy, f.z + dz), q, sc3);
        panelMesh.setMatrixAt(i, m4);
        m4.compose(v3.set(f.x + dx - Math.cos(f.ry) * PANEL * 0.5, mix(1.4, 0, p) + oy, f.z + dz + Math.sin(f.ry) * PANEL * 0.5), q, sc3);
        postMesh.setMatrixAt(i, m4);
      });
      panelMesh.instanceMatrix.needsUpdate = true;
      postMesh.instanceMatrix.needsUpdate = true;
    };

    /* ---- P2 · footings, rebar cages, steel columns --------------------------- */
    const colGeo = upright(new THREE.BoxGeometry(0.3, TOP, 0.3), TOP);
    const barGeo = upright(new THREE.CylinderGeometry(0.042, 0.042, TOP * 0.62, 6), TOP * 0.62);
    const tieGeo = new THREE.TorusGeometry(0.14, 0.015, 4, 10).rotateX(Math.PI / 2);
    const footGeo = new THREE.BoxGeometry(0.85, 0.18, 0.85);
    const cols: THREE.Mesh[] = [], cages: THREE.Group[] = [], foots: THREE.Mesh[] = [];
    for (let ix = 0; ix < 4; ix++) {
      for (let iz = 0; iz < 3; iz++) {
        const x = mix(-BW / 2 + 0.55, BW / 2 - 0.55, ix / 3);
        const z = mix(-BD / 2 + 0.5, BD / 2 - 0.5, iz / 2);
        const f = new THREE.Mesh(footGeo, concreteMat);
        f.position.set(x, -0.09, z); f.receiveShadow = f.castShadow = true; f.scale.setScalar(0.0001);
        // A real cage: four bars plus binding ties, not a single bar.
        const cage = new THREE.Group();
        [[-0.085, -0.085], [0.085, -0.085], [0.085, 0.085], [-0.085, 0.085]].forEach(([bx, bz]) => {
          const bar = new THREE.Mesh(barGeo, rebarMat);
          bar.position.set(bx, 0, bz); bar.castShadow = true;
          cage.add(bar);
        });
        for (let k = 1; k <= 4; k++) {
          const tie = new THREE.Mesh(tieGeo, rebarMat);
          tie.position.y = (TOP * 0.62 * k) / 4.6;
          cage.add(tie);
        }
        cage.position.set(x, 0, z); cage.scale.y = 0.0001;
        const corner = (ix === 0 || ix === 3) && (iz === 0 || iz === 2);
        const c = new THREE.Mesh(colGeo, corner ? steelRed : steelDark);
        c.position.set(x, 0, z); c.scale.y = 0.0001; c.castShadow = c.receiveShadow = true;
        scene.add(f, cage, c);
        foots.push(f); cages.push(cage); cols.push(c);
      }
    }

    /* ---- P3 · slabs that DROP into position ---------------------------------- */
    const slabGeo = new THREE.BoxGeometry(BW, 0.16, BD);
    const beamGeo = new THREE.BoxGeometry(BW + 0.08, 0.12, BD + 0.08);
    const slabs: THREE.Mesh[] = [], beams: THREE.Mesh[] = [];
    for (let k = 1; k <= FLOORS; k++) {
      const m = new THREE.Mesh(slabGeo, slabMat);
      m.position.y = k * FH; m.castShadow = m.receiveShadow = true; m.visible = false;
      const bm = new THREE.Mesh(beamGeo, steelRed);
      bm.position.y = k * FH - 0.13; bm.castShadow = true; bm.visible = false;
      scene.add(m, bm); slabs.push(m); beams.push(bm);
    }

    /* ---- P4 · curtain wall that SLIDES in, pane by pane ----------------------- */
    const plateGeo = new THREE.BoxGeometry(BW - 0.55, 0.07, BD - 0.55);
    const plates = Array.from({ length: FLOORS }, (_, k) => {
      const m = new THREE.Mesh(plateGeo, ledMat);
      m.position.y = (k + 1) * FH - 0.3;
      m.scale.set(0.0001, 1, 0.0001);
      scene.add(m);
      return m;
    });

    type Pane = { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3 };
    const panes: Pane[] = [];
    ([[BW, 0, BD / 2, 0], [BW, 0, -BD / 2, 0], [BD, BW / 2, 0, Math.PI / 2], [BD, -BW / 2, 0, Math.PI / 2]] as const)
      .forEach(([w, x, z, ry]) => {
        for (let k = 0; k < FLOORS; k++) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.98, FH * 0.94), glassMat);
          m.rotation.y = ry;
          const to = new THREE.Vector3(x, k * FH + FH / 2 + 0.1, z);
          // Slides in along its own elevation, alternating direction by floor.
          const dir = k % 2 ? 1 : -1;
          const from = to.clone().add(ry ? new THREE.Vector3(0, 0, w * dir) : new THREE.Vector3(w * dir, 0, 0));
          m.position.copy(from);
          m.visible = false;
          scene.add(m);
          panes.push({ mesh: m, from, to });
        }
      });

    const postGeo = upright(new THREE.BoxGeometry(0.09, TOP, 0.09), TOP);
    const mullions: THREE.Mesh[] = [];
    for (let i = 0; i <= 6; i++) {
      const x = mix(-BW / 2, BW / 2, i / 6);
      [-BD / 2, BD / 2].forEach((z) => {
        const m = new THREE.Mesh(postGeo, steelFrame);
        m.position.set(x, 0, z); m.scale.y = 0.0001; m.castShadow = true;
        scene.add(m); mullions.push(m);
      });
    }
    for (let i = 1; i < 4; i++) {
      const z = mix(-BD / 2, BD / 2, i / 4);
      [-BW / 2, BW / 2].forEach((x) => {
        const m = new THREE.Mesh(postGeo, steelFrame);
        m.position.set(x, 0, z); m.scale.y = 0.0001; m.castShadow = true;
        scene.add(m); mullions.push(m);
      });
    }

    const roofMat = new THREE.MeshStandardMaterial({
      ...slabConc, color: 0x9fa5ad, roughness: 0.95, metalness: 0,
      normalScale: new THREE.Vector2(0.6, 0.6),
    });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.25, 0.22, BD + 0.25), roofMat);
    roof.position.y = TOP; roof.castShadow = true; roof.scale.setScalar(0.0001);
    scene.add(roof);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 1.3), steelDark);
    canopy.position.set(0, 1.05, BD / 2 + 0.55);
    canopy.castShadow = true; canopy.scale.setScalar(0.0001);
    scene.add(canopy);

    /* ---- tower crane ---------------------------------------------------------- */
    const crane = new THREE.Group();
    {
      const MAST = 7.4, SEC = 0.42;
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 1.5), concreteMat);
      base.position.y = 0.15; base.castShadow = base.receiveShadow = true;
      crane.add(base);
      const legGeo = upright(new THREE.BoxGeometry(0.07, MAST, 0.07), MAST);
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
        const leg = new THREE.Mesh(legGeo, steelRed);
        leg.position.set(sx * SEC / 2, 0.3, sz * SEC / 2);
        leg.castShadow = true;
        crane.add(leg);
      });
      // Rungs AND diagonals — the diagonals are what make a lattice read as a
      // lattice instead of a ladder.
      const rungGeo = new THREE.BoxGeometry(SEC, 0.04, 0.04);
      const bay = MAST / 11;
      const diagGeo = new THREE.BoxGeometry(Math.hypot(SEC, bay), 0.028, 0.028);
      const diagAng = Math.atan2(bay, SEC);
      for (let i = 0; i < 11; i++) {
        const y = 0.5 + i * bay;
        ([[0, -SEC / 2, 0], [0, SEC / 2, 0], [-SEC / 2, 0, Math.PI / 2], [SEC / 2, 0, Math.PI / 2]] as const)
          .forEach(([x, z, ry]) => {
            const r = new THREE.Mesh(rungGeo, steelGrey);
            r.position.set(x, y, z); r.rotation.y = ry;
            crane.add(r);
            const d = new THREE.Mesh(diagGeo, steelGrey);
            d.position.set(x, y + bay / 2, z);
            d.rotation.set(0, ry, i % 2 ? diagAng : -diagAng);
            crane.add(d);
          });
      }
      const slew = new THREE.Group();
      slew.position.y = MAST + 0.3;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.62, 0.62), steelGrey);
      cab.position.set(0.55, 0.1, 0); cab.castShadow = true;
      const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.4, 0.58), glassMat);
      cabGlass.position.set(0.6, 0.16, 0);
      const jib = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.28, 0.32), steelRed);
      jib.position.set(3.4, 0.34, 0); jib.castShadow = true;
      const cJib = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.26, 0.34), steelGrey);
      cJib.position.set(-1.6, 0.34, 0); cJib.castShadow = true;
      const cWeight = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.66, 0.8), concreteMat);
      cWeight.position.set(-2.7, 0.3, 0); cWeight.castShadow = true;
      const apex = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.5, 4), steelGrey);
      apex.position.y = 1.2; apex.castShadow = true;
      // Pendant tie bars from the apex — the silhouette people recognise.
      const cableMat = new THREE.LineBasicMaterial({ color: 0x2b3038 });
      const tie = (x: number) => new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.9, 0), new THREE.Vector3(x, 0.34, 0)]), cableMat
      );
      const hoist = new THREE.Mesh(upright(new THREE.CylinderGeometry(0.016, 0.016, 4.2, 5), 4.2), steelDark);
      hoist.position.set(4.2, 0.34 - 4.2, 0);
      const hookBlock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.24), steelGrey);
      hookBlock.position.set(4.2, 0.34 - 4.35, 0); hookBlock.castShadow = true;
      slew.add(cab, cabGlass, jib, cJib, cWeight, apex, tie(6.2), tie(3.2), tie(-2.6), hoist, hookBlock);
      // Red aviation indicator lamps: apex, jib tip, counter-jib tip.
      ([[0, 2.0, 0], [6.5, 0.34, 0], [-3.1, 0.34, 0]] as const).forEach(([x, y, z]) => {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), lampMat);
        lamp.position.set(x, y, z);
        slew.add(lamp);
      });
      crane.add(slew);
      crane.userData.slew = slew;
    }
    const CRANE_HOME = new THREE.Vector3(BW / 2 + 2.5, 0, -BD / 2 - 1.6);
    crane.position.copy(CRANE_HOME);
    crane.scale.setScalar(0.0001);
    scene.add(crane);

    /* ---- mixer trucks --------------------------------------------------------- */
    const tyreMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
    const mixers = [0, 1].map((i) => {
      const g = new THREE.Group();
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.34, 1.12), steelDark);
      chassis.position.y = 0.66; chassis.castShadow = true;
      g.add(chassis);
      [-0.42, 0.42].forEach((z) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.12, 0.1), steelDark);
        rail.position.set(0, 0.5, z); rail.castShadow = true;
        g.add(rail);
      });
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.86, 1.14), steelRed);
      cabin.position.set(1.24, 1.1, 0); cabin.castShadow = true;
      const windscreen = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 1.0), glassMat);
      windscreen.position.set(1.71, 1.26, 0);
      const grille = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 1.0), steelGrey);
      grille.position.set(1.72, 0.86, 0);
      // Drum plus helical fins — the read that says "mixer" and not "tanker".
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.4, 1.9, 20), steelGrey);
      drum.rotation.z = Math.PI / 2 - 0.16;
      drum.position.set(-0.5, 1.32, 0); drum.castShadow = true;
      g.add(cabin, windscreen, grille, drum);
      for (let f = 0; f < 3; f++) {
        const fin = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 4, 14), steelRed);
        fin.rotation.set(0.16, Math.PI / 2, 0);
        fin.position.set(-0.94 + f * 0.44, 1.3 + f * 0.07, 0);
        g.add(fin);
      }
      const chute = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.13, 0.9, 8, 1, true), steelGrey);
      chute.rotation.z = 0.9; chute.position.set(-1.78, 0.85, 0);
      const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.8, 0.4), steelGrey);
      ladder.position.set(-1.62, 1.2, 0.3);
      g.add(chute, ladder);
      const tyreGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 14).rotateX(Math.PI / 2);
      const hubGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.26, 10).rotateX(Math.PI / 2);
      [1.15, -0.5, -1.1].forEach((x) => {
        [-0.6, 0.6].forEach((z) => {
          const w = new THREE.Mesh(tyreGeo, tyreMat);
          w.position.set(x, 0.32, z); w.castShadow = true;
          const hub = new THREE.Mesh(hubGeo, steelGrey);
          hub.position.set(x, 0.32, z * 1.02);
          g.add(w, hub);
        });
      });
      g.position.set(i ? BW / 2 + 4.4 : -BW / 2 - 3.6, 0, BD / 2 + 4.6);
      g.rotation.y = i ? -0.5 : 0.36;
      g.userData.home = g.position.clone();
      g.scale.setScalar(0.0001);
      scene.add(g);
      return g;
    });

    /* ---- P5 · landscaping ------------------------------------------------------ */
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x6b5341, roughness: 1 });
    const leafMats = [0x3f6f45, 0x4f7f52, 0x5c8b57].map((c) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true })
    );
    const trunkGeo = upright(new THREE.CylinderGeometry(0.06, 0.11, 1.5, 7), 1.5);
    const branchGeo = upright(new THREE.CylinderGeometry(0.03, 0.05, 0.7, 5), 0.7);
    // Canopy from several offset, faceted clumps rather than one smooth sphere.
    const clumpGeo = new THREE.IcosahedronGeometry(0.42, 1);
    const trees: THREE.Object3D[] = [];
    for (let i = 0; i < 14; i++) {
      // Jittered off the ring, not evenly spaced on it.
      const a = (i / 14) * Math.PI * 2 + 0.5 + ((i * 2.399) % 0.6);
      const rad = 7.2 + ((i * 3.1) % 2.6);
      const g = new THREE.Group();
      let tx = Math.cos(a) * rad, tz = Math.sin(a) * rad * 0.84;
      // Keep the access corridor clear. The car drives out through frame-left,
      // and trees planted in that wedge sat directly in front of it — the exit
      // animation was running correctly and entirely hidden behind canopies.
      // Nobody plants a tree on the access road, so mirror them to the far side.
      if (tx < -4.5 && tz > 0.5) tz = -tz - 1.2;
      g.position.set(tx, 0, tz);
      const tall = 0.85 + ((i * 1.7) % 1) * 0.75;      // height varies 0.85–1.6×
      const lean = (((i * 5.3) % 1) - 0.5) * 0.14;
      g.rotation.z = lean;
      g.rotation.y = (i * 1.1) % 6.28;
      const tr = new THREE.Mesh(trunkGeo, barkMat);
      tr.scale.set(0.9, tall, 0.9);
      tr.castShadow = true;
      g.add(tr);
      for (let b = 0; b < 3; b++) {
        const br = new THREE.Mesh(branchGeo, barkMat);
        br.position.y = (0.95 + b * 0.12) * tall;
        br.rotation.set(0.6, (b / 3) * Math.PI * 2 + i, 0);
        g.add(br);
      }
      const clumps = 5 + (i % 3);
      for (let c = 0; c < clumps; c++) {
        const cl = new THREE.Mesh(clumpGeo, leafMats[(i + c) % 3]);
        const ca = (c / clumps) * Math.PI * 2 + i;
        const rr = 0.26 + ((c * 2.7) % 1) * 0.26;
        cl.position.set(Math.cos(ca) * rr, (1.5 + (c % 3) * 0.24) * tall, Math.sin(ca) * rr * 0.9);
        cl.scale.set(
          0.8 + ((i + c) % 4) * 0.19,
          0.62 + ((i + c * 3) % 4) * 0.16,   // squashed — spheres read as lollipops
          0.8 + ((i * 2 + c) % 4) * 0.19
        );
        cl.castShadow = true;
        g.add(cl);
      }
      g.scale.setScalar(0.0001);
      scene.add(g); trees.push(g);
    }

    /* ---- scale figures ------------------------------------------------------
       The single cheapest realism win in architectural visualisation: without a
       human, a five-storey block and a garden shed render identically. Kept as
       matte dark silhouettes, which is how arch-viz sheets show them anyway —
       and which sidesteps the uncanny-valley problem of low-poly faces.
       1 unit ~ 3.1 m here, so a 1.75 m person is ~0.56 units.                */
    const figMat = new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.95, metalness: 0 });
    const headGeo = new THREE.SphereGeometry(0.052, 8, 6);
    const torsoGeo = upright(new THREE.CapsuleGeometry(0.055, 0.17, 3, 8), 0.28);
    const legGeo = upright(new THREE.CapsuleGeometry(0.032, 0.16, 3, 6), 0.22);
    const makeFigure = () => {
      const f = new THREE.Group();
      const torso = new THREE.Mesh(torsoGeo, figMat);
      torso.position.y = 0.24; torso.castShadow = true;
      const head = new THREE.Mesh(headGeo, figMat);
      head.position.y = 0.5; head.castShadow = true;
      [-0.032, 0.032].forEach((x) => {
        const leg = new THREE.Mesh(legGeo, figMat);
        leg.position.set(x, 0, 0); leg.castShadow = true;
        f.add(leg);
      });
      f.add(torso, head);
      return f;
    };
    // Two populations: crew on site during the build, visitors at handover.
    const crew: THREE.Object3D[] = [], visitors: THREE.Object3D[] = [];
    ([[-2.4, 3.6], [2.9, 3.2], [-3.6, -2.2], [3.4, -2.8]] as const).forEach(([x, z]) => {
      const f = makeFigure();
      f.position.set(x, 0, z);
      f.rotation.y = Math.atan2(-x, -z);
      f.scale.setScalar(0.0001);
      scene.add(f); crew.push(f);
    });
    ([[-1.2, 4.4], [0.5, 4.9], [1.9, 4.2], [-2.6, 4.9], [3.1, 3.9]] as const).forEach(([x, z]) => {
      const f = makeFigure();
      f.position.set(x, 0, z);
      f.rotation.y = Math.atan2(-x, -z) + 0.3;
      f.scale.setScalar(0.0001);
      scene.add(f); visitors.push(f);
    });

    /* ---- ambient ground lighting (comes on with the handover) ---------------- */
    const bollardMat = new THREE.MeshStandardMaterial({ color: 0xfff0d6, emissive: 0xffc98a, emissiveIntensity: 0, roughness: 0.7 });
    const bollardGeo = upright(new THREE.CylinderGeometry(0.04, 0.06, 0.3, 8), 0.3);
    const bollards: THREE.Mesh[] = [];
    const groundGlow: THREE.PointLight[] = [];
    for (let i = 0; i < 10; i++) {
      const side = i < 5 ? -1 : 1;
      const b = new THREE.Mesh(bollardGeo, bollardMat);
      b.position.set(side * 1.9, 0, BD / 2 + 1.1 + (i % 5) * 0.42);
      b.castShadow = true;
      b.scale.setScalar(0.0001);
      scene.add(b); bollards.push(b);
    }
    [-1.9, 1.9].forEach((x) => {
      const l = new THREE.PointLight(0xffc98a, 0, 5, 2);
      l.position.set(x, 0.5, BD / 2 + 2.6);
      scene.add(l); groundGlow.push(l);
    });

    /* ---- background site environment ------------------------------------------
       A distant skyline cylinder, scaffold rigs with safety netting against the
       building, and site light poles. All of it sits OUTSIDE the hoarding so it
       reads as context, and none of it crosses the left third of frame where the
       hero copy lives.                                                          */
    const skyTex = skylineTexture();
    skyTex.repeat.set(3, 1);      // three passes round = smaller, denser blocks
    const skyline = new THREE.Mesh(
      new THREE.CylinderGeometry(88, 88, 15, 48, 1, true),
      new THREE.MeshBasicMaterial({
        map: skyTex, transparent: true, depthWrite: false,
        side: THREE.BackSide, fog: false, opacity: 0.72,
      })
    );
    // Bottom of the band sits just under the horizon so the city meets ground.
    skyline.position.y = 6.6;
    scene.add(skyline);

    // Scaffold rigs: standards, ledgers and boards, with netting stretched over.
    const scaffoldMat = steel(0xa8a093, 0.4);
    const nettingMat = new THREE.MeshStandardMaterial({
      color: 0x3f7f5a, roughness: 0.95, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false,
    });
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xa88a5c, roughness: 0.95 });
    const scaffolds = ([[-BW / 2 - 0.75, 0, Math.PI / 2, BD], [0, -BD / 2 - 0.75, 0, BW]] as const).map(([sx, sz, ry, len]) => {
      const g = new THREE.Group();
      const LIFTS = 5, BAY = len / 2;
      const standGeo = upright(new THREE.CylinderGeometry(0.035, 0.035, TOP, 6), TOP);
      for (let b = 0; b <= 2; b++) {
        [-0.38, 0.38].forEach((off) => {
          const st = new THREE.Mesh(standGeo, scaffoldMat);
          st.position.set(mix(-len / 2, len / 2, b / 2), 0, off);
          st.castShadow = true;
          g.add(st);
        });
      }
      for (let l = 1; l <= LIFTS; l++) {
        const y = (l * TOP) / LIFTS - 0.1;
        [-0.38, 0.38].forEach((off) => {
          const led = new THREE.Mesh(new THREE.BoxGeometry(len, 0.045, 0.045), scaffoldMat);
          led.position.set(0, y, off);
          g.add(led);
        });
        const board = new THREE.Mesh(new THREE.BoxGeometry(len * 0.96, 0.04, 0.62), boardMat);
        board.position.set(0, y + 0.03, 0);
        board.castShadow = true;
        g.add(board);
        // Diagonal brace per lift, alternating hand.
        const brace = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(BAY, TOP / LIFTS), 0.03, 0.03), scaffoldMat);
        brace.position.set(0, y - TOP / LIFTS / 2, 0.38);
        brace.rotation.z = (l % 2 ? 1 : -1) * Math.atan2(TOP / LIFTS, BAY);
        g.add(brace);
      }
      const net = new THREE.Mesh(new THREE.PlaneGeometry(len, TOP), nettingMat);
      net.position.set(0, TOP / 2, 0.42);
      g.add(net);
      g.position.set(sx, 0, sz);
      g.rotation.y = ry;
      g.scale.setScalar(0.0001);
      scene.add(g);
      return g;
    });

    // Site light poles with hazard lamps at the head.
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0x6b4a12, emissive: 0xffa524, emissiveIntensity: 0, roughness: 0.6 });
    const poleGeo = upright(new THREE.CylinderGeometry(0.05, 0.075, 4.6, 8), 4.6);
    const lampHeadGeo = new THREE.BoxGeometry(0.5, 0.1, 0.26);
    // Pushed well out: at the reveal the camera closes to 18 units, and poles
    // any nearer than this cross the building in the hero shot.
    const poles = ([[13.2, 9.4], [-13.6, 8.2], [14.1, -8.6], [-12.8, -8.2]] as const).map(([px, pz]) => {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, steelGrey);
      pole.castShadow = true;
      const head = new THREE.Mesh(lampHeadGeo, steelDark);
      head.position.set(0.2, 4.6, 0); head.castShadow = true;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), hazardMat);
      lamp.position.set(0.2, 4.5, 0);
      g.add(pole, head, lamp);
      g.position.set(px, 0, pz);
      g.rotation.y = Math.atan2(-px, -pz);
      g.scale.setScalar(0.0001);
      scene.add(g);
      return g;
    });

    /* ---- handover: parking bay, road, and the car that drives out -------------
       The climax beat. The car is parked in the newly revealed bay as the build
       finishes, then drives out along a Catmull-Rom path during the STATS TAIL —
       so the drive-out and the stats reveal are the same gesture, not two.      */
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 3.4).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x3c3f45, roughness: 0.88, metalness: 0 })
    );
    road.position.set(-16, 0.006, 3.6);
    road.rotation.y = 0.06;
    road.rotation.z = 0;
    road.receiveShadow = true;
    scene.add(road);
    // Centre line, dashed.
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.9 });
    for (let i = 0; i < 22; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.008, 0.09), dashMat);
      d.position.set(-36 + i * 1.9, 0.012, 3.6 + i * 0.06);
      scene.add(d);
    }
    // Parking bay markings on the plaza, to the left of the entry path.
    const bayMat = new THREE.MeshStandardMaterial({ color: 0xf0f2f4, roughness: 0.9 });
    const bay = new THREE.Group();
    for (let i = 0; i <= 2; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 1.7), bayMat);
      l.position.set(-5.55 + i * 0.95, 0.02, 2.2);
      bay.add(l);
    }
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.01, 0.05), bayMat);
    kerb.position.set(-4.6, 0.02, 1.35);
    bay.add(kerb);
    bay.scale.setScalar(0.0001);
    scene.add(bay);

    // A low, wide saloon — proportioned off a real one (≈4.8 m long, which is
    // ~1.55 units at this scene's 1 unit ≈ 3.1 m) so it sits correctly against
    // the building and the scale figures.
    const car = new THREE.Group();
    const carPaint = new THREE.MeshStandardMaterial({ color: 0xe8eaee, roughness: 0.12, metalness: 0.85, envMapIntensity: 1.9 });
    const carTrim = new THREE.MeshStandardMaterial({ color: 0x2f343c, roughness: 0.25, metalness: 0.9, envMapIntensity: 1.4 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff8ec, emissive: 0xfff2d8, emissiveIntensity: 0, roughness: 0.3 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x5c0d0d, emissive: 0xff2a1e, emissiveIntensity: 0, roughness: 0.4 });
    const wheels: THREE.Mesh[] = [];
    {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.26, 0.66), carPaint);
      body.position.y = 0.26; body.castShadow = true;
      // Bonnet and boot tapers give it a silhouette instead of a brick.
      const bonnet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.6), carPaint);
      bonnet.position.set(0.6, 0.36, 0); bonnet.rotation.z = -0.06; bonnet.castShadow = true;
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.15, 0.6), carPaint);
      boot.position.set(-0.63, 0.37, 0); boot.rotation.z = 0.05; boot.castShadow = true;
      // Greenhouse in the same tinted glass as the building — ties them together.
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.24, 0.58), glassMat);
      cabin.position.set(-0.04, 0.52, 0);
      const roofline = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.54), carPaint);
      roofline.position.set(-0.06, 0.645, 0); roofline.castShadow = true;
      const sill = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.68), carTrim);
      sill.position.y = 0.145;
      car.add(body, bonnet, boot, cabin, roofline, sill);
      // Lamps.
      ([-0.22, 0.22] as const).forEach((z) => {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.16), headMat);
        hl.position.set(0.8, 0.33, z);
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.18), tailMat);
        tl.position.set(-0.79, 0.34, z);
        car.add(hl, tl);
      });
      // Two short-range beams so the headlights actually throw light on the road.
      ([-0.2, 0.2] as const).forEach((z) => {
        const beam = new THREE.SpotLight(0xfff0d0, 0, 9, 0.5, 0.55, 1.4);
        beam.position.set(0.82, 0.33, z);
        beam.target.position.set(5, 0, z);
        car.add(beam, beam.target);
        (car.userData.beams ||= []).push(beam);
      });
      const tyreGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.09, 14).rotateX(Math.PI / 2);
      const rimGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8).rotateX(Math.PI / 2);
      ([[0.52, 0.31], [0.52, -0.31], [-0.52, 0.31], [-0.52, -0.31]] as const).forEach(([wx, wz]) => {
        const w = new THREE.Mesh(tyreGeo, tyreMat);
        w.position.set(wx, 0.115, wz); w.castShadow = true;
        const rim = new THREE.Mesh(rimGeo, carTrim);
        rim.position.set(wx, 0.115, wz * 1.04);
        car.add(w, rim);
        wheels.push(w);
      });
    }
    car.scale.setScalar(1.3);
    car.visible = false;
    scene.add(car);

    /* The drive-out. Parked nose-out in the bay, forward onto the plaza, right
       onto the road, then straight past the camera and off frame. Catmull-Rom so
       the turn is a curve rather than three straight segments. */
    const DRIVE = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.6, 0, 2.2),     // parked, nose out
      new THREE.Vector3(-5.4, 0, 3.0),     // pull forward off the bay
      new THREE.Vector3(-7.6, 0, 3.5),     // swing onto the road
      new THREE.Vector3(-11.0, 0, 3.6),
      new THREE.Vector3(-15.5, 0, 4.0),    // runs across open frame-left
      new THREE.Vector3(-21.0, 0, 4.8),
      new THREE.Vector3(-29.0, 0, 6.2),    // exits the left edge
    ], false, 'catmullrom', 0.4);
    const carPos = new THREE.Vector3(), carTan = new THREE.Vector3();

    /* ---- atmosphere: dust, landing puffs, sun shafts ---------------------------- */
    const dotTex = softDot();
    const DUST = 900;
    const dustPos = new Float32Array(DUST * 3);
    const dustSeed = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 26;
      dustPos[i * 3 + 1] = Math.random() * 9;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 22;
      dustSeed[i] = Math.random() * Math.PI * 2;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.07, map: dotTex, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, color: 0xfff0d8,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    // Slab-landing puffs: ONE shared burst system, re-seeded at whichever slab
    // just touched down. Five separate systems would look identical and cost 5×.
    const PUFF = 220;
    const puffPos = new Float32Array(PUFF * 3);
    const puffGeo = new THREE.BufferGeometry();
    puffGeo.setAttribute('position', new THREE.BufferAttribute(puffPos, 3));
    const puffMat = new THREE.PointsMaterial({
      size: 0.17, map: dotTex, transparent: true, opacity: 0,
      depthWrite: false, sizeAttenuation: true, color: 0xd9cfbe,
    });
    const puff = new THREE.Points(puffGeo, puffMat);
    puff.visible = false;
    scene.add(puff);

    const shaftTex = shaftTexture();
    const shafts = [0, 1, 2].map((i) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4 + i * 1.6, 15),
        new THREE.MeshBasicMaterial({
          map: shaftTex, transparent: true, opacity: 0, depthWrite: false,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        })
      );
      m.position.set(mix(8, 15, i / 2), 7.5, mix(4, -6, i / 2));
      m.renderOrder = 5;
      scene.add(m);
      return m;
    });

    /* ---- post-processing --------------------------------------------------------- */
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // Bloom picks up sun-hit steel, the LED plates and the crane lamps. Kept
    // low — this is daylight architecture, not a neon scene.
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.14, 0.45, 1.15);
    composer.addPass(bloom);
    const bokeh = new BokehPass(scene, camera, { focus: 20, aperture: 0.00007, maxblur: 0.007 });
    composer.addPass(bokeh);
    composer.addPass(new OutputPass());
    const bokehU = (bokeh as unknown as { uniforms: Record<string, { value: number }> }).uniforms;

    /* ---- the per-frame update ------------------------------------------------------ */
    const look = new THREE.Vector3();
    let clock = 0;
    const update = (t: number, dt = 0, tail = 0) => {
      clock += dt;
      const e = ease(t);

      // CAMERA — architectural 3/4. Wide while the site is busy, pushing in for
      // the reveal; framing must clear the whole SITE, not just the building.
      const ang = mix(-0.62, 0.82, e);
      const build = ease(span(0.12, 0.84, t)), reveal = ease(span(0.86, 1, t));
      const rad = mix(mix(23, 27.5, build), 18, reveal);
      // HANDOFF REFRAME. Raising the camera while LOWERING the look target
      // tilts the lens down, which lifts the building UP in frame — that is what
      // clears the bottom band for the stats bar. (Tilting the camera up would
      // push the subject down, behind the stats, which is the opposite.)
      const lift = ease(tail);
      camera.position.set(
        Math.sin(ang) * mix(rad, rad + 1.6, lift),
        mix(mix(7.6, 11.6, build), 7.4, reveal) + lift * 2.1,
        Math.cos(ang) * mix(rad, rad + 1.6, lift)
      );
      look.set(0, mix(1.2, TOP * 0.55, ease(span(0.12, 0.9, t))) - lift * 1.5, 0);
      camera.lookAt(look);
      bokehU.focus.value = camera.position.distanceTo(look);

      // P1 — hoarding snaps in, blueprint glows, pit opens.
      setFence(ease(span(0.01, 0.14, t)), ease(span(0.86, 1, t)));
      const bp = ease(span(0.04, 0.14, t)) * (1 - ease(span(0.52, 0.66, t)));
      const bpm = blueprint.material as THREE.MeshStandardMaterial;
      bpm.opacity = bp;
      bpm.emissiveIntensity = bp * (0.55 + 0.45 * Math.sin(clock * 1.5)) * 0.6;
      const dig = ease(span(0.04, 0.18, t));
      pit.scale.y = mix(0.02, 1, dig);
      pit.position.y = -PIT * pit.scale.y * 0.5;
      gridMat.opacity = ease(span(0.06, 0.2, t)) * (1 - ease(span(0.3, 0.46, t))) * 0.9;

      // P2 — plant arrives; columns extend with mechanical precision (linear,
      // not smoothstep — machinery does not ease in).
      // Arrives by scaling up (it is erected), leaves by DRIVING OFF — a crane
      // that shrinks into the ground reads as a bug, not a de-rig.
      const craneIn = ease(span(0.18, 0.3, t));
      const clear = ease(span(0.88, 1, t));
      crane.scale.setScalar(s0(craneIn));
      crane.position.set(CRANE_HOME.x + clear * 30, CRANE_HOME.y, CRANE_HOME.z - clear * 12);
      crane.visible = clear < 0.99;
      (crane.userData.slew as THREE.Group).rotation.y = mix(0, 2.4, ease(span(0.2, 0.9, t)));
      lampMat.emissiveIntensity = craneIn * (Math.sin(clock * 3.1) > 0.2 ? 3.2 : 0.35);
      mixers.forEach((g, i) => {
        g.scale.setScalar(s0(ease(span(0.2 + i * 0.05, 0.32 + i * 0.05, t))));
        const out = ease(span(0.84 + i * 0.03, 0.97 + i * 0.03, t));
        const home = g.userData.home as THREE.Vector3;
        g.position.set(home.x + out * (i ? 26 : -26), 0, home.z + out * 14);
        g.visible = out < 0.99;
      });
      foots.forEach((m, i) => m.scale.setScalar(s0(outCubic(stagger(t, 0.22, 0.3, i, foots.length)))));
      // The podium caps the excavation as soon as the footings are in, so the
      // finished building is never seen sitting over an open hole.
      podium.visible = t > 0.29;
      // Scaffold goes up with the frame and comes down with the plant.
      scaffolds.forEach((g, i) => {
        const up = ease(span(0.34 + i * 0.04, 0.5 + i * 0.04, t));
        const down = ease(span(0.8 + i * 0.03, 0.9 + i * 0.03, t));
        g.scale.set(1, s0(up * (1 - down)), 1);
        g.visible = up > 0.01 && down < 0.99;
      });
      // Poles stay for the life of the site and keep their hazard lamps going.
      poles.forEach((g, i) => g.scale.setScalar(s0(ease(span(0.12 + i * 0.02, 0.24 + i * 0.02, t)))));
      hazardMat.emissiveIntensity = (Math.sin(clock * 2.2) > 0 ? 2.4 : 0.2) * (1 - ease(span(0.9, 1, t))) + ease(span(0.9, 1, t)) * 1.6;
      cages.forEach((g, i) => { g.scale.y = s0(stagger(t, 0.26, 0.36, i, cages.length)); });
      cols.forEach((m, i) => { m.scale.y = s0(stagger(t, 0.3, 0.42, i, cols.length)); });

      // P3 — slabs DROP in, each throwing dust as it seats.
      let puffAt = -1, puffAge = 1;
      slabs.forEach((m, k) => {
        const p = stagger(t, 0.4, 0.6, k, slabs.length);
        m.visible = beams[k].visible = p > 0.001;
        if (!m.visible) return;
        const drop = outCubic(p);
        const y = mix(k * FH + 3.4, k * FH, drop);
        m.position.y = y;
        beams[k].position.y = y - 0.13;
        const sc = Math.min(1, p * 3);
        m.scale.set(sc, 1, sc);
        beams[k].scale.set(sc, 1, sc);
        if (p > 0.72 && p < 1) { puffAt = k; puffAge = (p - 0.72) / 0.28; }
      });
      puff.visible = puffAt >= 0;
      if (puff.visible) {
        const py = puffAt * FH;
        for (let i = 0; i < PUFF; i++) {
          const a = (i / PUFF) * Math.PI * 2 * 7;
          const r = (0.3 + (i % 11) / 11) * (1.1 + puffAge * 2.8);
          puffPos[i * 3] = Math.cos(a) * r * (BW / 5);
          puffPos[i * 3 + 1] = py - 0.1 + Math.sin(i) * 0.12 + puffAge * 0.55;
          puffPos[i * 3 + 2] = Math.sin(a) * r * (BD / 5);
        }
        puffGeo.attributes.position.needsUpdate = true;
        puffMat.opacity = (1 - puffAge) * 0.5;
      }

      // P4 — panes SLIDE into place, mullions frame, interiors light.
      mullions.forEach((m) => { m.scale.y = s0(ease(span(0.58, 0.72, t))); });
      panes.forEach((p, i) => {
        const k = stagger(t, 0.62, 0.86, i, panes.length, 2.5);
        p.mesh.visible = k > 0.001;
        if (p.mesh.visible) p.mesh.position.lerpVectors(p.from, p.to, outCubic(k));
      });
      roof.scale.setScalar(s0(ease(span(0.72, 0.82, t))));
      plates.forEach((m, k) => {
        const s = s0(stagger(t, 0.42, 0.62, k, plates.length));
        m.scale.set(s, 1, s);
      });
      const lit = ease(span(0.68, 0.92, t));
      ledMat.emissiveIntensity = lit * 0.9 + ease(span(0.88, 1, t)) * 1.5;
      interior.forEach((l) => { l.intensity = lit * 1.4 + ease(span(0.9, 1, t)) * 1.8; });

      // CLIMAX — the car. It SPAWNS on the build playhead (parked as the plaza
      // is revealed) but DRIVES on the tail, so the exit and the stats reveal are
      // one continuous gesture instead of two separate beats.
      const parked = ease(span(0.86, 0.95, t));
      bay.scale.setScalar(s0(parked));
      const dv = ease(tail);
      const drive = dv < 0.75 ? dv * (0.62 / 0.75) : 0.62 + (dv - 0.75) * (0.38 / 0.25);
      car.visible = parked > 0.02;
      if (car.visible) {
        DRIVE.getPointAt(drive, carPos);
        DRIVE.getTangentAt(drive, carTan);
        car.position.copy(carPos);
        car.rotation.y = Math.atan2(carTan.x, carTan.z) - Math.PI / 2;
        car.scale.setScalar(s0(parked) * 1.3);
        // Wheels turn in proportion to distance covered, not to time.
        const roll = drive * 46;
        wheels.forEach((w) => { w.rotation.y = roll; });
        // Lamps come up as it pulls away and stay lit for the exit.
        const lamps = ease(span(0.0, 0.22, tail));
        headMat.emissiveIntensity = lamps * 4.2;
        tailMat.emissiveIntensity = lamps * 2.8;
        ((car.userData.beams as THREE.SpotLight[]) || []).forEach((b) => { b.intensity = lamps * 5; });
      }

      if (import.meta.env.DEV) {
        const ndc = carPos.clone().project(camera);
        (window as unknown as Record<string, unknown>).__heroCar = {
          vis: car.visible, u: +drive.toFixed(3),
          world: [+carPos.x.toFixed(1), +carPos.z.toFixed(1)],
          screen: [Math.round((ndc.x * 0.5 + 0.5) * 1440), Math.round((-ndc.y * 0.5 + 0.5) * 900)],
          inFrame: Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1 && ndc.z < 1,
        };
      }

      // P5 — site clears, landscaping and lighting resolve the landmark.
      trees.forEach((g, i) => g.scale.setScalar(s0(ease(stagger(t, 0.85, 0.99, i, trees.length, 1.6)))));
      canopy.scale.setScalar(s0(ease(span(0.86, 0.94, t))));
      // Crew work through the build and leave with the plant; visitors arrive
      // for the handover. The site is never empty AND never both at once.
      crew.forEach((f, i) => f.scale.setScalar(s0(
        ease(span(0.24 + i * 0.02, 0.34 + i * 0.02, t)) * (1 - ease(span(0.86, 0.94, t)))
      )));
      visitors.forEach((f, i) => f.scale.setScalar(s0(ease(stagger(t, 0.9, 1, i, visitors.length, 1.2)))));
      const dusk = ease(span(0.9, 1, t));
      bollards.forEach((b, i) => b.scale.setScalar(s0(ease(stagger(t, 0.88, 0.98, i, bollards.length, 1.4)))));
      bollardMat.emissiveIntensity = dusk * 1.5;
      groundGlow.forEach((l) => { l.intensity = dusk * 1.6; });

      // ATMOSPHERE — dust is heaviest while the site works, and settles as the
      // building finishes. Motes drift on their own slow clock.
      const air = ease(span(0.16, 0.34, t)) * (1 - ease(span(0.84, 0.98, t)));
      dustMat.opacity = air * 0.5;
      dust.visible = air > 0.01;
      if (dust.visible) {
        for (let i = 0; i < DUST; i++) {
          const s = dustSeed[i];
          dustPos[i * 3] += Math.sin(clock * 0.25 + s) * 0.0016;
          dustPos[i * 3 + 1] += 0.0035 + (i % 7) * 0.0004;
          dustPos[i * 3 + 2] += Math.cos(clock * 0.2 + s) * 0.0014;
          if (dustPos[i * 3 + 1] > 9) dustPos[i * 3 + 1] = 0;
        }
        dustGeo.attributes.position.needsUpdate = true;
      }
      // Shafts billboard to the camera so the cards are never seen edge-on.
      const shaftOn = mix(0.55, 1, ease(span(0.5, 1, t)));
      shafts.forEach((m, i) => {
        m.lookAt(camera.position);
        (m.material as THREE.MeshBasicMaterial).opacity = shaftOn * (0.05 - i * 0.012);
      });
    };

    /* ---- size, visibility, teardown ------------------------------------------------- */
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    /* Renders CONTINUOUSLY while on screen. The render-on-demand trick this used
       to have is incompatible with drifting dust and blinking crane lamps, which
       have to keep moving when the user stops scrolling. The IntersectionObserver
       is what keeps that honest: scroll past the hero and it costs nothing. */
    let visible = true, raf = 0, last = 0, playhead = 0, tailv = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) { last = now; return; }
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      update(playhead, dt, tailv);
      composer.render();
    };
    raf = requestAnimationFrame(loop);

    api.current = { update: (t, tl = 0) => { playhead = t; tailv = tl; } };
    update(0);

    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      io.disconnect();
      api.current = null;
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      envScene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        (m.material as THREE.Material | undefined)?.dispose();
      });
      composer.dispose();
      envRT.texture.dispose();
      pmrem.dispose();
      scene.background = null;
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  useImperativeHandle(ref, () => ({ update: (t, tl) => api.current?.update(t, tl) }), []);

  return <div ref={host} className={className} aria-hidden />;
});

export default HeroThree;

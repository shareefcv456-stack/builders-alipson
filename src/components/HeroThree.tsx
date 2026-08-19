import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { N8AOPass } from 'n8ao';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { concreteMaps, asphaltMaps, pavingMaps, grassMaps, facadeTexture, metalRoughness, softDot, blueprintTexture, brandTexture, cityEnvironment } from '../lib/procTex';

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
export type ThreeHandle = {
  update: (t: number, tail?: number) => void;
  /** Ease the camera onto the entrance gate. Released as soon as the user
   *  scrolls, so it never fights the playhead for control. */
  focusGate: () => void;
};

/** Gate framing, in WORLD-GROUP units — `world` is scaled down on phones, so
 *  these get multiplied by that scale before the camera uses them. */
const GATE_CAM = new THREE.Vector3(0, 2.5, 9);
const GATE_LOOK = new THREE.Vector3(0, 1.2, 0);

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

const ACCENT = 0xc8102e;   // Alipson crimson
const SKY_TOP = '#F8FAFC', SKY_BOT = '#E2E8F0';   // soft light shade — the whole page reads as one bright surface
const BW = 6.4, BD = 4.2, FLOORS = 7, FH = 1.02;
const TOP = FLOORS * FH;
const PIT = 0.9;
/** Carriageway centreline and half-width. The hoarding front sits at
 *  BD/2 + 2.6 = 4.7, so the road must stay clear of that or it runs through the
 *  compound fence — which it did, until the gate scene made it obvious. */
const ROAD_Z = 7.8, ROAD_HALF = 1.7;
/** Driveway corridor: the lane the car uses from its bay, through the gate and
 *  onto the carriageway. NOTHING may be planted inside it. Kept here as one
 *  constant because the trees, the shrubs and the gate opening all have to
 *  agree — the previous rule guarded a frame-left wedge from an older car path
 *  and left the actual driveway planted. */
const DRIVE_HALF = 3.4;
const inDriveway = (x: number, z: number) => Math.abs(x) < DRIVE_HALF && z > 1.2;
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

    const renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, powerPreference: 'high-performance',
    });
    /* Capped at 2 (the dpr={[1, 2]} ceiling), raised from 1.5. That cap was set
       when bloom and depth of field each cost a full-res pass; with both gone
       the only post pass left is N8AO at half res, so the extra pixels buy
       genuinely sharper edges instead of being smeared away. Still a min() —
       a 3× phone would otherwise render 9 megapixels a frame. */
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    /* The sun never moves and the geometry only changes while the playhead does.
       Re-rendering a 2048² shadow map every frame to draw the SAME shadows is
       the single largest waste in this scene — park the update and only ask for
       it when the playhead has actually advanced. */
    renderer.shadowMap.autoUpdate = false;
    /* `transmission` makes three re-render the scene into a separate buffer every
       frame so the glass has something to refract. At full resolution that is the
       single most expensive thing in this scene. Halving it is nearly invisible —
       the result is being refracted through frosted-ish glass either way — and it
       is worth several frames a second. */
    renderer.transmissionResolutionScale = 0.5;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = skyTexture();
    /* Clear colour only — still NO FOG. You asked twice for the volumetric haze
       gone ("crystal clear view", "no heavy smoke"), so the off-white is the
       backdrop rather than a fog volume; the skyline's own haze tint (the
       SKY_BOT lerp on the tower instance colours) carries depth. */
    renderer.setClearColor(0xF1F5F9, 1);

    /* Environment map — a REAL HDRI (public/hdr/sky_1k.hdr, Poly Haven CC0).
       The procedural cityEnvironment goes in first so the scene is never unlit
       while the 1 MB file is in flight, then the HDRI replaces it. If the file is
       missing the fallback simply stays and the hero still renders — which is
       what makes the asset optional rather than a hard dependency. */
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = cityEnvironment(SUN);
    const envRT = pmrem.fromScene(envScene, 0.02);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.6;
    let hdrRT: THREE.WebGLRenderTarget | null = null;
    new RGBELoader().load(
      '/hdr/sky_1k.hdr',
      (hdr) => {
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        hdrRT = pmrem.fromEquirectangular(hdr);
        // REFLECTIONS ONLY — the flat gradient stays the visible sky so the
        // backdrop is an even studio field rather than a photographic horizon.
        scene.environment = hdrRT.texture;
        scene.environmentIntensity = 0.6;
        hdr.dispose();
      },
      undefined,
      () => { /* no HDRI on disk — keep the procedural environment */ }
    );

    /* Portrait phones see a much narrower slice of a 3/4 view, so a desktop FOV
       crops the road and the gate off the sides. Wider lens + a smaller world is
       what fits the whole site into a tall viewport. `world` scales everything
       EXCEPT the camera, which is equivalent to pulling the camera back but
       leaves every authored position in its own units. */
    const isPhone = () => window.innerWidth < 768;
    const camera = new THREE.PerspectiveCamera(isPhone() ? 65 : 45, 1, 0.1, 1000);
    const world = new THREE.Group();
    world.scale.setScalar(isPhone() ? 0.65 : 1);
    scene.add(world);

    /* ---- daylight ---------------------------------------------------------- */
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    // High and slightly front-left: long enough shadows to read the massing,
    // short enough that they never cross the copy in frame-left.
    sun.position.set(20, 40, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 140;   // the sun sits ~49 units out now
    sun.shadow.bias = -0.0001;
    sun.shadow.normalBias = 0.022;
    const shc = sun.shadow.camera as THREE.OrthographicCamera;
    shc.left = -15; shc.right = 15; shc.top = 17; shc.bottom = -13;
    shc.updateProjectionMatrix();
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdfe7f2, 0.35);   // sky bounce into the shadow side
    fill.position.set(-12, 8, -9);
    scene.add(fill);

    /* ---- PBR materials ----------------------------------------------------- */
    const conc = concreteMaps(256, [214, 217, 221]);
    const slabConc = concreteMaps(256, [203, 207, 213]);
    [conc, slabConc].forEach((m) => Object.values(m).forEach((t) => t.repeat.set(2, 2)));

    const concreteMat = new THREE.MeshStandardMaterial({
      ...conc, roughness: 0.85, metalness: 0, normalScale: new THREE.Vector2(0.7, 0.7),
    });
    const slabMat = new THREE.MeshStandardMaterial({
      ...slabConc, roughness: 0.85, metalness: 0, normalScale: new THREE.Vector2(0.6, 0.6),
    });
    const metalRough = metalRoughness();
    // Anisotropic, which is what "brushed" physically means — the highlight
    // stretches along the brush direction instead of staying a round hotspot.
    const steel = (color: number, rough = 0.2) => new THREE.MeshPhysicalMaterial({
      color, roughness: rough, metalness: 0.85, roughnessMap: metalRough, envMapIntensity: 1.45,
      anisotropy: 0.65, anisotropyRotation: Math.PI / 2,
    });
    const steelDark = steel(0x23272e);
    const steelRed = steel(ACCENT);
    const steelGrey = steel(0x9aa2ad, 0.25);
    const steelFrame = steel(0x3a4149, 0.22);   // dark metallic curtain-wall frame
    const rebarMat = new THREE.MeshStandardMaterial({ color: 0x6e4535, roughness: 0.45, metalness: 0.85, roughnessMap: metalRough });
    // Glass, to spec: ior 1.5, transmission 0.95, roughness 0.05.
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x8fb3cf, roughness: 0.05, metalness: 0.1,
      transmission: 0.9, thickness: 1.2, ior: 1.5, reflectivity: 0.9,
      // Clearcoat is the lacquer layer: a second, sharper specular on top of the
      // transmissive glass. It is what makes architectural glazing catch a hard
      // sun highlight instead of reading as tinted cellophane.
      clearcoat: 1, clearcoatRoughness: 0.03,
      transparent: true, side: THREE.DoubleSide, envMapIntensity: 1.0,
    });
    const ledMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.4, metalness: 0.1 });
    const lampMat = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.4, metalness: 0.1 });

    /* ---- ground, with a hole cut for the excavation ------------------------ */
    const GROUND = 240;                      // half-extent, world units
    const plot = new THREE.Shape();
    plot.moveTo(-GROUND, -GROUND); plot.lineTo(GROUND, -GROUND);
    plot.lineTo(GROUND, GROUND); plot.lineTo(-GROUND, GROUND);
    const hole = new THREE.Path();
    const hx = BW / 2 + 0.5, hz = BD / 2 + 0.5;
    hole.moveTo(-hx, -hz); hole.lineTo(-hx, hz); hole.lineTo(hx, hz); hole.lineTo(hx, -hz);
    plot.holes.push(hole);
    const groundGeo = new THREE.ShapeGeometry(plot).rotateX(-Math.PI / 2);
    // ShapeGeometry emits UVs in WORLD units; without this the repeat would be
    // meaningless and the ground would render as one flat colour.
    const guv = groundGeo.attributes.uv as THREE.BufferAttribute;
    const GUV = GROUND * 2;
    for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) / GUV, guv.getY(i) / GUV);
    /* Warm asphalt grey. Pale concrete out here left the site sitting on a
       white plane, which flattened every shadow it received — a mid-dark ground
       is what gives the massing its scale back. */
    // 0.25 tiles/unit. Density has to stay bounded as the ground grows: at
    // 1 tile/unit a 480-unit plane repeats a 256px map 480 times, which thrashes
    // the texture cache at grazing angles and cost ~17fps.
    const groundAsphalt = asphaltMaps(256);
    Object.values(groundAsphalt).forEach((x) => x.repeat.set(GUV * 0.25, GUV * 0.25));
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({
      ...groundAsphalt, color: 0x3A3F47, roughness: 0.85, metalness: 0,
      normalScale: new THREE.Vector2(0.6, 0.6),
    }));
    ground.receiveShadow = true;
    world.add(ground);

    /* Paved hardstanding inside the hoarding. Was churned gravel, which under a
       daylight sun left a brown yard wrapped around the finished tower — the
       one thing that stopped the last frame reading as a completed scheme. */
    const apronGeo = new THREE.PlaneGeometry(BW + 12, BD + 12).rotateX(-Math.PI / 2);
    const auv = apronGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < auv.count; i++) auv.setXY(i, auv.getX(i) * 9, auv.getY(i) * 9);
    const court = pavingMaps(256);
    Object.values(court).forEach((t) => t.repeat.set(6, 6));
    const apron = new THREE.Mesh(apronGeo, new THREE.MeshStandardMaterial({
      ...court, color: 0xd3d7dc, roughness: 0.8, metalness: 0, normalScale: new THREE.Vector2(0.6, 0.6),
    }));
    apron.position.y = 0.004; apron.receiveShadow = true;
    world.add(apron);

    const lawn = grassMaps(256);
    Object.values(lawn).forEach((x) => x.repeat.set(70, 4));
    const lawnMat = new THREE.MeshStandardMaterial({
      ...lawn, roughness: 0.94, metalness: 0, normalScale: new THREE.Vector2(0.55, 0.55),
    });
    /* Turf verges either side of the carriageway. Length matches the run of
       road that is ever in frame — at 26 they ended mid-shot, which read as two
       green rugs dropped on the asphalt rather than a planted street edge. */
    ([[6.0, 140, 1.2], [10.0, 140, 1.4]] as const).forEach(([lz, lw, ld]) => {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld).rotateX(-Math.PI / 2), lawnMat);
      g.position.set(-6, 0.009, lz);
      g.receiveShadow = true;
      world.add(g);
    });

    // Concrete blinding pad under the building. Sized to OVERLAP the excavation
    // rim — this is what closes the raw edge where the plot hole met the ground.
    const paving = pavingMaps(256);
    Object.values(paving).forEach((x) => x.repeat.set(5, 3.4));
    const pavingMat = new THREE.MeshStandardMaterial({
      ...paving, roughness: 0.88, metalness: 0, normalScale: new THREE.Vector2(0.9, 0.9),
    });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(BW + 2.2, 0.12, BD + 2.2), pavingMat);
    pad.position.y = 0.008;
    pad.receiveShadow = true;
    world.add(pad);

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
    world.add(marks);

    const podium = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 + 0.1, 0.26, hz * 2 + 0.1), concreteMat);
    podium.position.y = -0.13;
    podium.receiveShadow = podium.castShadow = true;
    podium.visible = false;
    world.add(podium);

    const pit = new THREE.Mesh(
      new THREE.BoxGeometry(hx * 2, PIT, hz * 2),
      new THREE.MeshStandardMaterial({ color: 0x8a7a63, roughness: 1, side: THREE.BackSide })
    );
    pit.position.y = -PIT / 2;
    world.add(pit);

    /* Footway between the plot and the kerb. */
    const walk = new THREE.Mesh(new THREE.BoxGeometry(140, 0.09, 1.5), pavingMat);
    walk.position.set(-6, 0.045, 2.0);
    walk.rotation.y = 0.031;
    walk.receiveShadow = true;
    world.add(walk);
    const kerbStone = new THREE.Mesh(new THREE.BoxGeometry(140, 0.14, 0.16), concreteMat);
    kerbStone.position.set(-6, 0.07, 5.95);
    kerbStone.rotation.y = 0;
    kerbStone.castShadow = kerbStone.receiveShadow = true;
    world.add(kerbStone);

    /* Low boundary wall with a clipped hedge on top — the street edge. Instanced
       hedge blocks so the run costs one draw call. */
    const wall = new THREE.Mesh(new THREE.BoxGeometry(15, 0.55, 0.22), concreteMat);
    wall.position.set(-9.5, 0.275, 1.25);
    wall.rotation.y = 0.031;
    wall.castShadow = wall.receiveShadow = true;
    wall.visible = false;
    world.add(wall);
    const HEDGE = 26;
    const hedgeIM = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.58, 0.42, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x3f6b40, roughness: 0.97, flatShading: true }),
      HEDGE
    );
    hedgeIM.castShadow = hedgeIM.receiveShadow = true;
    hedgeIM.visible = false;
    {
      const hm = new THREE.Matrix4(), hq = new THREE.Quaternion();
      hq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.031);
      for (let i = 0; i < HEDGE; i++) {
        const jitter = 0.86 + ((i * 7) % 5) * 0.07;   // clipped, but not machined
        hm.compose(
          new THREE.Vector3(-13.2 + i * 0.55, 0.7 + ((i * 3) % 3) * 0.035, 1.25 + i * 0.017),
          hq, new THREE.Vector3(1.04, jitter, 1.04)
        );
        hedgeIM.setMatrixAt(i, hm);
      }
      hedgeIM.instanceMatrix.needsUpdate = true;
    }
    world.add(hedgeIM);

    /* ---- P1 · glowing blueprint, plan grid, hoarding ------------------------ */
    const bpTex = blueprintTexture();
    const blueprint = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 4.4).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({
        map: bpTex,
        roughness: 0.95, transparent: true, opacity: 0,
      })
    );
    blueprint.position.set(BW / 2 + 2.4, 0.012, BD / 2 + 1.4);
    blueprint.rotation.y = 0.32;
    blueprint.receiveShadow = true;
    world.add(blueprint);

    const grid = new THREE.GridHelper(BW, 8, ACCENT, ACCENT);
    grid.position.y = 0.016;
    grid.scale.z = BD / BW;
    const gridMat = grid.material as THREE.LineBasicMaterial;
    gridMat.transparent = true;
    gridMat.depthWrite = false;
    world.add(grid);

    const FENCE: { x: number; z: number; ry: number }[] = [];
    const fx = BW / 2 + 2.9, fz = BD / 2 + 2.6, PANEL = 1.6;
    const GATE_HALF = 1.75;      // opening half-width on the entrance axis
    for (let x = -fx; x < fx; x += PANEL) {
      const cx = x + PANEL / 2;
      FENCE.push({ x: cx, z: -fz, ry: 0 });
      // Skip the run that crosses the entrance — that gap is the gateway.
      if (Math.abs(cx) > GATE_HALF) FENCE.push({ x: cx, z: fz, ry: 0 });
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
    world.add(panelMesh, postMesh);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc3 = new THREE.Vector3();
    const YAXIS = new THREE.Vector3(0, 1, 0);
    const setFence = (k: number, clear = 0) => {
      panelMesh.visible = postMesh.visible = k > 0.002 && clear < 0.82;
      if (!panelMesh.visible) return;
      // Struck panels lift and travel outward off the plot.
      const ox = clear * 4.5, oy = clear * 2.2;
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

    /* The gate itself: two leaves hung on posts in the hoarding gap, swinging
       OUTWARD (away from the compound) as the build completes — which is both
       how a site gate actually opens and what clears the car's path. */
    const gatePostMat = steel(0x8f9bab, 0.5);
    const gateBarMat = steel(0xc8102e, 0.35);
    const gate = new THREE.Group();
    const gateLeaves: THREE.Group[] = [];
    ([-1, 1] as const).forEach((side) => {
      const leaf = new THREE.Group();
      const w = GATE_HALF - 0.06;
      // Frame + vertical bars, built from the hinge outward so rotation.y swings
      // the leaf about its hinge rather than its centre.
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.07), gateBarMat);
      [0.28, 1.22].forEach((y) => {
        const r = rail.clone(); r.position.set(-side * w / 2, y, 0); r.castShadow = true;
        leaf.add(r);
      });
      for (let i = 0; i <= 6; i++) {
        const bar = new THREE.Mesh(upright(new THREE.BoxGeometry(0.045, 1.35, 0.045), 1.35), gatePostMat);
        bar.position.set(-side * (0.06 + (i / 6) * (w - 0.12)), 0, 0);
        bar.castShadow = true;
        leaf.add(bar);
      }
      leaf.position.set(side * GATE_HALF, 0, fz);
      gate.add(leaf);
      gateLeaves.push(leaf);
    });
    ([-1, 1] as const).forEach((side) => {
      const post = new THREE.Mesh(upright(new THREE.BoxGeometry(0.14, 1.7, 0.14), 1.7), gatePostMat);
      post.position.set(side * GATE_HALF, 0, fz);
      post.castShadow = true;
      gate.add(post);
    });
    world.add(gate);

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
        world.add(f, cage, c);
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
      world.add(m, bm); slabs.push(m); beams.push(bm);
    }

    /* ---- P4 · curtain wall that SLIDES in, pane by pane ----------------------- */
    const plateGeo = new THREE.BoxGeometry(BW - 0.55, 0.07, BD - 0.55);
    const plates = Array.from({ length: FLOORS }, (_, k) => {
      const m = new THREE.Mesh(plateGeo, ledMat);
      m.position.y = (k + 1) * FH - 0.3;
      m.scale.set(0.0001, 1, 0.0001);
      world.add(m);
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
          world.add(m);
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
        world.add(m); mullions.push(m);
      });
    }
    for (let i = 1; i < 4; i++) {
      const z = mix(-BD / 2, BD / 2, i / 4);
      [-BW / 2, BW / 2].forEach((x) => {
        const m = new THREE.Mesh(postGeo, steelFrame);
        m.position.set(x, 0, z); m.scale.y = 0.0001; m.castShadow = true;
        world.add(m); mullions.push(m);
      });
    }

    const roofMat = new THREE.MeshStandardMaterial({
      ...slabConc, color: 0x9fa5ad, roughness: 0.95, metalness: 0,
      normalScale: new THREE.Vector2(0.6, 0.6),
    });
    /* Spandrel panels: the solid band between one floor's glazing and the
       next. Without them a curtain wall reads as one undivided sheet of glass;
       with them it reads as storeys. */
    const spandrelMat = steel(0x2a2f37, 0.35);
    const spandrels: THREE.Mesh[] = [];
    for (let k = 1; k <= FLOORS; k++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.12, 0.3, BD + 0.12), spandrelMat);
      s.position.y = k * FH - 0.02;
      s.castShadow = true;
      s.scale.set(0.0001, 1, 0.0001);
      world.add(s); spandrels.push(s);
    }

    const roof = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.25, 0.22, BD + 0.25), roofMat);
    roof.position.y = TOP; roof.castShadow = true; roof.scale.setScalar(0.0001);
    world.add(roof);

    /* Brand sign on the parapet fascia. `alphaMap` is what makes it read as an
       applied wordmark — the plane is invisible except where the letters are, so
       the white board behind carries them. Matte and unlit: the artwork is now
       two-tone (crimson mark, charcoal ALIPSON, crimson BUILDERS) and a crimson
       emissive over the top would flatten all three back to one red. */
    const brand = brandTexture(2048, 512);   // 2× the old map: the sign is the one texture read at close range
    const brandMat = new THREE.MeshStandardMaterial({
      map: brand.map, alphaMap: brand.alpha, transparent: true,
      color: 0xffffff, roughness: 0.8, metalness: 0,
      depthWrite: false, side: THREE.DoubleSide,
    });
    /* Signage board BEHIND the lettering, in three stacked planes: a dark red
       frame, a white matte face inset from it, and the artwork on top. The board
       exists because the sign used to sit straight on the curtain wall, where
       the glazing's reflections read through the gaps in the letterforms.
       roughness 0.8 / metalness 0 so the face stays matte — a glossy board picks
       up the same hard specular the glass does, which is what made it sparkle. */
    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(6.31, 1.94),
      new THREE.MeshStandardMaterial({ color: 0x8E0C22, roughness: 0.45, metalness: 0.35 })
    );
    frame.position.set(0, TOP - 0.68, BD / 2 + 0.108);
    frame.visible = false;
    world.add(frame);

    const fascia = new THREE.Mesh(
      new THREE.PlaneGeometry(6.15, 1.78),
      new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.8, metalness: 0 })
    );
    fascia.position.set(0, TOP - 0.68, BD / 2 + 0.113);
    fascia.visible = false;
    world.add(fascia);

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.75, 1.44), brandMat);
    sign.position.set(0, TOP - 0.68, BD / 2 + 0.116);
    sign.visible = false;
    world.add(sign);

    /* The seventh floor is the one still being built: exposed stub columns
       carrying on past the top slab, and a perimeter edge-protection rail. This
       is what stops a 7-storey block reading as finished-and-capped the moment
       the roof lands. */
    const topWorks = new THREE.Group();
    {
      const railMat = steel(0xf0a81e, 0.35);
      ([-1, 1] as const).forEach((sx) => ([-1, 1] as const).forEach((sz) => {
        const stub = new THREE.Mesh(
          upright(new THREE.BoxGeometry(0.16, 0.72, 0.16), 0.72), steelFrame
        );
        stub.position.set(sx * (BW / 2 - 0.45), TOP, sz * (BD / 2 - 0.45));
        stub.castShadow = true;
        topWorks.add(stub);
      }));
      // Guardrail: top rail, mid rail, posts — the three-part set you actually
      // see on an open slab edge.
      ([[BW + 0.2, 0.06, 0, BD / 2 + 0.1], [BW + 0.2, 0.06, 0, -BD / 2 - 0.1]] as const)
        .forEach(([len, th, x, z]) => {
          [0.44, 0.78].forEach((h) => {
            const r = new THREE.Mesh(new THREE.BoxGeometry(len, th, th), railMat);
            r.position.set(x, TOP + h, z);
            topWorks.add(r);
          });
        });
      for (let i = 0; i <= 6; i++) {
        const x = mix(-BW / 2 - 0.1, BW / 2 + 0.1, i / 6);
        ([BD / 2 + 0.1, -BD / 2 - 0.1] as const).forEach((z) => {
          const post = new THREE.Mesh(upright(new THREE.BoxGeometry(0.05, 0.82, 0.05), 0.82), railMat);
          post.position.set(x, TOP, z);
          post.castShadow = true;
          topWorks.add(post);
        });
      }
    }
    topWorks.visible = false;
    world.add(topWorks);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 1.3), steelDark);
    canopy.position.set(0, 1.05, BD / 2 + 0.55);
    canopy.castShadow = true; canopy.scale.setScalar(0.0001);
    world.add(canopy);

    /* Crimson rim light (#C8102E) on the building's edges. Emissive strips run
       along each slab's leading edge and up the two front corners — the read is
       architectural edge lighting, which is a real thing on commercial façades,
       rather than a coloured glow pasted over the model. */
    const RIM = 0xc8102e;
    const rimMat = new THREE.MeshStandardMaterial({
      color: RIM, roughness: 0.4, metalness: 0.1,
    });
    const rims: THREE.Mesh[] = [];
    for (let k = 1; k <= FLOORS; k++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.12, 0.028, 0.04), rimMat);
      m.position.set(0, k * FH - 0.2, BD / 2 + 0.075);
      m.visible = false;
      world.add(m); rims.push(m);
    }
    ([[BW / 2 + 0.06, BD / 2 + 0.06], [-BW / 2 - 0.06, BD / 2 + 0.06]] as const).forEach(([x, z]) => {
      const m = new THREE.Mesh(upright(new THREE.BoxGeometry(0.045, TOP, 0.045), TOP), rimMat);
      m.position.set(x, 0, z);
      m.visible = false;
      world.add(m); rims.push(m);
    });

    /* ---- tower cranes ---------------------------------------------------------
       Two machines off one builder. `mast` is the only thing that differs
       structurally; `payload` hangs a beam off the hook block, which is what
       separates a crane that is standing there from a crane that is working. */
    const makeCrane = ({ mast: MAST, payload = false }: { mast: number; payload?: boolean }) => {
      const crane = new THREE.Group();
      const SEC = 0.42;
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
      const HOIST = payload ? MAST - TOP - 0.71 : 4.2;   // beam rides ~1.2 above the slab
      const hoist = new THREE.Mesh(upright(new THREE.CylinderGeometry(0.016, 0.016, HOIST, 5), HOIST), steelDark);
      hoist.position.set(4.2, 0.34 - HOIST, 0);
      const hookBlock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.24), steelGrey);
      hookBlock.position.set(4.2, 0.34 - HOIST - 0.15, 0); hookBlock.castShadow = true;
      slew.add(cab, cabGlass, jib, cJib, cWeight, apex, tie(6.2), tie(3.2), tie(-2.6), hoist, hookBlock);
      // Red aviation indicator lamps: apex, jib tip, counter-jib tip.
      ([[0, 2.0, 0], [6.5, 0.34, 0], [-3.1, 0.34, 0]] as const).forEach(([x, y, z]) => {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), lampMat);
        lamp.position.set(x, y, z);
        slew.add(lamp);
      });
      // Brand rim on the mast legs, same crimson as the building's edges.
      const craneRim = new THREE.MeshStandardMaterial({
        color: 0xc8102e, roughness: 0.4, metalness: 0.1,
      });
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, MAST * 0.96, 0.03), craneRim);
        strip.position.set(sx * SEC / 2 * 1.35, 0.3 + MAST * 0.48, sz * SEC / 2 * 1.35);
        crane.add(strip);
      });
      if (payload) {
        /* A steel beam slung under the hook, swinging over the roof. Two slings
           from the block to the beam ends — a beam hanging off a single point
           reads as stuck to the hook rather than lifted by it. */
        const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.22), steelRed);
        beam.position.set(4.2, 0.34 - HOIST - 0.95, 0);
        beam.castShadow = true;
        const sling = (x: number) => new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(4.2, 0.34 - HOIST - 0.28, 0), new THREE.Vector3(x, 0.34 - HOIST - 0.88, 0),
          ]), cableMat
        );
        slew.add(beam, sling(3.25), sling(5.15));
      }
      crane.add(slew);
      crane.userData.slew = slew;
      crane.scale.setScalar(0.0001);
      world.add(crane);
      return crane;
    };
    /* ONE crane. It stands off the back-right corner, clears floor 7 by a full
       jib height, and carries a beam over the roof — a single working machine
       reads better than two competing for the same skyline. */
    const crane = makeCrane({ mast: TOP + 3.6, payload: true });
    const CRANE_HOME = new THREE.Vector3(BW / 2 + 2.6, 0, -BD / 2 - 1.9);
    crane.position.copy(CRANE_HOME);

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
      // Brand accent stripe along the tank, tying the plant to the building.
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.055, 0.05), new THREE.MeshStandardMaterial({
        color: 0xc8102e, emissive: 0xc8102e, emissiveIntensity: 0.12, roughness: 0.35, metalness: 0.6,
      }));
      stripe.position.set(-0.5, 1.32, 0.6);
      const stripe2 = stripe.clone();
      stripe2.position.z = -0.6;
      g.add(chute, ladder, stripe, stripe2);
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
      world.add(g);
      return g;
    });

    /* ---- P5 · landscaping ------------------------------------------------------
       Trees are INSTANCED: one draw call for every trunk and one for every
       canopy clump on the site. That is what makes a dense canopy affordable —
       the old version was one sphere per tree because 14 groups of nine meshes
       was already 126 draw calls, and a single sphere is exactly what reads as
       "low-poly game tree". Here each tree carries 16-22 small clumps at varied
       radius, height and scale, which is what breaks the sphere silhouette. */
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a7a49, roughness: 0.92, flatShading: true });

    type Clump = { p: THREE.Vector3; s: THREE.Vector3; tint: number };
    type Tree = { pos: THREE.Vector3; rot: number; tall: number; clumps: Clump[] };
    const TREES: Tree[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.5 + ((i * 2.399) % 0.6);
      const rad = 7.2 + ((i * 3.1) % 2.6);
      let tx = Math.cos(a) * rad, tz = Math.sin(a) * rad * 0.84;
      // Mirror anything standing in the driveway to the back of the plot, so
      // the run from the bay through the gate is completely clear.
      if (inDriveway(tx, tz)) { tz = -Math.abs(tz) - 2.0; tx *= 0.85; }
      const tall = 0.9 + ((i * 1.7) % 1) * 0.8;
      const clumps: Clump[] = [];
      const n = 16 + (i % 3) * 3;
      for (let c = 0; c < n; c++) {
        // Distribute on a squashed, jittered ellipsoid — not a shell, so the
        // canopy has depth rather than reading as a hollow ball.
        const u = (c + 0.5) / n;
        const th = u * Math.PI * 2 * 2.399 + i;
        const ph = Math.acos(1 - 1.35 * u);
        const rr = (0.34 + ((c * 1.7) % 1) * 0.34);
        clumps.push({
          p: new THREE.Vector3(
            Math.sin(ph) * Math.cos(th) * rr,
            (1.42 + Math.cos(ph) * 0.5 + ((c * 2.3) % 1) * 0.3) * tall,
            Math.sin(ph) * Math.sin(th) * rr * 0.9
          ),
          s: new THREE.Vector3(
            0.3 + ((i + c) % 5) * 0.055,
            0.24 + ((i + c * 3) % 5) * 0.045,
            0.3 + ((i * 2 + c) % 5) * 0.055
          ),
          tint: 0.82 + ((i * 3 + c) % 5) * 0.09,
        });
      }
      TREES.push({ pos: new THREE.Vector3(tx, 0, tz), rot: (i * 1.1) % 6.28, tall, clumps });
    }
    const CLUMP_TOTAL = TREES.reduce((s, x) => s + x.clumps.length, 0);
    const trunkIM = new THREE.InstancedMesh(
      upright(new THREE.CylinderGeometry(0.055, 0.12, 1.6, 7), 1.6), barkMat, TREES.length
    );
    const canopyIM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), leafMat, CLUMP_TOTAL);
    canopyIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CLUMP_TOTAL * 3), 3);
    trunkIM.castShadow = canopyIM.castShadow = true;
    canopyIM.receiveShadow = true;
    world.add(trunkIM, canopyIM);
    {
      // Per-clump tint, written once — varied greens are most of what separates
      // a stand of trees from fourteen copies of one tree.
      let k = 0;
      const col = new THREE.Color();
      TREES.forEach((tr) => tr.clumps.forEach((c) => {
        col.setHex(0x4a7a49).multiplyScalar(c.tint);
        canopyIM.instanceColor!.setXYZ(k++, col.r, col.g, col.b);
      }));
      canopyIM.instanceColor!.needsUpdate = true;
    }
    /* Low planting between the trees — a bare kerb line under a tree canopy is
       one of the things that reads as "assets floating on a plane". */
    const SHRUBS: { p: THREE.Vector3; s: THREE.Vector3 }[] = [];
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + 0.22;
      const rad = 5.9 + ((i * 2.7) % 1.9);
      let sx = Math.cos(a) * rad, sz = Math.sin(a) * rad * 0.86;
      if (inDriveway(sx, sz)) { sz = -Math.abs(sz) - 1.8; sx *= 0.85; }   // clear the driveway
      SHRUBS.push({
        p: new THREE.Vector3(sx, 0.1 + ((i * 3.1) % 1) * 0.06, sz),
        s: new THREE.Vector3(0.2 + ((i * 5) % 4) * 0.05, 0.14 + ((i * 7) % 4) * 0.035, 0.2 + ((i * 11) % 4) * 0.05),
      });
    }
    const shrubIM = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: 0x3f6b40, roughness: 0.95, flatShading: true }),
      SHRUBS.length
    );
    shrubIM.castShadow = shrubIM.receiveShadow = true;
    world.add(shrubIM);

    const tq = new THREE.Quaternion(), tv = new THREE.Vector3(), ts = new THREE.Vector3(), tm = new THREE.Matrix4();
    const setTrees = (grow: (i: number) => number) => {
      let k = 0;
      TREES.forEach((tr, i) => {
        const g = s0(grow(i));
        tq.setFromAxisAngle(YAXIS, tr.rot);
        tm.compose(tr.pos, tq, ts.set(g, g * tr.tall, g));
        trunkIM.setMatrixAt(i, tm);
        tr.clumps.forEach((c) => {
          tv.copy(c.p).multiplyScalar(g).add(tr.pos);
          tm.compose(tv, tq, ts.copy(c.s).multiplyScalar(g));
          canopyIM.setMatrixAt(k++, tm);
        });
      });
      trunkIM.instanceMatrix.needsUpdate = true;
      canopyIM.instanceMatrix.needsUpdate = true;
      trunkIM.visible = canopyIM.visible = true;
      // Shrubs come in slightly ahead of the trees, so the ground is planted
      // before the canopy arrives rather than everything popping at once.
      SHRUBS.forEach((sh, i) => {
        const g = s0(grow(i % TREES.length) * 1.15);
        tm.compose(sh.p, tq.identity(), ts.copy(sh.s).multiplyScalar(Math.min(1, g)));
        shrubIM.setMatrixAt(i, tm);
      });
      shrubIM.instanceMatrix.needsUpdate = true;
    };

    /* ---- scale figures ------------------------------------------------------
       The cheapest realism win in architectural visualisation: without a human,
       a five-storey block and a garden shed render identically. Matte dark
       silhouettes, which is how arch-viz sheets show them anyway — and which
       sidesteps the uncanny-valley problem of low-poly faces.
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
    /* Site workers. Same silhouette as the neutral figures, plus the two things
       that actually identify one at this scale: a hi-vis torso and a hard hat.
       Both are flat colour on the existing geometry — no extra meshes beyond the
       hat, so a worker costs one more draw call than a bystander. */
    const vestMats = [0xffd21e, 0xff7a18].map((c) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0 }));
    const hatMats = [0xffd21e, 0xc8102e].map((c) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0 }));
    const hatGeo = new THREE.SphereGeometry(0.062, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const brimGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.012, 10);
    const makeWorker = (i: number) => {
      const f = new THREE.Group();
      const torso = new THREE.Mesh(torsoGeo, vestMats[i % 2]);
      torso.position.y = 0.24; torso.castShadow = true;
      const head = new THREE.Mesh(headGeo, figMat);
      head.position.y = 0.5; head.castShadow = true;
      const hat = new THREE.Mesh(hatGeo, hatMats[i % 2]);
      hat.position.y = 0.52; hat.castShadow = true;
      const brim = new THREE.Mesh(brimGeo, hatMats[i % 2]);
      brim.position.y = 0.522;
      [-0.032, 0.032].forEach((x) => {
        const leg = new THREE.Mesh(legGeo, figMat);
        leg.position.set(x, 0, 0); leg.castShadow = true;
        f.add(leg);
      });
      f.add(torso, head, hat, brim);
      return f;
    };

    // Two populations: crew on site during the build, visitors at handover.
    const crew: THREE.Object3D[] = [], visitors: THREE.Object3D[] = [];
    ([[-2.4, 3.6], [2.9, 3.2], [-3.6, -2.2], [3.4, -2.8]] as const).forEach(([x, z]) => {
      const f = makeFigure();
      f.position.set(x, 0, z);
      f.rotation.y = Math.atan2(-x, -z);
      f.scale.setScalar(0.0001);
      world.add(f); crew.push(f);
    });
    /* Six workers, placed by what they would actually be doing: two on the top
       slab, two at the gate end of the scaffold, two out by the mixers. `y` is
       explicit because the roof pair stands on the structure, not the ground. */
    const workers: THREE.Object3D[] = [];
    ([
      [-1.5, -0.7, TOP], [1.2, 0.4, TOP],                 // top slab
      [-BW / 2 - 1.0, BD / 2 + 0.9, 0], [-1.9, BD / 2 + 1.7, 0],   // scaffold / gate
      [-4.4, 5.1, 0], [4.6, 4.7, 0],                      // beside the mixers
    ] as const).forEach(([x, z, y], i) => {
      const f = makeWorker(i);
      f.position.set(x, y, z);
      f.rotation.y = Math.atan2(-x, -z) + (i % 2 ? 0.5 : -0.4);
      f.scale.setScalar(0.0001);
      world.add(f); workers.push(f);
    });

    ([[-1.2, 4.4], [0.5, 4.9], [1.9, 4.2], [-2.6, 4.9], [3.1, 3.9]] as const).forEach(([x, z]) => {
      const f = makeFigure();
      f.position.set(x, 0, z);
      f.rotation.y = Math.atan2(-x, -z) + 0.3;
      f.scale.setScalar(0.0001);
      world.add(f); visitors.push(f);
    });

    /* ---- ambient ground lighting (comes on with the handover) ---------------- */
    const bollardMat = new THREE.MeshStandardMaterial({ color: 0xe9ecf0, roughness: 0.4, metalness: 0.1 });
    const bollardGeo = upright(new THREE.CylinderGeometry(0.04, 0.06, 0.3, 8), 0.3);
    const bollards: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const side = i < 5 ? -1 : 1;
      const b = new THREE.Mesh(bollardGeo, bollardMat);
      b.position.set(side * 1.9, 0, BD / 2 + 1.1 + (i % 5) * 0.42);
      b.castShadow = true;
      b.scale.setScalar(0.0001);
      world.add(b); bollards.push(b);
    }

    /* Street lighting down the carriageway — columns and unlit heads. In
       daylight these are street furniture, not light sources. */
    const streetMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.5, metalness: 0.7 });
    const streetLampMat = new THREE.MeshStandardMaterial({
      color: 0xe9ecf0, roughness: 0.4, metalness: 0.1,
    });
    {
      const COLUMNS = 34, SPACING = 15;
      const colGeoS = upright(new THREE.CylinderGeometry(0.05, 0.08, 5.2, 6), 5.2);
      const armGeo = new THREE.BoxGeometry(0.9, 0.08, 0.1);
      const headGeoS = new THREE.BoxGeometry(0.44, 0.1, 0.22);
      const poleIM = new THREE.InstancedMesh(colGeoS, streetMat, COLUMNS);
      const armIM = new THREE.InstancedMesh(armGeo, streetMat, COLUMNS);
      const headIM = new THREE.InstancedMesh(headGeoS, streetLampMat, COLUMNS);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < COLUMNS; i++) {
        const x = -250 + i * SPACING;
        const z = ROAD_Z + ROAD_HALF + 0.9;
        m.compose(v.set(x, 0, z), q, sc); poleIM.setMatrixAt(i, m);
        m.compose(v.set(x, 5.15, z - 0.45), q, sc); armIM.setMatrixAt(i, m);
        m.compose(v.set(x, 5.05, z - 0.88), q, sc); headIM.setMatrixAt(i, m);
      }
      [poleIM, armIM, headIM].forEach((im) => { im.instanceMatrix.needsUpdate = true; im.castShadow = true; world.add(im); });
    }

    /* ---- background site environment ------------------------------------------
       A 3D city skyline, scaffold rigs with safety netting against the building,
       and site light poles. All of it sits OUTSIDE the hoarding so it reads as
       context, and none of it crosses the left third of frame where the hero
       copy lives.                                                               */
    /* REAL 3D SKYLINE. The previous version was an alpha-mapped cylinder — a
       flat 2D silhouette strip, which is exactly the "flat grey backdrop shape"
       problem. These are actual boxes with depth, receiving the same sun and the
       same environment, so they sit in the world instead of being painted on it.
       InstancedMesh: ~90 towers for one draw call. */
    const CITY = 92;
    const cityGeo = new THREE.BoxGeometry(1, 1, 1);
    const fac = facadeTexture(256);
    fac.map.repeat.set(3, 6);
    fac.emissive.repeat.set(3, 6);
    const cityMat = new THREE.MeshStandardMaterial({
      map: fac.map,
      color: 0xb6c0cc, roughness: 0.4, metalness: 0.1, envMapIntensity: 1.0,
    });
    const cityIM = new THREE.InstancedMesh(cityGeo, cityMat, CITY);
    cityIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CITY * 3), 3);
    cityIM.castShadow = false; cityIM.receiveShadow = false;
    {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < CITY; i++) {
        // Three loose rings at different depths so the skyline has parallax
        // rather than sitting on one plane.
        const ring = i % 3;
        const a = (i / CITY) * Math.PI * 2 * 3.13 + ring * 0.7;
        const rad = 86 + ring * 22 + ((i * 7) % 14);
        const hgt = 6 + ((i * 13) % 18) + ring * 3;
        const w = 6 + ((i * 5) % 8), d = 6 + ((i * 3) % 7);
        q.setFromAxisAngle(up, a + 0.4);
        m.compose(
          new THREE.Vector3(Math.cos(a) * rad, hgt / 2, Math.sin(a) * rad),
          q, new THREE.Vector3(w, hgt, d)
        );
        cityIM.setMatrixAt(i, m);
        // Fade toward the haze colour with distance — cheap aerial perspective.
        const haze = Math.min(1, (rad - 84) / 60);
        col.setHex(0x8f9cae).lerp(new THREE.Color(SKY_BOT), haze * 0.55);
        cityIM.instanceColor.setXYZ(i, col.r, col.g, col.b);
      }
      cityIM.instanceMatrix.needsUpdate = true;
      cityIM.instanceColor.needsUpdate = true;
    }
    world.add(cityIM);

    /* Alipson red crown banding on a subset of the background towers — painted
       trim, one draw call, the brand colour picked up across the skyline. */
    const ACCENTS = 22;
    const accentIM = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.4, metalness: 0.1 }),
      ACCENTS
    );
    {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
      for (let j = 0; j < ACCENTS; j++) {
        const i = j * 4 + 1;                       // every fourth tower
        const ring = i % 3;
        const a = (i / CITY) * Math.PI * 2 * 3.13 + ring * 0.7;
        const rad = 86 + ring * 22 + ((i * 7) % 14);
        const hgt = 6 + ((i * 13) % 18) + ring * 3;
        const w = 6 + ((i * 5) % 8), d = 6 + ((i * 3) % 7);
        q.setFromAxisAngle(up, a + 0.4);
        m.compose(
          new THREE.Vector3(Math.cos(a) * rad, hgt - 0.45, Math.sin(a) * rad),
          q, new THREE.Vector3(w * 1.01, 0.5, d * 1.01)
        );
        accentIM.setMatrixAt(j, m);
      }
      accentIM.instanceMatrix.needsUpdate = true;
    }
    world.add(accentIM);

    // Scaffold rigs: standards, ledgers and boards, with netting stretched over.
    const scaffoldMat = steel(0xa8a093, 0.4);
    const nettingMat = new THREE.MeshStandardMaterial({
      color: 0x3f7f5a, roughness: 0.95, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false,
    });
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xa88a5c, roughness: 0.95 });
    const scaffolds = ([[-BW / 2 - 0.75, 0, Math.PI / 2, BD], [0, -BD / 2 - 0.75, 0, BW]] as const).map(([sx, sz, ry, len]) => {
      const g = new THREE.Group();
      const LIFTS = FLOORS, BAY = len / 2;
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
      world.add(g);
      return g;
    });

    // Site light poles with hazard lamps at the head.
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xffa524, roughness: 0.4, metalness: 0.1 });
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
      world.add(g);
      return g;
    });

    /* ---- handover: parking bay, road, and the car that drives out -------------
       The climax beat. The car is parked in the newly revealed bay as the build
       finishes, then drives out along a Catmull-Rom path during the STATS TAIL —
       so the drive-out and the stats reveal are the same gesture, not two.      */
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 3.4).rotateX(-Math.PI / 2),
      (() => {
        const a = asphaltMaps(256);
        Object.values(a).forEach((x) => x.repeat.set(130, 2));   // ~0.25 tiles/unit
        // Wet look: a smooth clearcoat over rough tarmac, so the surface
        // holds a sharp reflection of the sky and the lamps while the aggregate
        // underneath stays matte. Uniform low roughness reads as plastic.
        return new THREE.MeshPhysicalMaterial({
          ...a, roughness: 0.34, metalness: 0.1, normalScale: new THREE.Vector2(0.5, 0.5),
          clearcoat: 0.9, clearcoatRoughness: 0.18, envMapIntensity: 1.2,
        });
      })()
    );
    road.position.set(0, 0.006, 7.8);
    road.rotation.y = 0.06;
    road.rotation.z = 0;
    road.receiveShadow = true;
    world.add(road);
    // Centre line, dashed.
    /* Road markings. Everything straight and axis-aligned — the previous set
       carried a 0.031 rad yaw and a per-dash z drift that the road plane itself
       did not have, so the paint slowly walked off the asphalt.
       Layout: dashed centre line, solid boundary line at each edge, and a zebra
       crossing on the building's entrance axis. */
    const paintMat = new THREE.MeshStandardMaterial({
      color: 0xf4f2ea, roughness: 0.4, metalness: 0.1,
    });
    type Paint = { x: number; z: number; w: number; d: number };
    const PAINT: Paint[] = [];
    // Dashed centre, running the whole carriageway.
    const ROAD_X0 = -250, ROAD_X1 = 250;
    for (let x = ROAD_X0; x < ROAD_X1; x += 3.1) {
      if (Math.abs(x) < 2.6) continue;      // keep the zebra's footprint clear
      PAINT.push({ x, z: ROAD_Z, w: 1.5, d: 0.075 });
    }
    // Solid boundary lines, built from long overlapping segments.
    ([-1, 1] as const).forEach((s) => {
      for (let x = ROAD_X0; x < ROAD_X1; x += 5.9) {
        PAINT.push({ x, z: ROAD_Z + s * (ROAD_HALF - 0.16), w: 6.0, d: 0.085 });
      }
    });
    // Zebra crossing, straddling the entrance axis (x = 0), bars across the road.
    for (let i = 0; i < 7; i++) {
      PAINT.push({ x: -1.5 + i * 0.5, z: ROAD_Z, w: 0.28, d: ROAD_HALF * 2 - 0.34 });
    }
    const markIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.01, 1), paintMat, PAINT.length);
    {
      const mm = new THREE.Matrix4(), mq = new THREE.Quaternion(), mv = new THREE.Vector3(), ms = new THREE.Vector3();
      PAINT.forEach((p, i) => {
        mm.compose(mv.set(p.x, 0.014, p.z), mq, ms.set(p.w, 1, p.d));
        markIM.setMatrixAt(i, mm);
      });
      markIM.instanceMatrix.needsUpdate = true;
    }
    markIM.receiveShadow = true;
    world.add(markIM);

    // Parking bay markings on the plaza, to the left of the entry path.
    const bayMat = new THREE.MeshStandardMaterial({ color: 0xf0f2f4, roughness: 0.9 });
    const bay = new THREE.Group();
    for (let i = 0; i <= 2; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 1.7), bayMat);
      l.position.set(-0.95 + i * 0.95, 0.02, 3.0);
      bay.add(l);
    }
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.01, 0.05), bayMat);
    kerb.position.set(-4.6, 0.02, 1.35);
    bay.add(kerb);
    bay.scale.setScalar(0.0001);
    world.add(bay);

    // A low, wide saloon — proportioned off a real one (≈4.8 m long, which is
    // ~1.55 units at this scene's 1 unit ≈ 3.1 m) so it sits correctly against
    // the building and the scale figures.
    const car = new THREE.Group();
    /* A long-wheelbase formal saloon, proportioned off a Phantom: ~5.8 m (1.85
       units at this scene's 1 unit ≈ 3.1 m), long bonnet, short front overhang,
       upright grille, slab sides and a formal roofline set well back. This is
       AUTHORED GEOMETRY, not a licensed GLTF model — see the note in the memory
       file about why photoreal car models are not viable at this bundle size. */
    const carPaint = new THREE.MeshPhysicalMaterial({
      color: 0xf8f9fa, roughness: 0.15, metalness: 0.85, envMapIntensity: 2.0,
      clearcoat: 1, clearcoatRoughness: 0.04,   // pearl finish = lacquer over flake
    });
    const chrome = new THREE.MeshPhysicalMaterial({
      color: 0xf2f4f7, roughness: 0.06, metalness: 1, envMapIntensity: 2.4,
    });
    const carTrim = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.3, metalness: 0.85, envMapIntensity: 1.4 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xe6ebf0, roughness: 0.4, metalness: 0.1 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x8c1a18, roughness: 0.4, metalness: 0.1 });
    const wheels: THREE.Mesh[] = [];
    {
      const L = 1.85, W = 0.72;
      // Lower body, then a separate shoulder box — the step between them is the
      // shoulder line that stops a car reading as one extruded block.
      const lower = new THREE.Mesh(new THREE.BoxGeometry(L, 0.24, W), carPaint);
      lower.position.y = 0.26; lower.castShadow = true;
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(L * 0.98, 0.2, W * 0.96), carPaint);
      shoulder.position.y = 0.47; shoulder.castShadow = true;
      // Long bonnet: flat, high, and running well forward of the screen.
      const bonnet = new THREE.Mesh(new THREE.BoxGeometry(L * 0.4, 0.1, W * 0.9), carPaint);
      bonnet.position.set(L * 0.27, 0.6, 0); bonnet.castShadow = true;
      // Formal cabin, set back, with a near-vertical rear screen.
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.42, 0.3, W * 0.88), carTrim);
      cabin.position.set(-L * 0.13, 0.71, 0);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(L * 0.44, 0.06, W * 0.9), carPaint);
      roof.position.set(-L * 0.13, 0.88, 0); roof.castShadow = true;
      const boot = new THREE.Mesh(new THREE.BoxGeometry(L * 0.24, 0.12, W * 0.94), carPaint);
      boot.position.set(-L * 0.4, 0.6, 0); boot.castShadow = true;
      car.add(lower, shoulder, bonnet, cabin, roof, boot);

      // The grille: upright, chrome, standing proud of the nose. This single
      // element does more for the silhouette than anything else on the car.
      const grille = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.34), chrome);
      grille.position.set(L * 0.49, 0.44, 0); grille.castShadow = true;
      const grilleCap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.38), chrome);
      grilleCap.position.set(L * 0.49, 0.6, 0);
      car.add(grille, grilleCap);
      // Vertical LED headlight units either side of the grille.
      ([-1, 1] as const).forEach((s) => {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.19, 0.07), headMat);
        hl.position.set(L * 0.485, 0.47, s * 0.26);
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.16), tailMat);
        tl.position.set(-L * 0.51, 0.5, s * 0.24);
        car.add(hl, tl);
      });
      // Chrome waistline and window surround.
      ([-1, 1] as const).forEach((s) => {
        const waist = new THREE.Mesh(new THREE.BoxGeometry(L * 0.9, 0.02, 0.015), chrome);
        waist.position.set(0, 0.57, s * (W / 2 - 0.005));
        const sill = new THREE.Mesh(new THREE.BoxGeometry(L * 0.86, 0.03, 0.02), chrome);
        sill.position.set(0, 0.855, s * (W * 0.44));
        car.add(waist, sill);
      });
      // Wheels, pushed to the corners — short overhangs read as expensive.
      const tyreGeo = new THREE.CylinderGeometry(0.135, 0.135, 0.1, 16).rotateX(Math.PI / 2);
      const rimGeo = new THREE.CylinderGeometry(0.088, 0.088, 0.11, 10).rotateX(Math.PI / 2);
      ([[L * 0.33, 1], [L * 0.33, -1], [-L * 0.33, 1], [-L * 0.33, -1]] as const).forEach(([wx, sz]) => {
        const w = new THREE.Mesh(tyreGeo, tyreMat);
        w.position.set(wx, 0.135, sz * (W / 2 - 0.03)); w.castShadow = true;
        const rim = new THREE.Mesh(rimGeo, chrome);
        rim.position.set(wx, 0.135, sz * (W / 2 - 0.02));
        car.add(w, rim);
        wheels.push(w);
      });
    }
    car.visible = false;
    world.add(car);

    /* The drive-out. Parked nose-out in the bay, forward onto the plaza, right
       onto the road, then straight past the camera and off frame. Catmull-Rom so
       the turn is a curve rather than three straight segments. */
    const DRIVE = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 3.0),        // parked inside the compound
      new THREE.Vector3(0, 0, 4.0),        // rolls toward the gate
      new THREE.Vector3(0.05, 0, 5.2),     // through the opening
      new THREE.Vector3(0.5, 0, 6.7),      // onto the carriageway
      new THREE.Vector3(2.6, 0, 7.9),      // turns right along the road
      new THREE.Vector3(8.5, 0, 8.4),
      new THREE.Vector3(19.0, 0, 10.2),    // drives off frame
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
    world.add(dust);

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
    world.add(puff);

    /* NO SUN SHAFTS. Three additive camera-facing cards used to sit here. They
       are the "aggressive white lens flare" over the building: an additive quad
       between the camera and the subject washes the subject, and no opacity low
       enough to stop that is high enough to be visible as atmosphere. Deleted
       rather than retuned. Airborne dust below carries the atmosphere instead. */

    /* ---- post-processing --------------------------------------------------------- */
    const composer = new EffectComposer(renderer);
    /* AMBIENT OCCLUSION — N8AO, not three's SSAOPass.
       SSAOPass was tried here and removed: it cost ~15fps AND smeared dark
       streaks off every tree and light pole, because its depth-discontinuity
       handling fails on thin geometry at this scene scale. N8AO handles thin
       geometry properly and runs at half resolution, which is what makes it
       affordable. Radius is in WORLD units — 1 unit is ~3.1 m here, so 1.1 is
       roughly a 3 m occlusion radius: contact shading under slabs, tyres and
       kerbs, not a global dirt pass. */
    // N8AOPass, not N8AOPostPass: the Post variant expects depth+normals to
    // already exist in the composer's targets and renders BLACK without them.
    // N8AOPass does the beauty render itself, so it REPLACES RenderPass.
    const n8ao = new N8AOPass(scene, camera, 1, 1);
    n8ao.configuration.aoRadius = 0.55;
    n8ao.configuration.distanceFalloff = 0.6;
    n8ao.configuration.intensity = 1.8;
    n8ao.configuration.halfRes = true;
    n8ao.configuration.denoiseIterations = 0;
    // OutputPass owns tone mapping and sRGB; correcting here too washes the
    // whole frame out.
    n8ao.configuration.gammaCorrection = false;
    n8ao.configuration.color = new THREE.Color(0x0e1420);
    composer.addPass(n8ao);
    /* NO BLOOM. Nothing in a daylight architectural render glows, so the pass
       has nothing legitimate to pick up — it only ever blew out sunlit concrete
       and glass. Deleting it also buys back a full-res pass per frame. */
    const bokeh = new BokehPass(scene, camera, { focus: 20, aperture: 0.00007, maxblur: 0.007 });
    /* DEPTH OF FIELD IS OFF. Measured cost: BokehPass renders the whole scene a
       second time for its depth buffer — 1765 → 1110 draw calls per frame and
       ~5.5fps when removed. On a scroll-scrubbed hero, frame rate is worth more
       than a subtle background blur. Flip this to true to get it back. */
    const DEPTH_OF_FIELD = false;
    if (DEPTH_OF_FIELD) composer.addPass(bokeh);
    composer.addPass(new OutputPass());
    const bokehU = (bokeh as unknown as { uniforms: Record<string, { value: number }> }).uniforms;

    /* ---- the per-frame update ------------------------------------------------------ */
    const look = new THREE.Vector3();
    let clock = 0, focus = 0, focusOn = false;
    const gateCam = new THREE.Vector3(), gateLook = new THREE.Vector3();
    const update = (t: number, dt = 0, tail = 0) => {
      clock += dt;
      const e = ease(t);

      // CAMERA — architectural 3/4. Wide while the site is busy, pushing in for
      // the reveal; framing must clear the whole SITE, not just the building.
      const ang = mix(-0.62, 0.82, e);
      const build = ease(span(0.12, 0.84, t)), reveal = ease(span(0.86, 1, t));
      const rad = mix(mix(23, 27.5, build), 19.5, reveal);
      // HANDOFF REFRAME. Raising the camera while LOWERING the look target
      // tilts the lens down, which lifts the building UP in frame — that is what
      // clears the bottom band for the stats bar. (Tilting the camera up would
      // push the subject down, behind the stats, which is the opposite.)
      const lift = ease(tail);
      camera.position.set(
        Math.sin(ang) * mix(rad, rad + 4.2, lift),
        mix(mix(7.6, 11.6, build), 7.4, reveal) + lift * 3.6,
        Math.cos(ang) * mix(rad, rad + 4.2, lift)
      );
      look.set(0, mix(1.2, TOP * 0.55, ease(span(0.12, 0.9, t))) - lift * 1.9, 0);
      /* GATE FOCUS. Blended on top of the playhead camera rather than replacing
         it, so releasing the focus hands control back mid-frame with no jump. */
      if (focusOn) focus = Math.min(1, focus + dt * 1.05);
      else if (focus > 0) focus = Math.max(0, focus - dt * 1.5);
      if (focus > 0.0001) {
        const k = ease(focus), ws = world.scale.x;
        camera.position.lerp(gateCam.copy(GATE_CAM).multiplyScalar(ws), k);
        look.lerp(gateLook.copy(GATE_LOOK).multiplyScalar(ws), k);
      }
      camera.lookAt(look);
      bokehU.focus.value = camera.position.distanceTo(look);

      // P1 — hoarding snaps in, blueprint glows, pit opens.
      setFence(ease(span(0.01, 0.14, t)), ease(span(0.84, 0.96, t)));
      const bp = ease(span(0.04, 0.14, t)) * (1 - ease(span(0.52, 0.66, t)));
      const bpm = blueprint.material as THREE.MeshStandardMaterial;
      bpm.opacity = bp;
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
      crane.visible = craneIn > 0.01 && clear < 0.99;
      crane.position.set(CRANE_HOME.x + clear * 30, CRANE_HOME.y, CRANE_HOME.z - clear * 12);

      // Swings the load across the slab rather than away from it. rotation.y = θ
      // sends the jib (local +x) to world (r·cosθ, −r·sinθ); from the crane's
      // corner the building sits at θ ≈ -2.54 rad, so the sweep straddles it.
      (crane.userData.slew as THREE.Group).rotation.y = mix(-3.2, -1.9, ease(span(0.2, 0.9, t)));
      mixers.forEach((g, i) => {
        g.scale.setScalar(s0(ease(span(0.2 + i * 0.05, 0.32 + i * 0.05, t))));
        const out = ease(span(0.84 + i * 0.03, 0.97 + i * 0.03, t));
        const home = g.userData.home as THREE.Vector3;
        g.position.set(home.x + out * (i ? 26 : -26), 0, home.z + out * 14);
        g.visible = out < 0.99 && g.scale.x > 0.01;
      });
      foots.forEach((m, i) => {
        const k = outCubic(stagger(t, 0.06, 0.14, i, foots.length));
        m.scale.setScalar(s0(k));
        m.visible = k > 0.002 && t < 0.34;   // buried under the podium by then
      });
      // The podium caps the excavation as soon as the footings are in, so the
      // finished building is never seen sitting over an open hole.
      podium.visible = t > 0.13;
      // Scaffold goes up with the frame and comes down with the plant.
      scaffolds.forEach((g, i) => {
        const up = ease(span(0.34 + i * 0.04, 0.5 + i * 0.04, t));
        const down = ease(span(0.8 + i * 0.03, 0.9 + i * 0.03, t));
        const sy = up * (1 - down);
        g.scale.set(1, s0(sy), 1);
        // Guard on the SCALE, not just the phase windows. A group left visible
        // at scale.y ~0 squashes its safety netting flat onto the ground, which
        // read as a stray green strip lying beside the road.
        g.visible = sy > 0.01;
      });
      // Poles stay for the life of the site and keep their hazard lamps going.
      poles.forEach((g, i) => g.scale.setScalar(s0(ease(span(0.12 + i * 0.02, 0.24 + i * 0.02, t)))));
      cages.forEach((g, i) => {
        const k = stagger(t, 0.1, 0.19, i, cages.length);
        g.scale.y = s0(k);
        // 12 cages × 8 bars/ties = 96 objects. Once the concrete is poured the
        // steel is inside it and can never be seen again — drop it entirely.
        g.visible = k > 0.002 && t < 0.3;
      });
      cols.forEach((m, i) => { m.scale.y = s0(stagger(t, 0.15, 0.28, i, cols.length)); });

      // P3 — slabs DROP in, each throwing dust as it seats.
      let puffAt = -1, puffAge = 1;
      slabs.forEach((m, k) => {
        const p = stagger(t, 0.24, 0.4, k, slabs.length);
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
      mullions.forEach((m) => { m.scale.y = s0(ease(span(0.4, 0.5, t))); });
      panes.forEach((p, i) => {
        const k = stagger(t, 0.44, 0.9, i, panes.length, 2.5);
        p.mesh.visible = k > 0.001;
        if (p.mesh.visible) p.mesh.position.lerpVectors(p.from, p.to, outCubic(k));
      });
      roof.scale.setScalar(s0(ease(span(0.5, 0.58, t))));
      // Signage goes up once the parapet exists, then warms to full at dusk.
      const brandIn = ease(span(0.58, 0.7, t));
      sign.visible = fascia.visible = frame.visible = brandIn > 0.02;
      sign.scale.set(brandIn, brandIn, 1);
      fascia.scale.set(brandIn, brandIn, 1);
      frame.scale.set(brandIn, brandIn, 1);
      brandMat.opacity = brandIn;
      plates.forEach((m, k) => {
        const s = s0(stagger(t, 0.26, 0.42, k, plates.length));
        m.scale.set(s, 1, s);
      });
      spandrels.forEach((m, k) => {
        const s = s0(stagger(t, 0.46, 0.72, k, spandrels.length));
        m.scale.set(s, 1, s);
      });
      // Rim light comes up with the glazing and holds through the reveal.
      const rim = ease(span(0.72, 0.94, t));
      rims.forEach((m) => { m.visible = rim > 0.02; });

      // The gate swings outward before the car moves, and stays open.
      const gateOpen = ease(span(0.8, 0.93, t));
      gateLeaves.forEach((leaf, i) => { leaf.rotation.y = (i ? 1 : -1) * gateOpen * 1.15; });

      // CLIMAX — the car. It SPAWNS on the build playhead (parked as the plaza
      // is revealed) but DRIVES on the tail, so the exit and the stats reveal are
      // one continuous gesture instead of two separate beats.
      const parked = ease(span(0.86, 0.95, t));
      bay.scale.setScalar(s0(parked));
      // Accelerating: quadratic on the pull-out so it eases off the bay, then
      // opens up. A linear run read as a tram, not a car.
      const dv = clamp01(tail);
      const drive = dv * dv * (0.62 / 1) + dv * 0.38;
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
      setTrees((i) => ease(stagger(t, 0.5, 0.86, i, TREES.length, 1.6)));
      canopy.scale.setScalar(s0(ease(span(0.56, 0.66, t))));
      // Street edge lands with the landscaping.
      wall.visible = hedgeIM.visible = ease(span(0.86, 0.96, t)) > 0.02;
      // Crew work through the build and leave with the plant; visitors arrive
      // for the handover. The site is never empty AND never both at once.
      crew.forEach((f, i) => f.scale.setScalar(s0(
        ease(span(0.24 + i * 0.02, 0.34 + i * 0.02, t)) * (1 - ease(span(0.86, 0.94, t)))
      )));
      /* Workers leave with the crew. The roof pair (indices 0 and 1) cannot
         arrive until there is a slab to stand on, so they wait for the roof. */
      const off = 1 - ease(span(0.86, 0.94, t));
      workers.forEach((f, i) => {
        const start = i < 2 ? 0.52 : 0.26 + i * 0.02;
        f.scale.setScalar(s0(ease(span(start, start + 0.1, t)) * off));
      });
      // Top-floor works: up with the roof, struck with the rest of the site.
      const tw = ease(span(0.5, 0.6, t)) * off;
      topWorks.visible = tw > 0.01;
      topWorks.scale.set(1, s0(tw), 1);
      visitors.forEach((f, i) => f.scale.setScalar(s0(ease(stagger(t, 0.9, 1, i, visitors.length, 1.2)))));
      bollards.forEach((b, i) => b.scale.setScalar(s0(ease(stagger(t, 0.88, 0.98, i, bollards.length, 1.4)))));

      // ATMOSPHERE — dust is heaviest while the site works, and settles as the
      // building finishes. Motes drift on their own slow clock.
      const air = ease(span(0.16, 0.34, t)) * (1 - ease(span(0.84, 0.98, t)));
      dustMat.opacity = air * 0.12;
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
    };

    /* ---- size, visibility, teardown ------------------------------------------------- */
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      // Re-evaluate on every resize, not just at mount — a phone rotating from
      // portrait to landscape crosses the breakpoint.
      const phone = isPhone();
      camera.fov = phone ? 65 : 45;
      world.scale.setScalar(phone ? 0.65 : 1);
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      n8ao.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    /* Renders CONTINUOUSLY while on screen. The render-on-demand trick this used
       to have is incompatible with drifting dust and blinking crane lamps, which
       have to keep moving when the user stops scrolling. The IntersectionObserver
       is what keeps that honest: scroll past the hero and it costs nothing. */
    let visible = true, raf = 0, last = 0, playhead = 0, tailv = 0;
    let shadowAt = -1, shadowTail = -1;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) { last = now; return; }
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      update(playhead, dt, tailv);
      // Shadows only need redrawing when the scene's geometry actually moved.
      // Dust drift and blinking lamps cast nothing.
      const moved = Math.abs(playhead - shadowAt) > 0.0006 || Math.abs(tailv - shadowTail) > 0.0006;
      if (moved) { renderer.shadowMap.needsUpdate = true; shadowAt = playhead; shadowTail = tailv; }
      composer.render();
    };
    raf = requestAnimationFrame(loop);

    const releaseFocus = () => { focusOn = false; };
    api.current = {
      update: (t, tl = 0) => { playhead = t; tailv = tl; },
      focusGate: () => { focusOn = true; },
    };
    update(0);

    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    /* The gate focus is released by the USER, not by the playhead — the skip
       scrolls the page itself to part the gate doors, and a playhead-delta test
       would cancel the focus on the frame it began. */
    (['wheel', 'touchstart', 'keydown', 'pointerdown'] as const)
      .forEach((e) => window.addEventListener(e, releaseFocus, { passive: true }));
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      (['wheel', 'touchstart', 'keydown', 'pointerdown'] as const)
        .forEach((e) => window.removeEventListener(e, releaseFocus));
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
      hdrRT?.dispose();
      pmrem.dispose();
      scene.background = null;
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

export default HeroThree;

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* GLTFLoader and DRACOLoader are imported DYNAMICALLY, further down, and the
   HEAD probe below means neither is even reached unless a model file is really
   there. That skips parsing them, and — the part that actually costs bytes —
   never fetches Draco's decoder.

   ponytail: their ~38 KB still lands in the `three` chunk, because
   vite.config's manualChunks uses the object form and `three: ['three']`
   sweeps every submodule into that chunk. Splitting them out needs the
   function form, which means rewriting the whole app's chunk map for 17 KB
   gzipped inside a chunk that is already 237 KB and only downloaded by
   visitors who get the 3D hero. Do it when a real model makes the loaders
   worth their own cache entry. */
type GLTFLoaderT = import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;

/**
 * GLB DROP-IN SLOTS FOR THE HERO SCENE.
 *
 * The scene ships with procedurally-built vehicles, plant and crew. They are
 * the FALLBACK, not the target. Drop a real model at the path for a slot and it
 * replaces the procedural one at runtime, with no code change — see
 * `public/models/README.md` for the contract a model has to meet.
 *
 * NOTHING IS BUNDLED AND NOTHING IS FETCHED FROM A THIRD PARTY. Every path
 * below is a local file under `public/models/` that does not exist yet. A
 * missing file is the normal case: the load fails, `loadModel` resolves null,
 * and the scene keeps what it already drew. No spinner, no error, no layout
 * shift — the hero is fully rendered before any of this is attempted.
 */
export type VehicleSlot = 'sedan' | 'suv' | 'van';
export type PlantSlot = 'lorry' | 'mixer' | 'excavator';
export type ModelSlot = VehicleSlot | PlantSlot | 'worker' | 'tree';

export const MODELS: Record<ModelSlot, string> = {
  sedan: '/models/sedan.glb',
  suv: '/models/suv.glb',
  van: '/models/van.glb',
  lorry: '/models/lorry.glb',
  mixer: '/models/mixer.glb',
  excavator: '/models/excavator.glb',
  worker: '/models/worker.glb',
  tree: '/models/tree.glb',
};

/** The scene's scale. Every length in HeroSite is in these units; a model is
 *  authored in metres and divided by this on the way in. */
export const UNIT_METRES = 2.8;

/** Roughly how long each slot should be in metres, once loaded. Only used to
 *  catch a model that came in at centimetre or inch scale — a 450 m sedan is a
 *  units mistake, not a design choice, and it is far better to refuse it than
 *  to drop it into the scene and wonder why the hero is inside a wheel. */
const EXPECT_M: Record<ModelSlot, [number, number]> = {
  sedan: [3.6, 5.6], suv: [4.0, 5.6], van: [4.4, 7.0],
  lorry: [5.5, 12], mixer: [6, 13], excavator: [4, 11],
  worker: [1.4, 2.1],
  tree: [3, 16],
};

export type LoadedModel = {
  /** Opaque geometry, merged with groups so `materials` still applies per part. */
  body: THREE.BufferGeometry;
  materials: THREE.Material[];
  /** Glazing, split out so it can keep the scene's own glass shading. Null when
   *  the model has no mesh matching the glass naming convention. */
  glass: THREE.BufferGeometry | null;
  glassMaterials: THREE.Material[];
  /** Bounding box after normalisation, in scene units. */
  size: THREE.Vector3;
};

/* A model is glazing if its MESH or its MATERIAL is named for it. Checked on
   both because exporters disagree about which one survives a round trip. */
const GLASS_RE = /glass|window|windscreen|windshield|glazing/i;

let loaderP: Promise<GLTFLoaderT> | null = null;
const getLoader = () => {
  if (loaderP) return loaderP;
  loaderP = (async () => {
    const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/DRACOLoader.js'),
    ]);
    const l = new GLTFLoader();
    /* Draco is wired but its decoder is NOT vendored — a decoder nobody has
       asked for yet is 2 MB of dead weight in the repo. GLTFLoader only reaches
       for it when a file is actually Draco-compressed, so this costs nothing
       until that day. To ship compressed models, copy
       `node_modules/three/examples/jsm/libs/draco/` to `public/draco/`. */
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    l.setDRACOLoader(draco);
    return l;
  })();
  return loaderP;
};

/** Is there actually a file at this path? A HEAD is a few hundred bytes and a
 *  404, where fetching the loader to find out is 38 KB of parser. */
async function present(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    // A host that rewrites unknown paths to index.html answers 200 with HTML.
    return r.ok && !(r.headers.get('content-type') ?? '').includes('text/html');
  } catch {
    return false;
  }
}

/**
 * Load one slot, or resolve null if it is not there / not usable.
 *
 * NEVER REJECTS. A missing model is the expected state of this project right
 * now, so it cannot be allowed to surface as an unhandled rejection in the
 * console of a site that is rendering perfectly well without it.
 */
/* ---- DEV ASSET STATUS -------------------------------------------------------
   One consolidated report of which slots resolved, printed to the console the
   first time the hero asks for them:

     [models] hero assets — 2/8 loaded
       ✓ sedan.glb        loaded
       ✗ van.glb          missing -> procedural fallback
       ! mixer.glb        rejected -> procedural fallback

   DEV ONLY. Vite replaces `import.meta.env.DEV` with a literal `false` in a
   production build, so minification removes this whole path — it is not a
   runtime check that happens to be quiet in production, it is absent from it.
   It is also console-only and never renders, so it cannot reach the site UI.

   Coalesced rather than logged per slot: the eight probes resolve within a few
   ms of each other, and eight separate lines scattered through a busy console
   is exactly the noise this is meant to replace. */
/* Resolved ONCE, defensively. `import.meta.env` is injected by the bundler and
   simply does not exist under plain Node — which is where the check suite runs
   this module, so reading `.DEV` off it threw and took the fallback test with
   it. Optional chaining gives `undefined` there and the reporter stays off;
   under Vite the expression folds to a constant and minification drops every
   branch below it. */
const DEV = ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) === true;

type SlotState = 'loaded' | 'missing' | 'rejected';
const status = new Map<ModelSlot, SlotState>();
let reportAt: ReturnType<typeof setTimeout> | null = null;

function record(slot: ModelSlot, state: SlotState) {
  if (!DEV) return;
  status.set(slot, state);
  if (reportAt) clearTimeout(reportAt);
  reportAt = setTimeout(() => {
    reportAt = null;
    const rows = (Object.keys(MODELS) as ModelSlot[])
      .filter((k) => status.has(k))
      .map((k) => {
        const st = status.get(k)!;
        const file = MODELS[k].replace('/models/', '').padEnd(16);
        if (st === 'loaded') return `  \u2713 ${file}loaded`;
        if (st === 'rejected') return `  ! ${file}rejected -> procedural fallback`;
        return `  \u2717 ${file}missing -> procedural fallback`;
      });
    const ok = [...status.values()].filter((v) => v === 'loaded').length;
    console.info(
      [`[models] hero assets \u2014 ${ok}/${Object.keys(MODELS).length} loaded`, ...rows].join('\n'),
    );
  }, 300);
}

const cache = new Map<ModelSlot, Promise<LoadedModel | null>>();

export function loadModel(slot: ModelSlot): Promise<LoadedModel | null> {
  // Memoised: the worker model is wanted by both the site crew and the people
  // on the footway, which are built in separate scopes. Without this they would
  // each fetch and parse the same file.
  let p = cache.get(slot);
  if (!p) { p = fetchModel(slot); cache.set(slot, p); }
  return p;
}

async function fetchModel(slot: ModelSlot): Promise<LoadedModel | null> {
  const url = MODELS[slot];
  if (!(await present(url))) { record(slot, 'missing'); return null; }   // the normal case, today.
  let gltf;
  try {
    gltf = await (await getLoader()).loadAsync(url);
  } catch {
    record(slot, 'missing');
    return null;
  }
  try {
    const m = normalise(gltf.scene, slot);
    record(slot, 'loaded');
    return m;
  } catch (err) {
    // A model that IS there but cannot be used is a real mistake worth saying
    // out loud, unlike one that simply has not been added yet.
    console.warn(`[models] ${MODELS[slot]} loaded but was rejected:`, (err as Error).message);
    record(slot, 'rejected');
    return null;
  }
}

/**
 * Bake a loaded scene down to the two geometries the hero draws with.
 *
 * WHY MERGE AT ALL: every vehicle in the scene is drawn as an InstancedMesh —
 * one draw call for the whole car park, one for all the traffic. That needs a
 * single geometry, so the model's meshes are flattened into one with their
 * world transforms applied, keeping GROUPS so the material array still lines up
 * per part and the model's own PBR paint, chrome and rubber all survive.
 */
export function normalise(root: THREE.Object3D, slot: ModelSlot): LoadedModel {
  root.updateWorldMatrix(true, true);

  const bodyGeos: THREE.BufferGeometry[] = [], glassGeos: THREE.BufferGeometry[] = [];
  const bodyMats: THREE.Material[] = [], glassMats: THREE.Material[] = [];

  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat, gi) => {
      // One geometry per material slot, so a multi-material mesh does not
      // collapse to whichever material happened to be first.
      const g = (Array.isArray(m.material) ? sliceGroup(m.geometry, gi) : m.geometry.clone());
      if (!g) return;
      g.applyMatrix4(m.matrixWorld);
      const glass = GLASS_RE.test(m.name) || GLASS_RE.test(mat.name ?? '');
      (glass ? glassGeos : bodyGeos).push(g);
      (glass ? glassMats : bodyMats).push(mat);
    });
  });

  if (!bodyGeos.length) throw new Error('no meshes found');

  const body = mergeGeometries(bodyGeos.map(toPlain), true);
  if (!body) throw new Error('meshes have incompatible attributes — re-export with a uniform vertex layout');

  /* SCALE AND SEAT, from the OPAQUE body only. Including the glazing would let a
     roof light or a mirror glass decide where the wheels are. */
  const box = new THREE.Box3().setFromBufferAttribute(body.attributes.position as THREE.BufferAttribute);
  const sizeM = box.getSize(new THREE.Vector3());
  const lengthM = Math.max(sizeM.x, sizeM.z);
  const [lo, hi] = EXPECT_M[slot];
  if (!(lengthM >= lo && lengthM <= hi)) {
    throw new Error(`is ${lengthM.toFixed(2)} long, expected ${lo}-${hi}m — check the export units`);
  }

  const k = 1 / UNIT_METRES;
  // Centre on X and Z, seat on Y=0, THEN scale. Wheels on the ground is not a
  // nicety here: every placement in the scene writes y=0 for a vehicle.
  const mid = box.getCenter(new THREE.Vector3());
  const seat = new THREE.Matrix4()
    .makeScale(k, k, k)
    .multiply(new THREE.Matrix4().makeTranslation(-mid.x, -box.min.y, -mid.z));

  body.applyMatrix4(seat);
  body.computeVertexNormals();

  const glass = glassGeos.length ? mergeGeometries(glassGeos.map(toPlain), true) : null;
  if (glass) { glass.applyMatrix4(seat); glass.computeVertexNormals(); }

  return {
    body, materials: bodyMats, glass, glassMaterials: glassMats,
    size: sizeM.multiplyScalar(k),
  };
}

/** One material group of a multi-material geometry, as its own geometry. */
function sliceGroup(geo: THREE.BufferGeometry, gi: number): THREE.BufferGeometry | null {
  const grp = geo.groups[gi];
  if (!grp) return null;
  const g = geo.clone();
  g.clearGroups();
  if (g.index) g.setIndex(Array.from(g.index.array.slice(grp.start, grp.start + grp.count)));
  return g;
}

/* mergeGeometries refuses a mixture of indexed and non-indexed inputs, and of
   differing attribute sets — it does not throw, it returns null, which is how a
   whole fleet once turned invisible. Flatten to non-indexed position/normal/uv
   so anything an exporter emits merges cleanly. */
function toPlain(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const flat = g.index ? g.toNonIndexed() : g;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', flat.attributes.position);
  if (flat.attributes.normal) out.setAttribute('normal', flat.attributes.normal);
  else { out.computeVertexNormals(); }
  const uv = flat.attributes.uv ?? new THREE.BufferAttribute(new Float32Array((flat.attributes.position.count) * 2), 2);
  out.setAttribute('uv', uv);
  return out;
}

/** An empty geometry, for collapsing a procedural part that a loaded model
 *  already includes (its own wheels, its own hi-vis vest). Cheaper and far less
 *  invasive than teaching every draw loop about a "hidden" flag. */
export const EMPTY_GEO = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  return g;
};

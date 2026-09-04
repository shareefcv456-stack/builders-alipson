/**
 * THE MODEL BAKE IS CORRECT BEFORE ANY MODEL EXISTS.
 *
 * `normalise` is the only real logic in the GLB path — scale from metres, seat
 * on the ground, centre, split the glazing, refuse a bad-units export. It runs
 * on a loaded file, and there are no loaded files yet, so it is checked here
 * against synthetic scenes built to look like what an exporter hands over.
 *
 *   npm run check:3d
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MODELS, loadModel, normalise, UNIT_METRES, type ModelSlot } from './models.js';

/** A box mesh in METRES, the way a correctly-exported model arrives. */
const part = (
  name: string, w: number, h: number, d: number,
  at: [number, number, number], mat = new THREE.MeshStandardMaterial({ name: 'paint' }),
) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.name = name;
  m.position.set(...at);
  return m;
};

const bbox = (g: THREE.BufferGeometry) =>
  new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);

const bake = (children: THREE.Object3D[], slot: ModelSlot = 'sedan') => {
  const root = new THREE.Group();
  children.forEach((c) => root.add(c));
  return normalise(root, slot);
};

/* ---- 1. metres in, scene units out; seated on the ground; centred --------- */
{
  // A 4.5 m x 1.5 m x 1.85 m car sitting on the ground, modelled off-origin
  // the way a real export usually is.
  const m = bake([part('body', 4.5, 1.5, 1.85, [3, 0.75, -2])]);
  const b = bbox(m.body);
  const len = b.max.x - b.min.x;

  assert.ok(Math.abs(len - 4.5 / UNIT_METRES) < 1e-4, `length ${len} != 4.5m in scene units`);
  assert.ok(Math.abs(b.min.y) < 1e-6, `not seated on the ground: min.y=${b.min.y}`);
  assert.ok(Math.abs(b.min.x + b.max.x) < 1e-6, 'not centred on X');
  assert.ok(Math.abs(b.min.z + b.max.z) < 1e-6, 'not centred on Z');
  console.log(`seat+scale  length ${len.toFixed(3)}u  y ${b.min.y.toFixed(3)}..${b.max.y.toFixed(3)}`);
}

/* ---- 2. glazing is split off by name, on the mesh OR the material -------- */
{
  const byMesh = bake([
    part('body', 4.5, 1.2, 1.85, [0, 0.6, 0]),
    part('windscreen_glass', 1.2, 0.6, 1.7, [0.4, 1.4, 0]),
  ]);
  assert.ok(byMesh.glass, 'glazing named on the MESH was not split out');

  const byMat = bake([
    part('body', 4.5, 1.2, 1.85, [0, 0.6, 0]),
    part('part_042', 1.2, 0.6, 1.7, [0.4, 1.4, 0],
      new THREE.MeshPhysicalMaterial({ name: 'Glass.001' })),
  ]);
  assert.ok(byMat.glass, 'glazing named on the MATERIAL was not split out');

  /* And the glazing must NOT drag the seating with it: a windscreen high on the
     body would otherwise lift the whole car off the ground when it is included
     in the bounding box the seat is computed from. */
  const b = bbox(byMesh.body);
  assert.ok(Math.abs(b.min.y) < 1e-6, 'glazing was included in the seat calculation');
  console.log('glass split by mesh name and by material name, seat unaffected');
}

/* ---- 3. a bad-units export is REFUSED, not silently scaled --------------- */
for (const [label, size] of [['centimetres', 450], ['millimetres', 4500]] as const) {
  assert.throws(
    () => bake([part('body', size, size / 3, size / 2.4, [0, 0, 0])]),
    /check the export units/,
    `a ${label} export was accepted`,
  );
}
console.log('cm and mm exports refused');

/* ---- 4. materials survive, including a multi-material mesh --------------- */
{
  const multi = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 1.5, 1.85),
    [new THREE.MeshStandardMaterial({ name: 'paint' }), new THREE.MeshStandardMaterial({ name: 'trim' })],
  );
  multi.name = 'body';
  multi.geometry.clearGroups();
  multi.geometry.addGroup(0, 18, 0);
  multi.geometry.addGroup(18, 18, 1);
  multi.position.y = 0.75;
  const m = bake([multi]);
  assert.ok(m.materials.length >= 2, `multi-material mesh collapsed to ${m.materials.length} material(s)`);
  assert.ok(m.body.groups.length >= 2, 'merged geometry lost its material groups');
  console.log(`multi-material kept ${m.materials.length} materials, ${m.body.groups.length} groups`);
}

/* ---- 5. indexed and non-indexed meshes merge ----------------------------- */
{
  /* THE BUG CLASS THAT ALREADY BIT THIS PROJECT ONCE. mergeGeometries does not
     throw on a mixture, it returns null — and a null geometry is an invisible
     vehicle, not an error. Exporters emit both, often in the same file. */
  const a = part('body', 4.5, 1.2, 1.85, [0, 0.6, 0]);
  const b = part('bumper', 0.4, 0.3, 1.8, [2.2, 0.4, 0]);
  // Typed as BoxGeometry by `part`; toNonIndexed hands back a plain
  // BufferGeometry, which is exactly the mixture being tested.
  const nonIndexed = new THREE.Mesh(b.geometry.toNonIndexed(), b.material);
  nonIndexed.name = b.name;
  nonIndexed.position.copy(b.position);
  const m = bake([a, nonIndexed]);
  assert.ok((m.body.attributes.position as THREE.BufferAttribute).count > 0, 'mixed index merge produced nothing');
  console.log('indexed + non-indexed merged');
}

/* ---- 6. a scene with no meshes is refused rather than returning empty ---- */
assert.throws(() => bake([new THREE.Group()]), /no meshes found/);

/* ---- 7. THE FALLBACK PATH IS THE LIVE PATH ------------------------------
      No .glb exists in this repo, so every visitor today takes the
      missing-model branch. It has to resolve NULL rather than reject: an
      unhandled rejection in the console of a site that is rendering perfectly
      well is a bug report waiting to happen, and each caller in HeroSite
      guards with `if (!m) return` to keep its procedural mesh. */
{
  const realFetch = globalThis.fetch;
  let asked = 0;
  // Stand in for a server that has no such file.
  globalThis.fetch = (async (url: string) => {
    asked++;
    void url;
    return { ok: false, status: 404, headers: { get: () => null } };
  }) as unknown as typeof fetch;

  const slots = Object.keys(MODELS) as ModelSlot[];
  const results = await Promise.all(slots.map((k) => loadModel(k)));
  globalThis.fetch = realFetch;

  results.forEach((r, i) => {
    assert.equal(r, null, `${slots[i]} did not fall back to null when its file was absent`);
  });
  assert.equal(asked, slots.length, `probed ${asked} paths for ${slots.length} slots`);

  // Memoised: a second call must not re-probe.
  const before = asked;
  await loadModel(slots[0]);
  assert.equal(asked, before, 'loadModel re-fetched a slot it had already resolved');

  console.log(`fallback          all ${slots.length} slots resolved null, no throw, memoised`);
}

console.log('ok — model bake correct');

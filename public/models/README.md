# Hero scene models

Drop a `.glb` here and the hero picks it up on next load. Nothing is bundled
and nothing is downloaded — every file below is **absent by design**, and the
scene renders its procedural fallback until you add one.

| File | Replaces |
|---|---|
| `sedan.glb` | parked + traffic saloon |
| `suv.glb` | parked + traffic estate/SUV |
| `van.glb` | white delivery van |
| `lorry.glb` | construction lorry on site |
| `mixer.glb` | cement mixer on site |
| `excavator.glb` | JCB / tracked excavator on site |
| `worker.glb` | site crew and pavement pedestrians |
| `tree.glb` | street and forecourt planting |

## The contract

A model must meet all of these or it is rejected (with a console warning) and
the procedural fallback stands:

1. **Metres.** Real-world scale. The loader divides by 2.8 to reach scene units
   and refuses anything outside a sane length for its slot, because a model
   exported in centimetres is a units bug, not a style.
2. **Nose at +X.** The vehicle faces +X at rest. Head lamps are placed at +X and
   tail lamps at −X for every body in the scene; a model facing the other way
   wears its headlights on the boot.
3. **Trees stand on their own scale.** A loaded `tree.glb` replaces the trunk
   *and* the canopy, and is scaled uniformly — unlike the procedural trunk,
   which is a unit cylinder stretched on Y. Model it upright with the root
   flare at the origin.
4. **Wheels on the ground.** The loader seats the lowest opaque vertex on Y=0,
   so model the vehicle standing on the ground rather than centred on its
   origin. It does not correct a car modelled lying on its side.
5. **Name the glazing.** Any mesh *or* material whose name matches
   `glass|window|windscreen|windshield|glazing` is split out and shaded with
   the scene's own glass material, so windows pick up the dusk sky and the lit
   facade. Everything else keeps the model's own PBR materials.
6. **One consistent vertex layout.** Position and normal on every mesh. Mixed
   indexed/non-indexed is handled; wildly differing attribute sets are not.

## Known limits

- **Wheels do not spin on a loaded model.** The procedural fleet instances its
  tyres separately so they can roll; a GLB is baked into one geometry and its
  wheels are part of the body. Invisible at traffic distance. To fix it, split
  meshes named `wheel*` into their own instanced pass.
- **All three road vehicles swap together, or none do.** A GLB sedan parked
  beside a procedural estate looks worse than either fleet on its own.
- **No LOD yet.** All traffic is already one instanced draw call per body, so
  there is nothing to gain until a real model arrives with a real triangle
  count. Split into near/far instanced meshes then.
- **Draco is wired, the decoder is not vendored.** To ship compressed models,
  copy `node_modules/three/examples/jsm/libs/draco/` to `public/draco/`.

## Licensing

Bring your own. Nothing here is fetched automatically, deliberately — check the
licence of anything you add covers commercial use on a client site.

## Checking what loaded

Run `npm run dev`, open the console, and scroll to the hero. One consolidated
line reports every slot:

```
[models] hero assets — 2/8 loaded
  ✓ sedan.glb       loaded
  ✗ van.glb         missing -> procedural fallback
  ! mixer.glb       rejected -> procedural fallback
```

- `✓ loaded` — the model passed validation and replaced its procedural mesh.
- `✗ missing` — no file at that path. Normal until you add one.
- `!  rejected` — the file is there but broke the contract above. A second
  `console.warn` line says which rule (usually export units). The procedural
  fallback stands either way.

**This is development-only.** Vite compiles `import.meta.env.DEV` to a literal
`false` for production, so minification removes the whole path — it is absent
from the built bundle, not merely silent in it. It is console output and never
renders, so it cannot appear in the site UI.

## Expect 404s in the network tab

Eight `HEAD` requests fire once per page load, one per slot, after the hero is
already interactive. Every one of them 404s until you add the matching file —
that is the mechanism working, not a fault. They are a few hundred bytes each,
they never block a frame, and they keep the console free of loader errors.

The alternative is a manifest listing which models exist, which is one more file
to keep in sync and one more way to add `sedan.glb` and see nothing happen.

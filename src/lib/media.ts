/* ==========================================================================
   MEDIA REGISTRY
   --------------------------------------------------------------------------
   Every visual asset the site uses is declared here as a single source of
   truth. To swap in your own photography / video, just drop the file into
   `public/media/` (or `public/images/`) with the matching name — no code
   changes needed. Until then, each slot falls back to an existing image so
   the site never renders broken.
   ========================================================================== */

const img = (name: string) => `/images/${name}`;

/* ---- IMAGE SLOTS -------------------------------------------------------- */
/* EVERY KEY MUST POINT AT A DIFFERENT FILE. Two keys sharing one path is how
   the same sunset site photo ended up in three sections at once — if you add a
   slot, give it its own photo rather than aliasing an existing one.
   
   FIVE SLOTS ARE CURRENTLY ALIASED, and that is a stopgap, not a decision. The
   photographs they used to point at — construction/04-structure,
   05-multi-floor, 06-glass-installation, 07-exterior-finishing and
   08-landscaping — are no longer in the repository, so every one of them
   rendered as a broken image (which is what took out two of the Client Voices
   thumbnails). They now point at the closest surviving photo by INTENT, which
   is why the duplicate warning at the bottom of this file fires in dev. Restore
   those five files, or drop in replacements, and give each slot its own path
   again.                                                                      */
export const MEDIA = {
  heroPoster:   img('hero_background.webp'),                       // Gallery — golden-hour site
  villa:        img('project_grandeur.webp'),
  heights:      img('project_heights.webp'),
  hub:          img('project_hub.webp'),
  interior:     img('interior_living.webp'),
  residency:    img('project_residency.webp'),
  riverside:    img('project_residency.webp'),                     // Projects — mid-rise on a live street
  gateway:      img('construction/09-completed-building.webp'),   // Alipson Gate — the finished landmark, lit
  studio:       img('studio_desk.webp'),                           // Studio — architect drafting an elevation
  founder:      img('founder_portrait.webp'),                      // Founder — leadership portrait
  /* These two used to alias heroPoster and heights, because the construction
     photographs they wanted were deleted. They now point at real frames of the
     Alipson site — the same project the hero film scrubs through, at a
     different moment, which is what these slots were always describing. */
  team:         img('construction/stage-4-facade.webp'),           // Testimonials thumb — a site at dusk
  workforce:    img('construction/stage-2-columns.webp'),          // Nunny — crews on an active site
  /* Drag-to-compare slider — THE SAME BUILDING, THE SAME CAMERA, THE SAME HOUR.
     That is the whole point of the pairing and it is why these two are not
     aliases of anything else: a wipe between two different buildings shot from
     two different angles reads as a crossfade between stock photos, not as one
     project being finished. Both are 1577x997, so the slider crops neither. */
  stageStructure: img('stage-structure.webp'),                    // RCC frame, crane, crews
  stageDelivered: img('stage-delivered.webp'),                    // delivered, lit, signed
} as const;

export type MediaKey = keyof typeof MEDIA;

/* ---- HERO SCRUB FILM ----------------------------------------------------- */
/* The hero is a scroll-scrubbed frame sequence rendered to a single <canvas>.  */
/* THIS ARRAY IS THE FILM. Order is the timeline; length is the frame rate.     */
/*                                                                             */
/* It currently holds 9 stills, so the player leans on sub-frame cross-blending */
/* to read as continuous motion. That is a stopgap — the effect is only truly   */
/* cinematic with a DENSE sequence rendered from ONE fixed camera:              */
/*                                                                             */
/*   public/images/construction/seq/frame-0001.webp … frame-0600.webp          */
/*   export const HERO_FRAMES = Array.from({ length: 600 }, (_, i) =>          */
/*     img(`construction/seq/frame-${String(i + 1).padStart(4, '0')}.webp`));  */
/*                                                                             */
/* Nothing else needs to change — the player already handles any frame count.   */
/* Keep every frame on the same camera, lens and light direction, or the scrub  */
/* reads as cuts instead of a time-lapse.                                       */
/* EIGHT OF THE NINE FRAMES THIS USED TO NAME WERE DELETED FROM THE REPO. Only
   09-completed-building survived, so the photographic hero was requesting eight
   404s and scrubbing across an almost entirely blank film — which is also why
   five MEDIA slots above had to be aliased onto other photographs.

   These five are the replacement, and they are BETTER than what they replace:
   one building, one camera position, one dusk hour, five genuine construction
   stages — which is exactly the condition the note above sets out ("keep every
   frame on the same camera, lens and light direction, or the scrub reads as
   cuts instead of a time-lapse"). The old set never met it.

   Fewer frames than before (5 vs 9) is fine: the player cross-blends between
   the two frames straddling the playhead, so a sparse sequence still scrubs
   continuously. Add intermediate renders on the same camera and they slot in
   with no code change. */
const FRAME_NAMES = [
  'stage-1-foundation',   // excavation, raft, rebar cages, plant on site
  'stage-2-columns',      // columns and first slabs, shuttering, crews
  'stage-3-frame',        // topped-out RCC frame
  'stage-4-facade',       // glazing going on, crane still standing
  'stage-5-delivered',    // finished, lit, landscaped, signed
];
export const HERO_FRAMES = FRAME_NAMES.map((n) => img(`construction/${n}.webp`));
/* Phone twin of the film: 800px frames, ~45 KB each instead of ~200 KB. The
   canvas is at most 430 CSS px wide on a phone, so the master frames were nine
   full-size downloads for pixels no phone can resolve. */
export const HERO_FRAMES_SMALL = FRAME_NAMES.map((n) => img(`construction/${n}-800.webp`));

export const media = (key: MediaKey) => MEDIA[key];

/* ---- RESPONSIVE VARIANTS -------------------------------------------------
   Every photo ships twice: the full-size original and an 800px-wide `-800`
   companion (see the generator note below). A 390px phone was downloading the
   1672px master — roughly 8× the pixels it can show — which is most of what
   the mobile performance score was paying for.

   INTRINSIC SIZE IS NOT OPTIONAL. `width`/`height` here are what let the
   browser reserve the box before the bytes land; without them every image on
   the page is a layout shift. They are the ORIGINAL pixel dimensions — the
   browser only reads them as a ratio, so the srcset candidate it actually
   picks does not change the reservation.

   To add a photo: drop it in `public/images/`, add the slot to MEDIA, and
   regenerate the -800 companions (Pillow: resize to width 800, quality ~70). */
const DIMS: Record<MediaKey, [number, number]> = {
  heroPoster: [1024, 1024],
  villa: [1024, 1024],
  heights: [1024, 1024],
  hub: [1024, 1024],
  interior: [1024, 1024],
  residency: [1024, 1024],
  riverside: [1024, 1024],
  gateway: [1672, 941],
  studio: [1400, 788],
  founder: [1200, 1800],
  team: [1577, 997],
  workforce: [1608, 978],
  stageStructure: [1577, 997],
  stageDelivered: [1577, 997],
};

/** The 800px companion for a slot — also the right source for a canvas that
 *  will only ever be painted at phone width. */
export const mediaSmall = (key: MediaKey) => MEDIA[key].replace(/\.webp$/, '-800.webp');

/**
 * Spread onto an `<img>`: `<img {...imgProps('villa')} alt="…" />`.
 *
 * `sizes` defaults to the common case on this page — full-bleed on a phone,
 * roughly half the 1200px container on desktop. Pass your own when the element
 * is not that (a fixed-width thumbnail, say), or the browser will over-fetch.
 */
export const imgProps = (key: MediaKey, sizes = '(max-width: 800px) 100vw, 600px') => {
  const src = MEDIA[key];
  const [width, height] = DIMS[key];
  return {
    src,
    srcSet: `${mediaSmall(key)} 800w, ${src} ${width}w`,
    sizes,
    width,
    height,
    loading: 'lazy' as const,
    decoding: 'async' as const,
  };
};

/* The same photo showing up in three sections is invisible in code review and
   obvious on the page. Catch it in dev instead of in a screenshot. */
if (import.meta.env.DEV) {
  const paths = Object.values(MEDIA);
  const dupes = paths.filter((p, i) => paths.indexOf(p) !== i);
  if (dupes.length) console.warn('[media] two keys share one image:', [...new Set(dupes)]);
}

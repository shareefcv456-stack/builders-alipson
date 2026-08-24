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
   slot, give it its own photo rather than aliasing an existing one.           */
export const MEDIA = {
  heroPoster:   img('hero_background.webp'),                       // Gallery — golden-hour site
  villa:        img('project_grandeur.webp'),
  heights:      img('project_heights.webp'),
  hub:          img('project_hub.webp'),
  interior:     img('interior_living.webp'),
  residency:    img('project_residency.webp'),
  riverside:    img('construction/07-exterior-finishing.webp'),   // Projects — riverside park
  gateway:      img('construction/08-landscaping.webp'),          // Alipson Gate — lit portico + step-lit approach
  studio:       img('studio_desk.webp'),                           // Studio — architect drafting an elevation
  founder:      img('founder_portrait.webp'),                      // Founder — leadership portrait
  team:         img('construction/04-structure.webp'),            // Testimonials thumb — a site at dusk
  workforce:    img('construction/06-glass-installation.webp'),   // Nunny — crews on an active site
  /* Drag-to-compare slider — two genuinely different states of the same site. */
  stageStructure: img('construction/05-multi-floor.webp'),        // frame, scaffolding, cranes
  stageDelivered: img('construction/09-completed-building.webp'), // handover, blue hour
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
const FRAME_NAMES = [
  '01-empty-site', '02-foundation', '03-ground-floor', '04-structure', '05-multi-floor',
  '06-glass-installation', '07-exterior-finishing', '08-landscaping', '09-completed-building',
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
  riverside: [1672, 941],
  gateway: [1672, 941],
  studio: [1400, 788],
  founder: [1200, 1800],
  team: [1672, 941],
  workforce: [1672, 941],
  stageStructure: [1672, 941],
  stageDelivered: [1672, 941],
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

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
export const HERO_FRAMES = [
  '01-empty-site', '02-foundation', '03-ground-floor', '04-structure', '05-multi-floor',
  '06-glass-installation', '07-exterior-finishing', '08-landscaping', '09-completed-building',
].map((n) => img(`construction/${n}.webp`));

export const media = (key: MediaKey) => MEDIA[key];

/* The same photo showing up in three sections is invisible in code review and
   obvious on the page. Catch it in dev instead of in a screenshot. */
if (import.meta.env.DEV) {
  const paths = Object.values(MEDIA);
  const dupes = paths.filter((p, i) => paths.indexOf(p) !== i);
  if (dupes.length) console.warn('[media] two keys share one image:', [...new Set(dupes)]);
}

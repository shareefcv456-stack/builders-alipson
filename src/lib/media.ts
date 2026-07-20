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
/* Replace the fallback path by placing a file at the `preferred` path.       */
export const MEDIA = {
  heroPoster:   img('hero_background.png'),
  villa:        img('project_grandeur.png'),
  heights:      img('project_heights.png'),
  hub:          img('project_hub.png'),
  interior:     img('interior_living.png'),
  residency:    img('project_residency.png'),
  team:         img('hero_background.png'),
} as const;

export type MediaKey = keyof typeof MEDIA;

/* ---- HERO VIDEO --------------------------------------------------------- */
/* Drop a file at `public/media/hero.mp4` to activate the cinematic video     */
/* background. If it 404s, the component gracefully shows the parallax poster. */
export const HERO_VIDEO = '/media/hero.mp4';
export const HERO_VIDEO_WEBM = '/media/hero.webm';

export const media = (key: MediaKey) => MEDIA[key];

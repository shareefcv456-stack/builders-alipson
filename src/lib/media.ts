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
/* OPTIONAL upgrade: drop a real cinematic construction film at                */
/* `public/media/hero-construction.mp4` (+ .webm) and it auto-plays over the   */
/* image montage below. Until then the montage is the hero — nothing 404s.     */
export const HERO_VIDEO = '/media/hero-construction.mp4';
export const HERO_VIDEO_WEBM = '/media/hero-construction.webm';

/* ---- HERO CINEMATIC MONTAGE --------------------------------------------- */
/* An 8-chapter construction documentary told as a slow cross-dissolve of      */
/* real site imagery. Swap any `image` key for a better-matched photo by       */
/* dropping the file into public/images/ and pointing MEDIA at it.             */
export type HeroScene = { image: MediaKey; idx: string; title: string; caption: string };

export const HERO_SCENES: HeroScene[] = [
  { image: 'team',      idx: '01', title: 'Mobilization',      caption: 'Crews arrive at first light — helmets on, site alive.' },
  { image: 'hub',       idx: '02', title: 'Survey & Design',   caption: 'Engineers set the level, blueprint meets ground.' },
  { image: 'heights',   idx: '03', title: 'Groundworks',       caption: 'Earth moves, machinery carves the foundation.' },
  { image: 'residency', idx: '04', title: 'Reinforcement',     caption: 'Steel is tied, columns rise from the footing.' },
  { image: 'hub',       idx: '05', title: 'The Pour',          caption: 'Concrete flows — the structure takes hold.' },
  { image: 'heights',   idx: '06', title: 'The Rise',          caption: 'Cranes lift the frame, floor upon floor.' },
  { image: 'interior',  idx: '07', title: 'Finishing',         caption: 'Facades, glass and craft bring it to life.' },
  { image: 'villa',     idx: '08', title: 'Delivered',         caption: 'A landmark, handed over. Built to last.' },
];

export const media = (key: MediaKey) => MEDIA[key];

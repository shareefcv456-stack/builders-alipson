import { isCapture } from '../lib/capture';

/**
 * The flat charcoal plate behind every section.
 *
 * IT USED TO BE A SCROLL-SCRUBBED DRONE VIDEO, and the machinery for that was
 * still here: a `<video>`, a `loadedmetadata` handler and a GSAP ScrollTrigger
 * tween of `currentTime`, all behind `const SRC = ''`. With no file to point
 * at, the video element never rendered, so `videoRef.current` was null, so the
 * effect returned on its first line — on every load, of every page, forever.
 *
 * What it cost was not the effect but the IMPORT: `gsap` and `gsap/ScrollTrigger`
 * at module scope, plus a second `registerPlugin` call, pulled into the eager
 * graph for a code path that could not run. The plate itself is two divs.
 *
 * To bring the drone back, restore this file from git (`git log -- <this path>`)
 * and drop the clip in `public/videos/` — the scrub was ~20 lines and is better
 * recovered whole than kept here as a switch that is always off.
 */
export default function DroneBackground() {
  if (isCapture()) return null;

  return (
    <div className="fixed inset-0 z-[-1] w-full h-full pointer-events-none bg-[#0D1117]" aria-hidden>
      {/* Flat charcoal veil. This used to carry `backdrop-blur-sm`: a FIXED,
          full-viewport backdrop-filter forces the compositor to re-read
          everything behind it on every frame of every scroll, for the entire
          length of the page — and at z-[-1], behind opaque sections, it had
          nothing visible to blur in the first place. */}
      <div className="absolute inset-0 z-0 bg-black/70" />
    </div>
  );
}

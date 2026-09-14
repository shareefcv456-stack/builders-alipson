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
    /* ONE LAYER. This was a #0D1117 plate with a second full-viewport div of
       black at 70% on top — two fixed full-screen surfaces composited on every
       frame to produce one flat colour. #040507 IS that colour, pre-mixed. */
    <div className="fixed inset-0 z-[-1] w-full h-full pointer-events-none bg-[#040507]" aria-hidden />
  );
}

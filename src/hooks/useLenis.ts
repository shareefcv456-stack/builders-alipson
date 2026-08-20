import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Buttery smooth-scroll driven by Lenis, RAF-synced. Exposes the instance on
 * window so anchor navigation can defer to it. Respects reduced-motion.
 */
export function useLenis() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const noLenis = window.location.search.includes('nolenis');
    if (reduce || noLenis) return;

    /* `lerp`, not `duration` + `easing`. Lenis accepts either, and lerp is the
       frame-rate-independent one: it eases a fixed FRACTION of the remaining
       distance each frame, so a 120Hz iPad and a 60Hz phone converge over the
       same wall-clock time. The duration/easing pair replays a fixed-length
       curve per scroll event, which is what made fast successive flicks feel
       like they were queueing. */
    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      wheelMultiplier: 1,
      /* TOUCH. `syncTouch` is v1's name for what the brief calls `smoothTouch`
         — it keeps the page locked to the finger instead of running the wheel
         smoothing over a touch drag, which is what causes the rubber-banding
         and the perceived latency on iOS Safari.
         `syncTouchLerp` is kept light on purpose. Under syncTouch the finger is
         driving directly, so heavy smoothing there reads as lag rather than as
         polish — this is the "light dampening" the brief asks for, not the
         wheel's easing curve applied to a drag. */
      syncTouch: true,
      syncTouchLerp: 0.09,
      touchInertiaExponent: 1.7,
      touchMultiplier: 1.6,
    });

    (window as unknown as { lenis?: Lenis }).lenis = lenis;

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      (window as unknown as { lenis?: Lenis }).lenis = undefined;
    };
  }, []);
}

/** Height of the floating navbar capsule — sections stop below it, not under it. */
const NAV_OFFSET = 100;

/**
 * Smooth-scroll to a section id, using Lenis when present. Falls back to native
 * smooth scrolling, and to an instant jump under reduced-motion (where Lenis is
 * never created, so `behavior: smooth` would be the one animation left running).
 */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const lenis = (window as unknown as { lenis?: Lenis }).lenis;
  if (lenis) {
    lenis.scrollTo(el, { offset: -NAV_OFFSET, duration: 1.4 });
    return;
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const y = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
  window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
}

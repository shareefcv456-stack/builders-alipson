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

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
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

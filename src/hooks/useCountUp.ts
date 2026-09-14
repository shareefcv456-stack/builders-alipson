import { useEffect, useRef } from 'react';

/**
 * Counts from 0 → `end` once the element scrolls into view, writing the number
 * straight into the ref'd element. Not state: a setState per frame was ~480
 * React renders across the four stat cards, inside the pinned hero, while GSAP
 * and WebGL were fighting for the same frames. Render the element with `0`.
 */
export function useCountUp(end: number, duration = 2000) {
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.textContent = end.toLocaleString();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const tick = (now: number) => {
              const p = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - p, 3);
              el.textContent = Math.round(eased * end).toLocaleString();
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end, duration]);

  return ref;
}

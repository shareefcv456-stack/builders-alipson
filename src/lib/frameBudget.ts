import { isTouch } from './device.js';

/**
 * ADAPTIVE GLASS.
 *
 * `data-perf="low"` (the probe in index.html) guesses a weak device from RAM and
 * core count before first paint, and misses the case that matters most here: a
 * 6-8 GB phone with a weak GPU. It reports as capable, then drops frames
 * compositing every blurred surface while it scrolls.
 *
 * This watches what the device actually does — only on touch devices, only while
 * the page is scrolling, and only once. Two consecutive windows with more than
 * 30% slow frames set the same attribute, and the stylesheet's existing low-end
 * rules swap each blur for an opaque fill in the same colour. Nothing else
 * changes, and a capable phone never trips it.
 */

const WINDOW = 90;      // frames per verdict
const SLOW_MS = 24;     // slower than ~42fps
const STALL_MS = 250;   // a one-off stall (a chunk parsing), not a device that cannot composite
const SLOW_SHARE = 0.3;
const STRIKES = 2;

/** Feed frame durations; returns true once the device should drop to low-end glass. */
export function frameBudget() {
  let n = 0, slow = 0, strikes = 0;
  return (d: number) => {
    if (d <= 0 || d >= STALL_MS) return false;
    n++;
    if (d > SLOW_MS) slow++;
    if (n < WINDOW) return false;
    strikes = slow / n > SLOW_SHARE ? strikes + 1 : 0;
    n = slow = 0;
    return strikes >= STRIKES;
  };
}

export function watchFrameBudget() {
  const root = document.documentElement;
  if (!isTouch() || root.dataset.perf === 'low') return;

  const sample = frameBudget();
  let raf = 0, last = 0, lastScroll = 0;

  const tick = (now: number) => {
    // Parked the moment scrolling stops: nothing runs on an idle page.
    if (now - lastScroll > 300) { raf = 0; last = 0; return; }
    if (last && sample(now - last)) {
      root.dataset.perf = 'low';
      window.removeEventListener('scroll', onScroll);
      raf = 0;
      return;
    }
    last = now;
    raf = requestAnimationFrame(tick);
  };
  const onScroll = () => {
    lastScroll = performance.now();
    if (!raf) raf = requestAnimationFrame(tick);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}

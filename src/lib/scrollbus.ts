/**
 * ONE SCROLL LISTENER FOR THE WHOLE APPLICATION, and one cached viewport.
 *
 * Navbar and FloatingActions each ran their own `scroll` listener, each with
 * its own rAF coalescer, each reading `window.scrollY` — two subscriptions
 * computing the same number on the same frame, plus a third inside
 * `gateOpenScroll()` reading `innerWidth`/`innerHeight` per sample.
 *
 * That last one is the expensive part and the reason this module exists.
 * `scrollY`, `innerWidth` and `innerHeight` are all live-layout reads: asking
 * for one while the page has pending style changes forces the browser to run
 * layout before it can answer. This page has pending changes on every single
 * scroll frame — GSAP's pin rewrites the hero's transform and the pin-spacer's
 * height as you scroll — so those reads were landing squarely in the
 * read-after-write pattern Lighthouse reports as forced reflow.
 *
 * So: read the scroll position ONCE per frame, hand the same number to every
 * subscriber, and treat the viewport as a value that only changes on `resize`.
 * Subscribers do arithmetic on numbers; nobody touches the DOM to find out
 * where the page is.
 */

type Fn = (y: number) => void;

const subs = new Set<Fn>();
let raf = 0;

/* Viewport, cached. A phone fires `resize` when the URL bar collapses, on
   rotation and on a soft-keyboard open — every case that can actually change
   these — so the cache can never go stale in a way a visitor would see. */
let vw = typeof window === 'undefined' ? 0 : window.innerWidth;
let vh = typeof window === 'undefined' ? 0 : window.innerHeight;

export const viewportW = () => vw;
export const viewportH = () => vh;

const flush = () => {
  raf = 0;
  const y = window.scrollY;
  for (const fn of subs) fn(y);
};

const onScroll = () => { if (!raf) raf = requestAnimationFrame(flush); };

const onResize = () => {
  vw = window.innerWidth;
  vh = window.innerHeight;
  onScroll();               // thresholds derived from the viewport just moved
};

/**
 * Subscribe to the scroll position, delivered at most once per animation frame
 * and never more than once per frame across all subscribers combined.
 *
 * `fn` is called immediately with the current position, because a deep link or
 * a reload can land mid-page and a handler that waits for the first scroll
 * event would render the wrong state until the visitor moved.
 *
 * Returns the unsubscribe. The window listeners are attached on the first
 * subscriber and removed after the last, so nothing is left running when the
 * app unmounts.
 */
export function onScrollFrame(fn: Fn): () => void {
  if (!subs.size) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
  }
  subs.add(fn);
  fn(window.scrollY);
  return () => {
    subs.delete(fn);
    if (subs.size) return;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
}

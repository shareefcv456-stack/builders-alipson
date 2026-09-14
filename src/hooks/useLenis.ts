import { useEffect } from 'react';
import type Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { isLite, isTouch } from '../lib/device';
import { PATH_FOR_SECTION, navigate, currentPath } from '../router';

/**
 * Buttery smooth-scroll driven by Lenis, RAF-synced. Exposes the instance on
 * window so anchor navigation can defer to it. Respects reduced-motion.
 */
export function useLenis() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const noLenis = window.location.search.includes('nolenis');
    /* NO SMOOTH-SCROLL LAYER ON A PHONE — this is the single biggest thing
       standing between a mid-range Android and a smooth scroll on this page.
       `syncTouch` means Lenis preventDefaults every touchmove, integrates the
       position itself and drives the page with `scrollTo` on its own rAF: the
       finger stops talking to the compositor's scroller and starts talking to
       the main thread, which on this page is also running GSAP's pin, a WebGL
       hero and two 2D canvases. Every frame the main thread misses is a frame
       the scroll misses — that is the lag, and no amount of tuning `lerp` fixes
       it, because the cost is the architecture and not the easing.
       Taking it off hands scrolling back to the compositor, where it is
       hardware-accelerated and cannot be blocked by JS at all. Nothing visual
       is lost: every scroll-driven animation here is driven by ScrollTrigger,
       which reads the native scroll position either way, and momentum on a
       touch screen is the platform's job and better than ours.
       Desktop keeps the smooth wheel exactly as authored. */
    /* `isTouch` too — a TABLET is not `isLite` (768px+), and it was getting
       Lenis with `syncTouch`, i.e. the exact scroll-jacking described above on
       an iPad. A device with no real cursor has no wheel to smooth, so it gets
       nothing but the platform's own momentum. */
    if (reduce || noLenis || isLite() || isTouch()) return;

    /* DYNAMIC, so the bail-out above is a real saving and not just a skipped
       constructor. Statically imported, the library was fetched, parsed and
       kept in the entry graph on every load — including the phone loads that
       take the branch above and never instantiate it. Behind `import()` the
       chunk is requested only on the desktop path that uses it, and it is
       requested AFTER first paint either way.
       `cancelled` covers the unmount-before-resolve case, which is real in
       StrictMode: the effect runs, cleans up and runs again before the module
       has landed, and without it the first run's instance leaks a rAF loop. */
    let cancelled = false;
    let lenis: Lenis | undefined;
    let tick: ((t: number) => void) | undefined;

    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;

      /* `lerp`, not `duration` + `easing`. Lenis accepts either, and lerp is
         the frame-rate-independent one: it eases a fixed FRACTION of the
         remaining distance each frame, so a 120Hz iPad and a 60Hz phone
         converge over the same wall-clock time. The duration/easing pair
         replays a fixed-length curve per scroll event, which is what made fast
         successive flicks feel like they were queueing. */
      lenis = new Lenis({
        lerp: 0.1,
        smoothWheel: true,
        wheelMultiplier: 1,
        /* TOUCH IS NEVER OURS. A hybrid (touch laptop) can still reach here;
           leaving `syncTouch` off means a finger scrolls natively, with the
           platform's momentum, and Lenis only follows the resulting position. */
        syncTouch: false,
      });

      (window as unknown as { lenis?: Lenis }).lenis = lenis;

      /* ONE CLOCK. Lenis used to run its own rAF loop beside GSAP's ticker, and
         ScrollTrigger only heard about a Lenis move through the native scroll
         event it caused — a frame late, which is the pin jitter and the
         stepping scrub. StoryScroll tried to subscribe, but its layout effect
         runs before this dynamic import lands, so `window.lenis` was always
         undefined there. Driving Lenis from the ticker and pushing every scroll
         straight into ScrollTrigger puts both on the same frame. */
      lenis.on('scroll', ScrollTrigger.update);
      tick = (t: number) => lenis!.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    });

    return () => {
      cancelled = true;
      if (tick) gsap.ticker.remove(tick);
      lenis?.destroy();
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
  /* A SECTION THAT IS NOT ON THIS PAGE IS NOT A DEAD LINK ANY MORE — it is a
     link to that section's own page. Every caller of this routes through here
     (the services CTA, the hero's "Explore Projects", the card "Explore"
     buttons), so one guard fixes all of them at once instead of each caller
     growing its own is-it-here check. On the home page nothing changes: every
     id resolves, and the smooth scroll below runs exactly as before. */
  if (!document.getElementById(id)) {
    const to = PATH_FOR_SECTION[id];
    if (to && to !== currentPath()) navigate(to);
    return;
  }
  const lenis = (window as unknown as { lenis?: Lenis }).lenis;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* IT RE-AIMS WHILE THE PAGE IS STILL GROWING UNDER IT.
     Everything below the fold is mounted on approach by <Deferred>, whose
     placeholder is a `min-height` guess and never the real section's height. So
     a jump from the middle of the page to "Contact" flies past four or five
     placeholders, each of which swaps in taller (or shorter) content WHILE the
     scroll is in flight — and the destination that was computed at the start of
     the animation is metres away from where the section actually ends up. That
     is the "stops above/below the section" bug, and it is worst for the two
     links furthest down the page, which have the most placeholders to cross.
     Nothing can pre-compute this: the heights do not exist until the sections
     render. So re-measure instead, and re-issue only when the answer MOVED —
     both Lenis and the native smooth scroller accept a new target mid-flight
     and retarget smoothly, so a correction reads as one continuous glide, not
     as a second jump. Once the target stops moving the loop issues nothing.

     It also yields: the first wheel notch or finger down means the visitor has
     taken over, and fighting them for the next second is worse than landing a
     few pixels off. */
  let aimed = -1;
  let lastAt = -1;
  let issuedAt = 0;
  let settled = 0;
  let live = true;
  const surrender = () => { live = false; };
  const opts = { once: true, passive: true } as const;
  window.addEventListener('wheel', surrender, opts);
  window.addEventListener('touchstart', surrender, opts);

  /* THE BUDGET IS WALL CLOCK, NOT A COUNT OF TRIES, and that distinction is
     load-bearing on a phone. Counting tries looks equivalent until the main
     thread stalls — and on this page it does, for seconds, while the 3D chunk
     parses and its shaders compile. Every `setTimeout` queued during that stall
     comes due the instant it ends and fires as ONE burst, so an attempt budget
     drains to zero in a few milliseconds without the page having moved a pixel,
     and the loop gives up precisely when the scroll most needs correcting.
     A deadline cannot be spent by a stall: whatever the main thread was doing,
     there is still time on the clock when it comes back. */
  const DEADLINE = performance.now() + 7000;

  const issue = (to: number, from: number) => {
    issuedAt = performance.now();
    /* Corrections are short. The opening move is a 1.4s glide across the page;
       a 40px nudge after the last section landed is not, and easing that over
       the same 1.4s is what would read as the page drifting on after it had
       visibly stopped. */
    const dur = Math.min(1.4, Math.max(0.3, Math.abs(to - from) / 1600));
    if (lenis) lenis.scrollTo(to, { duration: dur });
    else window.scrollTo({ top: to, behavior: reduce ? 'auto' : 'smooth' });
  };

  const aim = () => {
    const el = live ? document.getElementById(id) : null;
    if (el) {
      const at = Math.round(window.scrollY);
      const y = Math.round(el.getBoundingClientRect().top + at - NAV_OFFSET);
      /* Sitting on the last scrollable pixel and still being asked for more is
         as arrived as the page can get — the last section is simply shorter
         than the viewport. Without this the loop would re-issue a scroll that
         cannot move for the whole of its budget. */
      const atMax = at >= document.documentElement.scrollHeight - window.innerHeight - 2;
      const arrived = Math.abs(at - y) <= 2 || (atMax && y > at);
      const moving = at !== lastAt;
      lastAt = at;

      /* RE-ISSUE WHEN THE SCROLL HAS COME TO REST SHORT — not while it is still
         travelling. That is the whole correction, and it covers both ways this
         goes wrong: a scroll is CLAMPED to the page height at the moment it is
         issued, so aiming at the footer across un-mounted sections pins to the
         current maximum and never retries once the page grows; and a <Deferred>
         placeholder swapping in a different height moves the target mid-flight.
         Both end the same way — stopped, somewhere that is not the section.
         Re-aiming MID-FLIGHT is what must not happen: Lenis restarts its ease
         from the current position on every call, so with sections still
         arriving and the target moving on every sample, each re-aim outruns the
         one before and the scroll never converges — it just crawls and then
         gets abandoned. The exception is a target that has jumped a long way,
         where continuing to the old spot is visibly wrong; that is rate-limited
         so it can never become the per-sample restart it replaced. */
      const jumped = aimed >= 0 && Math.abs(y - aimed) > 240 && performance.now() - issuedAt > 500;
      if (aimed < 0 || (!moving && !arrived) || jumped) {
        settled = 0;
        aimed = y;
        issue(y, at);
      } else if (arrived) settled++;
      else settled = 0;

      /* Stop on STILLNESS, not on the stopwatch — the deadline is only the
         backstop. Three quiet samples in a row means the sections have finished
         arriving and the destination has stopped moving. */
      if (settled < 3 && performance.now() < DEADLINE) { window.setTimeout(aim, 200); return; }
    }
    window.removeEventListener('wheel', surrender);
    window.removeEventListener('touchstart', surrender);
  };
  aim();
}

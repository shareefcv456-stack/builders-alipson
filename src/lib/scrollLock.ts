/* ==========================================================================
   PAGE SCROLL LOCK — THE PART THAT TOUCHES THE DOCUMENT
   --------------------------------------------------------------------------
   Split out of the React hook so it can be driven, and proven, without a
   renderer — see `scrollLock.check.ts`. The reasoning lives here:

     * LENIS IS THE SCROLLER. It preventDefaults wheel/touch on the window and
       moves the page itself, so `overflow: hidden` on the document is not in
       its path at all — the background kept gliding behind an open modal.
       `stop()` makes Lenis swallow both gestures (lenis.mjs: `if
       (this.isStopped) … preventDefault(); return`), which is the only thing
       that stops a trackpad or a finger on this page.
     * The overflow rule still earns its place: it covers the keyboard (space,
       Page Down, arrows), the scrollbar drag, and the reduced-motion /
       `?nolenis` path where Lenis is never constructed.
     * It goes on <html>, NOT <body>. Body carries `overflow-x: clip` — the one
       value that does not turn it into a scroll container — and an inline
       `overflow: hidden` would overwrite that axis and break the sticky
       project showcase underneath.
     * `scrollbar-gutter: stable` (index.css) keeps the gutter reserved while
       that scrollbar is gone, so nothing shifts sideways on open or close.

   REFCOUNTED, because two overlays can be open at once — the project sheet's
   "Enquire about this project" opens the quote modal on top of it — and with a
   boolean, the first one to close unlocked the page under the second.
   ========================================================================== */
type LenisLike = { stop: () => void; start: () => void };

let locks = 0;
let restoreY = 0;

const lenis = () => (window as unknown as { lenis?: LenisLike }).lenis;

/** Lock the page. Balanced by exactly one `unlockScroll()`. */
export function lockScroll() {
  if (++locks > 1) return;
  restoreY = window.scrollY;
  lenis()?.stop();
  document.documentElement.style.overflow = 'hidden';
}

/** Release one lock. The page only moves again when the last one goes. */
export function unlockScroll() {
  if (locks === 0 || --locks > 0) return;
  document.documentElement.style.overflow = '';
  lenis()?.start();
  /* Belt and braces: `overflow: hidden` holds the offset on every browser we
     care about, but Safari has been known to clamp it while the document is
     unscrollable. Only fires if something actually moved. */
  if (window.scrollY !== restoreY) window.scrollTo(0, restoreY);
}

/** Test seam — the refcount is module state, and each case starts clean. */
export function __resetScrollLock() {
  locks = 0;
  restoreY = 0;
}

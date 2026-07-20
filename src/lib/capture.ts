/**
 * Capture mode — active only when the URL carries `?noloader` (used for
 * automated screenshots/QA). In this mode scroll-reveal primitives render in
 * their final state so headless browsers, which don't fire IntersectionObserver
 * under virtual-time, still show fully-composed sections. No effect in prod.
 */
export const isCapture = (): boolean =>
  typeof window !== 'undefined' && window.location.search.includes('noloader');

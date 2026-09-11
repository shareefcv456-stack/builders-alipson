import { useEffect, useState } from 'react';

/**
 * SIX STATIC ROUTES, NO ROUTER DEPENDENCY.
 *
 * react-router is ~20 KB for a feature set this site does not have: there are
 * no route params, no nested layouts, no loaders, no guards — six fixed paths
 * that each render one section. `history.pushState` plus a `popstate` listener
 * is the whole of what is actually needed, so that is what this is.
 *
 * WHY A CUSTOM EVENT. `pushState` deliberately does NOT fire `popstate` — only
 * the back/forward buttons do. So a click would change the URL and render
 * nothing. Re-dispatching `popstate` ourselves gives both paths one listener to
 * subscribe to instead of two code paths that can drift.
 */

/** Path → the section id that route renders. ONE source of truth: the navbar,
 *  the footer, the scrollspy and the anchor fallback all read it. */
export const ROUTES = {
  '/': 'hero',
  '/story': 'studio',
  '/projects': 'work',
  '/services': 'services',
  '/founder': 'founder',
  '/contact': 'contact',
} as const;

export type Path = keyof typeof ROUTES;

/** The inverse, for `scrollToId`'s fallback: a link to a section that is not on
 *  THIS page is not a dead link, it is a link to that section's own page. */
export const PATH_FOR_SECTION: Record<string, Path> = {
  hero: '/',
  studio: '/story',
  work: '/projects',
  services: '/services',
  founder: '/founder',
  contact: '/contact',
  /* The navbar's "Contact" has always pointed at #footer on the long page, and
     /contact renders the contact section with the footer beneath it — so both
     ids resolve to the same page rather than leaving `footer` unrouted. */
  footer: '/contact',
};

/** Trailing slashes and casing are the two ways the same route arrives looking
 *  like two. Normalise once, here, so nothing downstream has to think about it. */
export const normalize = (p: string): string => {
  const clean = p.replace(/\/+$/, '').toLowerCase();
  return clean === '' ? '/' : clean;
};

export const currentPath = (): string =>
  typeof window === 'undefined' ? '/' : normalize(window.location.pathname);

/** True for a path this app actually serves — anything else falls through to
 *  the home page rather than rendering a blank <main>. */
export const isKnown = (p: string): p is Path => p in ROUTES;

export function navigate(to: string) {
  const next = normalize(to);
  if (next === currentPath()) {
    /* Same page: honour it as "take me to the top", which is what clicking the
       current item in a navbar means everywhere else on the web. */
    toTop();
    return;
  }
  window.history.pushState({}, '', next);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** A new page starts at its top. Lenis keeps its own scroll position and will
 *  happily animate the new page back to wherever the old one was left, so it
 *  has to be told too — `immediate` because this is a page change, not a glide. */
export function toTop() {
  const lenis = (window as unknown as { lenis?: { scrollTo: (t: number, o?: object) => void } }).lenis;
  if (lenis) lenis.scrollTo(0, { immediate: true });
  window.scrollTo(0, 0);
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

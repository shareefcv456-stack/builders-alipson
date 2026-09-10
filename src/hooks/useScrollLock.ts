import { useEffect, type RefObject } from 'react';
import { lockScroll, unlockScroll } from '../lib/scrollLock';

/**
 * ONE lock for every overlay on the site (the project sheet, the gallery
 * lightbox, the quote/brochure/video modals). The document work and the
 * reasoning behind it live in `lib/scrollLock`; this is just the lifecycle.
 */
export function useScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    lockScroll();
    return unlockScroll;
  }, [open]);
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab inside the open panel and hands focus back to whatever opened it.
 * Without this, tabbing out of a modal walks the navbar and the page behind it
 * — invisible focus, on controls the scrim is meant to have taken away.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    /* `preventScroll` matters: focusing a node inside a fixed overlay is
       otherwise enough to make the browser scroll the locked page under it. */
    ref.current?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      const panel = ref.current;
      if (e.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return e.preventDefault();
      const [first] = items;
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (!panel.contains(at)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.({ preventScroll: true });
    };
  }, [ref, open]);
}

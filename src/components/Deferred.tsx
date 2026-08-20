import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Mounts a below-the-fold section only once it is close to the viewport, so its
 * chunk is fetched and its subtree rendered on approach rather than at load.
 *
 * TWO THINGS MAKE THIS SAFE, and both matter:
 *
 * 1. THE PLACEHOLDER CARRIES THE SECTION'S `id`. `scrollToId` resolves anchors
 *    with `getElementById`, so without this every nav link to a not-yet-mounted
 *    section would silently do nothing. The placeholder answers the lookup, the
 *    scroll starts, the observer trips on approach and the real section takes
 *    its place.
 * 2. `rootMargin` IS LARGE. 1200px means a section mounts roughly a viewport
 *    early, so at any normal scroll speed the content is already there. A tight
 *    margin turns this into visible pop-in, which is worse than the bytes.
 *
 * `minHeight` reserves space so the page does not collapse to nothing and then
 * grow as sections arrive — the scrollbar stays roughly honest either way.
 */
export default function Deferred({
  id, minHeight = '70vh', children,
}: { id: string; minHeight?: string; children: ReactNode }) {
  // A deep link lands mounted: the hash names the section, so waiting for an
  // observer that has not been created yet would race the browser's own jump.
  const [show, setShow] = useState(
    () => typeof window !== 'undefined' && window.location.hash === `#${id}`
  );
  const slot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show || !slot.current) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setShow(true); },
      { rootMargin: '1200px 0px' }
    );
    io.observe(slot.current);
    return () => io.disconnect();
  }, [show]);

  if (show) return <Suspense fallback={<div style={{ minHeight }} aria-hidden />}>{children}</Suspense>;
  return <div ref={slot} id={id} style={{ minHeight }} aria-hidden />;
}

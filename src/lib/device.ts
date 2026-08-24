/**
 * Device tier probe. One place, because three separate files were about to
 * grow their own `innerWidth < 768` check and drift apart.
 *
 * `isPhone` is a layout question. `isLite` is a BUDGET question: phone-sized,
 * or a machine the boot probe in index.html flagged as low-end, or a visitor
 * who has asked for less (Save-Data, reduced motion). Anything expensive and
 * decorative — the cinematic intro, the WebGL hero — is gated on `isLite`,
 * not on width alone.
 */
export const isPhone = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

type NetInfo = { saveData?: boolean; effectiveType?: string };

export const isLite = () => {
  if (typeof window === 'undefined') return false;
  const net = (navigator as Navigator & { connection?: NetInfo }).connection;
  return (
    isPhone() ||
    document.documentElement.dataset.perf === 'low' ||
    net?.saveData === true ||
    /^(slow-)?2g$/.test(net?.effectiveType ?? '') ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
};

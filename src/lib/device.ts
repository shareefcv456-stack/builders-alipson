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

/**
 * BUDGET ONLY — what this machine can afford to draw. Phone-sized, or flagged
 * low-end by the boot probe, or on a metered/slow connection.
 *
 * DELIBERATELY EXCLUDES prefers-reduced-motion, which `isLite` includes. The
 * two questions look alike and are not: "should this autoplay?" is answered by
 * the motion preference, "how many shadow maps can this GPU push?" is not. A
 * fast desktop whose owner asked for less motion still deserves its shadows and
 * its ambient occlusion — it is going to render one held frame either way, and
 * quietly downgrading that frame is a fidelity regression dressed up as an
 * accessibility feature. The hero renderer wants THIS probe; the things that
 * decide whether to move want `isLite`.
 */
export const isLowPower = () => {
  if (typeof window === 'undefined') return false;
  const net = (navigator as Navigator & { connection?: NetInfo }).connection;
  return (
    isPhone() ||
    document.documentElement.dataset.perf === 'low' ||
    net?.saveData === true ||
    /^(slow-)?2g$/.test(net?.effectiveType ?? '')
  );
};

/**
 * NO REAL CURSOR — a phone or a tablet. Distinct from `isPhone` (a width) and
 * from `isLite` (a budget): this is the question autoplay policy answers to.
 * Every mobile browser refuses to start an UNMUTED video, however it was
 * triggered, so the thing that needs to know is "is this a touch device", not
 * "is this screen narrow" and not "can this GPU cope".
 */
export const isTouch = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

/**
 * A REAL CURSOR IS PRESENT — the JS twin of the `@media (hover: hover) and
 * (pointer: fine)` fence the stylesheet puts every `:hover` rule behind. A
 * framer-motion `whileHover` is driven by pointerenter/pointerleave, which CSS
 * cannot reach: on a touch screen the enter fires on tap and the leave may
 * never come, so the card stays lifted. Anything hover-driven in JS asks this
 * first, and asks it with the SAME query the CSS uses, so the two can never
 * disagree about whether this device hovers.
 */
export const canHover = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export const isLite = () =>
  typeof window !== 'undefined' &&
  (isLowPower() || window.matchMedia('(prefers-reduced-motion: reduce)').matches);

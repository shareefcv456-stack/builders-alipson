import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LogoMark } from './ui/Logo';
import { isCapture } from '../lib/capture';

/**
 * Cinematic opening — three beats over a modern-house line drawing that draws
 * itself on its crimson ground line.
 *
 *   1 · "We don't build buildings."
 *   2 · "We create places where dreams become reality."
 *   3 · brand reveal → homepage
 *
 * No photography — the drawn house, the scrim glow and the copy carry it.
 * Advances on its own timer, or on click / wheel / key; the skip pill drops
 * straight to the site.
 */
const SLIDES = [
  { title: "We don't build buildings." },
  { title: 'We create places where dreams become reality.' },
  { title: '' }, // brand reveal
];

/* The house: main volume, lower wing, cantilever, mullions, tree — drawn in
   build order, then closed by the crimson ground line. */
const VILLA = [
  'M170 360 L170 232 L520 232 L520 360',                                  // main volume
  'M520 300 L820 300 L820 360',                                           // lower wing
  'M170 232 L170 200 L430 200 L520 232',                                  // upper cantilever
  'M250 360 L250 232 M330 360 L330 232 M410 360 L410 232 M600 360 L600 300 M690 360 L690 300 M770 360 L770 300',
  'M120 360 L120 300 M120 300 Q150 250 120 300',                          // slim tree trunk
];

// Shorter timing on mobile to improve LCP/FCP
const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;
const STEP_MS = isMobile() ? [1800, 2000, 2100] : [2900, 3200, 3200];
const EASE = 'easeInOut' as const;

/** `?introstep=1` freezes the intro on one frame — for screenshots/QA. */
const pinnedStep = () => {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('introstep');
  return v === null ? null : Math.min(Math.max(+v, 0), SLIDES.length - 1);
};

export default function CinematicIntro({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const skip = isCapture() || !!reduce;
  const pinned = pinnedStep();
  const [step, setStep] = useState(pinned ?? 0);

  const finish = useCallback(() => { onDone(); }, [onDone]);
  const next = useCallback(() => {
    if (pinned !== null) return;
    setStep((s) => (s + 1 >= SLIDES.length ? (finish(), s) : s + 1));
  }, [finish, pinned]);

  // One timer per beat, restarted on manual advance so a click doesn't leave a
  // stale timeout racing the new slide.
  useEffect(() => {
    if (skip || pinned !== null) return;
    const t = window.setTimeout(next, STEP_MS[step]);
    return () => clearTimeout(t);
  }, [step, skip, pinned, next]);

  useEffect(() => {
    if (skip) { finish(); return; }
    const onKey = (e: KeyboardEvent) => { if (['Escape', 'Enter', ' '].includes(e.key)) finish(); };
    const onWheel = () => next();
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('wheel', onWheel); };
  }, [skip, finish, next]);

  if (skip) return null;

  const slide = SLIDES[step];
  const brand = step === SLIDES.length - 1;

  return (
    <motion.div
      className="intro"
      onClick={next}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      <div className="intro__scrim" aria-hidden />
      <div className="intro__glow" aria-hidden />
      <div className="intro__rays" aria-hidden />

      {/* House outline — draws itself once, then a slow camera push-in */}
      <div className="intro__villaWrap" aria-hidden>
        <motion.svg
          className="intro__villa"
          viewBox="0 0 1000 460"
          preserveAspectRatio="xMidYMid meet"
          initial={{ scale: 1.08, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 9, ease: 'linear' }}
        >
          {VILLA.map((d, i) => (
            <motion.path
              key={i}
              d={d}
              fill="none"
              stroke="rgba(248,248,246,0.55)"
              strokeWidth={1.4}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.7 }}
              transition={{ duration: 2.4, ease: EASE, delay: 0.2 + i * 0.28 }}
            />
          ))}
          <motion.circle
            cx="120" cy="300" r="26" fill="none" stroke="rgba(248,248,246,0.4)" strokeWidth={1.2}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, delay: 1.8, ease: EASE }}
          />
          {/* Crimson ground line — the base everything stands on */}
          <motion.path
            d="M60 360 L940 360" fill="none" stroke="var(--accent)" strokeWidth={1.6}
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.9 }}
            transition={{ duration: 2.6, delay: 0.4, ease: EASE }}
          />
        </motion.svg>
      </div>

      {/* Copy layer */}
      <div className="intro__stage">
        <AnimatePresence mode="wait">
          {brand ? (
            <motion.div
              key="brand"
              className="intro__brand"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              <motion.div
                initial={{ scale: 0.75, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: EASE }}
              >
                <LogoMark size={54} />
              </motion.div>
              <motion.h1
                className="intro__wordmark"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
              >
                ALIPSON BUILDERS
              </motion.h1>
              <motion.span
                className="intro__rule"
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
              />
              <motion.p
                className="intro__tagline"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.75, ease: EASE }}
              >
                Dream It. Build It. Own It.
              </motion.p>
            </motion.div>
          ) : (
            <motion.p
              key={step}
              className="intro__line"
              initial={{ opacity: 0, filter: 'blur(6px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(6px)' }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              {slide.title}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <button
        className="intro__skip"
        /* SKIP is not the same as letting the intro run out: skipping drops you
           straight onto the site, so the hero camera swings to the entrance gate
           to give you something to land on. A window event rather than a prop —
           StoryScroll owns the 3D handle and is a sibling of this component, so
           the alternative is threading a callback through App for one cue. */
        onClick={(e) => {
          e.stopPropagation();
          window.dispatchEvent(new Event('alipson:skip-intro'));
          finish();
        }}
        aria-label="Skip cinematic intro"
      >
        Skip intro
      </button>
    </motion.div>
  );
}

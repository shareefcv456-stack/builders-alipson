import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LogoMark } from './ui/Logo';
import { isCapture } from '../lib/capture';

/**
 * Cinematic opening — four photographic frames, each with its own camera move,
 * a light sweep and word-by-word copy, resolving on the brand.
 *
 *   1 · cranes & skyline    "Building Ideas Into Reality"
 *   2 · wireframe engineer  "Precision Engineering & Modern Design"
 *   3 · handshake skyline   "Partnerships That Outlast The Build"
 *   4 · red paper-cut       ALIPSON BUILDERS · "We Build Trust"  → homepage
 *
 * Skippable, plays on every load/refresh (no persistence), collapses to an
 * instant reveal for reduced-motion / capture.
 *
 * `zoom` picks the Ken Burns move so no two consecutive frames drift the same
 * way — that alternation is what reads as a camera rather than a slideshow.
 *
 * `keyed` frames are the `-keyed.png` cutouts built by
 * scripts/key-intro-frames.py: the paper ground is already transparent in the
 * file, so the subject sits on the dark stage with nothing to blend away. The
 * red paper-cut is full colour, so it keeps its own treatment instead.
 */
const SLIDES = [
  { img: '/images/intro/intro-1-keyed.png', eyebrow: 'Foundations & Vision', title: 'Building Ideas Into Reality', zoom: { from: 1.16, to: 1, x: [-22, 12] }, keyed: true },
  { img: '/images/intro/intro-2-keyed.png', eyebrow: 'Engineering Precision', title: 'Precision Engineering & Modern Design', zoom: { from: 1.04, to: 1.18, x: [18, -14] }, keyed: true },
  { img: '/images/intro/intro-3-keyed.png', eyebrow: 'The Legacy', title: 'Partnerships That Outlast The Build', zoom: { from: 1.2, to: 1.02, x: [16, -10] }, keyed: true },
  { img: '/images/intro/intro-4.jpg', eyebrow: '', title: '', zoom: { from: 1.12, to: 1, x: [14, -10] }, keyed: false }, // brand reveal
];

// Shorter timing on mobile to improve LCP/FCP
const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;
const STEP_MS = isMobile() ? [1300, 1300, 1300, 2100] : [2100, 2100, 2100, 3400];
const EASE = [0.16, 1, 0.3, 1] as const;

/** `?introstep=2` freezes the intro on one frame — for screenshots/QA. */
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

  useEffect(() => {
    if (skip) { finish(); return; }
    if (pinned !== null) return;
    // Preload the later frames so every transition is seamless.
    SLIDES.slice(1).forEach((s) => { const i = new Image(); i.src = s.img; });

    const timers: number[] = [];
    let i = 0;
    const advance = () => {
      i += 1;
      if (i >= SLIDES.length) { finish(); return; }
      setStep(i);
      timers.push(window.setTimeout(advance, STEP_MS[i]));
    };
    timers.push(window.setTimeout(advance, STEP_MS[0]));

    const onKey = (e: KeyboardEvent) => { if (['Escape', 'Enter', ' '].includes(e.key)) finish(); };
    window.addEventListener('keydown', onKey);
    return () => { timers.forEach(clearTimeout); window.removeEventListener('keydown', onKey); };
  }, [skip, finish, pinned]);

  if (skip) return null;

  const slide = SLIDES[step];
  const brand = step === SLIDES.length - 1;
  const hold = STEP_MS[step] / 1000;
  const { from, to, x } = slide.zoom;

  return (
    <motion.div
      className="intro"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, ease: EASE }}
    >
      {/* Backdrop — crossfades while the camera keeps moving through the cut */}
      <AnimatePresence>
        <motion.div
          key={step}
          className={`intro__bg${slide.keyed ? ' intro__bg--keyed' : ' intro__bg--film'}`}
          style={{ backgroundImage: `url(${slide.img})` }}
          initial={{ opacity: 0, scale: from, x: x[0] }}
          animate={{ opacity: 1, scale: to, x: x[1] }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 1.1, ease: EASE },
            scale: { duration: hold + 1.4, ease: 'linear' },
            x: { duration: hold + 1.4, ease: 'linear' },
          }}
          aria-hidden
        />
      </AnimatePresence>
      <div className={`intro__scrim${brand ? ' intro__scrim--film' : ''}`} aria-hidden />
      <div className="intro__grain" aria-hidden />

      {/* One light sweep per frame */}
      <motion.div
        key={`sweep-${step}`}
        className="intro__sweep"
        initial={{ x: '-120%' }}
        animate={{ x: '120%' }}
        transition={{ duration: 2.2, delay: 0.5, ease: EASE }}
        aria-hidden
      />

      {/* Letterbox bars hold across the whole intro */}
      <motion.div className="intro__bar intro__bar--t" aria-hidden
        initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.9, ease: EASE }} />
      <motion.div className="intro__bar intro__bar--b" aria-hidden
        initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.9, ease: EASE }} />

      {/* Copy layer */}
      <div className="intro__stage">
        <AnimatePresence mode="wait">
          {brand ? (
            <motion.div
              key="brand"
              className="intro__brand"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: EASE }}
            >
              <motion.div
                initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ duration: 1.1, ease: EASE }}
              >
                <LogoMark size={58} />
              </motion.div>
              <h1 className="intro__wordmark">ALIPSON BUILDERS</h1>
              <motion.span
                className="intro__rule"
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
              />
              <motion.p
                className="intro__tagline"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.7, ease: EASE }}
              >
                We Build Trust
              </motion.p>
            </motion.div>
          ) : (
            <motion.div key={step} className="intro__slide">
              <motion.span
                className="intro__eyebrow"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: EASE }}
              >
                {slide.eyebrow}
              </motion.span>
              {/* Word-by-word rise — the line assembles instead of simply fading */}
              <p className="intro__line">
                {slide.title.split(' ').map((w, i) => (
                  <motion.span
                    key={w + i}
                    className="intro__word"
                    initial={{ opacity: 0, y: '0.6em', filter: 'blur(8px)' }}
                    animate={{ opacity: 1, y: '0em', filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: '-0.3em', transition: { duration: 0.3, delay: i * 0.02 } }}
                    transition={{ duration: 0.75, delay: 0.12 + i * 0.07, ease: EASE }}
                  >
                    {w}
                  </motion.span>
                ))}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="intro__dots" aria-hidden>
        {SLIDES.map((_, i) => <span key={i} className={i === step ? 'is-on' : ''} />)}
      </div>

      <button className="intro__skip" onClick={finish} aria-label="Skip cinematic intro">Skip intro</button>
    </motion.div>
  );
}

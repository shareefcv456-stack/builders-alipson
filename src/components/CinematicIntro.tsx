import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LogoMark } from './ui/Logo';
import ParticleNetwork from './ParticleNetwork';
import { isCapture } from '../lib/capture';

/**
 * Cinematic opening — begins in near-silence: a luxury villa outline draws
 * itself under soft volumetric light, then a movie-style line of dialogue fades
 * through black, resolving on the brand. Skippable, plays on every load/refresh
 * (no persistence), and collapses to an instant reveal for reduced-motion / capture.
 *
 *   silence (villa forms) → "We don't build buildings."
 *   → "We create places where dreams become reality." → ALIPSON BUILDERS → hero
 */
const LINES = [
  '',                                                   // 0 · silence, villa forming
  "We don't build buildings.",                          // 1
  'We create places where dreams become reality.',      // 2
  '',                                                   // 3 · brand reveal
];
const STEP_MS = [2600, 2900, 3200, 2800];
const EASE = [0.16, 1, 0.3, 1] as const;

export default function CinematicIntro({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  // Always play the intro on every load/refresh — no sessionStorage/localStorage
  // persistence. Only skip for capture (screenshots) or reduced-motion users.
  const skip = isCapture() || !!reduce;
  const [step, setStep] = useState(0);

  const finish = useCallback(() => {
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (skip) { finish(); return; }
    const timers: number[] = [];
    let i = 0;
    const advance = () => {
      i += 1;
      if (i >= LINES.length) { finish(); return; }
      setStep(i);
      timers.push(window.setTimeout(advance, STEP_MS[i]));
    };
    timers.push(window.setTimeout(advance, STEP_MS[0]));

    const onKey = (e: KeyboardEvent) => { if (['Escape', 'Enter', ' '].includes(e.key)) finish(); };
    window.addEventListener('keydown', onKey);
    return () => { timers.forEach(clearTimeout); window.removeEventListener('keydown', onKey); };
  }, [skip, finish]);

  if (skip) return null;

  const brand = step === LINES.length - 1;

  return (
    <motion.div
      className="intro"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: EASE }}
    >
      {/* Deep-purple particle network — the backdrop, strictly below villa + copy */}
      <ParticleNetwork className="intro__particles" />
      <div className="intro__glow" aria-hidden />
      <div className="intro__rays" aria-hidden />

      {/* Villa outline — draws itself, then a slow camera push-in */}
      <div className="intro__villaWrap" aria-hidden>
      <motion.svg
        className="intro__villa"
        viewBox="0 0 1000 460"
        preserveAspectRatio="xMidYMid meet"
        initial={{ scale: 1.08, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 9, ease: 'linear' }}
      >
        {[
          'M60 360 L940 360',                                                   // ground
          'M170 360 L170 232 L520 232 L520 360',                                 // main volume
          'M520 300 L820 300 L820 360',                                          // lower wing
          'M170 232 L170 200 L430 200 L520 232',                                 // upper cantilever
          'M250 360 L250 232 M330 360 L330 232 M410 360 L410 232 M600 360 L600 300 M690 360 L690 300 M770 360 L770 300', // mullions
          'M120 360 L120 300 M120 300 Q150 250 120 300',                         // slim tree trunk
        ].map((d, i) => (
          <motion.path
            key={i}
            d={d}
            fill="none"
            stroke="rgba(248,248,246,0.55)"
            strokeWidth={1.4}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.7 }}
            transition={{ duration: 2.4, ease: 'easeInOut', delay: 0.2 + i * 0.28 }}
          />
        ))}
        <motion.circle
          cx="120" cy="300" r="26" fill="none" stroke="rgba(248,248,246,0.4)" strokeWidth={1.2}
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, delay: 1.8, ease: 'easeInOut' }}
        />
        {/* crimson horizon accent */}
        <motion.path
          d="M60 360 L940 360" fill="none" stroke="var(--accent)" strokeWidth={1.6}
          initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.9 }}
          transition={{ duration: 2.6, delay: 0.4, ease: 'easeInOut' }}
        />
      </motion.svg>
      </div>

      {/* Dialogue / brand — fade through black.
          Dialogue lines sit at the TOP of the viewport (clear of the centered
          villa); the brand reveal stays centered. */}
      <div className={`intro__stage ${brand ? '' : 'intro__stage--top'}`}>
        <AnimatePresence mode="wait">
          {brand ? (
            <motion.div
              key="brand"
              className="intro__brand"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: EASE }}
            >
              <LogoMark size={54} />
              <h1 className="intro__wordmark">ALIPSON BUILDERS</h1>
              <span className="intro__rule" />
              <p className="intro__tagline">Dream It. Build It. Own It.</p>
            </motion.div>
          ) : LINES[step] ? (
            <motion.p
              key={step}
              className="intro__line"
              initial={{ opacity: 0, filter: 'blur(6px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(6px)' }}
              transition={{ duration: 1.1, ease: EASE }}
            >
              {LINES[step]}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <button className="intro__skip" onClick={finish}>Skip intro</button>
    </motion.div>
  );
}

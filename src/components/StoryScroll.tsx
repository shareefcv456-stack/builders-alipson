import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, ChevronDown, Play } from 'lucide-react';
import Lenis from 'lenis';
import { LogoMark } from './ui/Logo';
import { scrollToId } from '../hooks/useLenis';
import { useUI } from '../context/UIContext';
import { isCapture } from '../lib/capture';
import Ribbon from './Ribbon';
import HeroLoader from './HeroLoader';
import HeroWireframe, { P1_T, P2_T, type WireHandle } from './HeroWireframe';
import type { ThreeHandle } from './HeroThree';
import { HERO_FRAMES } from '../lib/media';

gsap.registerPlugin(ScrollTrigger);

/* three is ~150KB gzipped — lazy so the flat hero never pays for it, and so it
   is never in the critical path for first paint. */
const HeroThree = lazy(() => import('./HeroThree'));

/**
 * TWO HERO RENDERERS, ONE TIMELINE.
 *
 *   default   real 3D — three.js scene with a craning, orbiting camera
 *   ?flat     the authored SVG drawing over the photographic frame sequence
 *
 * Both are driven by the identical playhead, phase map, pin, gate and copy
 * logic below; only the thing being painted differs. This is a COMPARISON
 * switch, not architecture — once one is chosen, delete the other and this
 * flag with it.
 */
const use3D = () =>
  typeof window === 'undefined' || !window.location.search.includes('flat');

const N = HERO_FRAMES.length;
/* ---- CONSTRUCTION TIMELINE ------------------------------------------------
   One eased playhead (0..1 across the pinned section) drives every layer, so
   they can never drift apart.

     0    → 0.08   gate — the split shutter parts from the centre out
     0    → 0.20   PHASE 1 · excavation, red floor-plan grid, laser dimensions
     0.20 → 0.40   PHASE 2 · pad footings, rebar cages, concrete pillars rise
     0.40 → 0.60   PHASE 3 · floor slabs layer up, curtain-wall frames
     0.60 → 0.85   PHASE 4 · facade — drawing dissolves into photographed glass,
                             interior lighting warms from inside
     0.85 → 0.90   PHASE 5 · landscaping and entry resolve to the finished
                             landmark; the building is 100% complete at 0.90
     0.90 → 1.00   hold on the finished landmark, headline clears, then unpin

   TWO LAYERS, ONE CLOCK. The photographic sequence runs across the WHOLE
   timeline, not just the back half — it is simply hidden behind the dark plate
   during phases 1-3. That is what makes phase 4 a dissolve rather than a cut:
   when the plate lifts, the photo underneath has already scrubbed to the same
   stage of construction the drawing is showing. Start the film at phase 4
   instead and a finished wireframe dissolves into a photo of an empty site.  */
const GATE_END = 0.08;     // doors finished parting
/** Scroll distance, in px, at which the split-gate doors have finished parting.
 *  Derived from GATE_END and the pin runway below rather than restated, so the
 *  navbar (which stays hidden behind the closed gate) cannot drift out of sync
 *  with the gate it is waiting on. */
const PIN_RUNWAY = () => window.innerHeight * (window.innerWidth < 760 ? 2.7 : 4);
export function gateOpenScroll() {
  if (typeof window === 'undefined') return 0;
  return PIN_RUNWAY() * GATE_END;
}
const PHASE_3_END = 0.60;  // slabs and frames done — the drawing is complete
const PHASE_4_END = 0.85;  // facade closed, interior lights up
/** The landmark is finished HERE, not at 1.0. The last tenth is deliberate
 *  runway: the building holds complete, the headline fades, and only then does
 *  the pin release — so the text can never share the viewport with the stats. */
const BUILD_END = 0.9;
/** The phase-4 climax line runs 85%→95%, so the copy holds later than the
 *  building finishes. It must still be fully clear before the pin releases at
 *  1.0 or it lands on top of the stats ribbon. */
const COPY_OUT = 0.95;
/** Phase 1 and 2 edges (0.20 / 0.40). Derived from the drawing's own phase
 *  boundaries rather than restated, so the two files cannot drift out of sync. */
const PHASE_1_END = GATE_END + P1_T * (PHASE_3_END - GATE_END);
const PHASE_2_END = GATE_END + P2_T * (PHASE_3_END - GATE_END);
const WIRE_END = 0.72;     // drawing fully dissolved into the photography

/* The phase edges are derived through two files, so a change to GATE_END or to
   either P*_T silently slides them off the spec — the build still runs, it just
   stops matching the timeline it documents. Check it once, in dev. */
if (import.meta.env.DEV) {
  ([['phase 1', PHASE_1_END, 0.2], ['phase 2', PHASE_2_END, 0.4]] as const).forEach(([name, got, want]) => {
    if (Math.abs(got - want) > 0.005) {
      console.error(`[StoryScroll] ${name} ends at ${got.toFixed(3)} of scroll, spec says ${want}`);
    }
  });
}
/** Second-stage damping on the canvas playhead. ScrollTrigger's `scrub` carries
 *  the ~1.2s settle; this only removes the last of the per-frame stepping, so
 *  keep it light — stack two heavy dampers and the hero feels detached. */
const EASE = 0.12;

/** The construction occupies the first 75% of the pinned scroll. The remaining
 *  25% is the HANDOFF TAIL: the stats bar rises over the still-pinned canvas and
 *  the camera reframes the finished landmark above it. Splitting it this way
 *  keeps every phase fraction above expressed against the construction, so the
 *  verified phase map does not move when the tail's length changes. */
const BUILD_FRACTION = 0.75;
/** Tail window, in trigger progress. Starts slightly after the build ends so the
 *  copy has cleared before the stats begin to rise. */
const TAIL_FROM = 0.78;

/**
 * Left-hand copy, keyed to construction progress. `at` is the scroll fraction
 * the beat takes over at. `accent` is the tail of the headline that carries the
 * brand red — kept as a separate field so the string stays one sentence.
 */
const PHASES = [
  {
    at: 0,
    title: 'Solid ', accent: 'Foundations',
    sub: 'Laying the groundwork with engineered precision and uncompromised strength.',
  },
  {
    at: 0.25,
    title: 'Architectural ', accent: 'Precision',
    sub: 'Raising multi-story steel frameworks and reinforced concrete structures.',
  },
  {
    at: 0.6,
    title: 'Modern ', accent: 'Aesthetics',
    sub: 'Wrapping structures in smart reflective glass and premium finishes.',
  },
  {
    at: 0.85,
    title: 'Building Landmarks, ', accent: 'Delivering Trust.',
    sub: 'Transforming vision into iconic reality.',
  },
] as const;

/** Which beat is live at scroll fraction p. */
const phaseAt = (p: number) => {
  let i = 0;
  for (let k = 0; k < PHASES.length; k++) if (p >= PHASES[k].at) i = k;
  return i;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const span = (a: number, b: number, v: number) => clamp01((v - a) / (b - a));

/** `?hero=0.35` freezes the whole hero on one playhead value — for screenshots
 *  and QA of a single phase, mirroring `?introstep=` on the cinematic intro. */
const pinnedHero = () => {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('hero');
  return v === null || v === '' || Number.isNaN(+v) ? null : clamp01(+v);
};

export default function StoryScroll() {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wire = useRef<WireHandle>(null);
  const plate = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const three = useRef<ThreeHandle>(null);
  const is3D = useRef(use3D()).current;
  const target = useRef(0);   // where scroll wants the playhead
  const cur = useRef(-1);     // where it actually is (eased toward target)
  const { openVideo } = useUI();
  const pinned = useRef(pinnedHero()).current;
  const [phase, setPhase] = useState(() => phaseAt(pinnedHero() ?? 0));
  const tail = useRef(0);       // 0..1 across the stats handoff
  const stats = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLDivElement>(null);
  const still = pinned === null && (isCapture() || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches));

  /**
   * Scroll-driven frame-sequence player.
   *
   * One <canvas>, not N stacked <img> — the DOM cost of a 500+ frame sequence
   * is what kills this technique, so frames live in a plain array and only the
   * two straddling the playhead are ever drawn. Scroll sets a TARGET playhead;
   * a rAF loop eases the real playhead toward it, so the film keeps rolling for
   * a beat after the wheel stops instead of snapping. Scrolling up runs it
   * backwards for free — the playhead is just a number.
   *
   * Sub-frame blending (frame i drawn under frame i+1 at the fractional alpha)
   * is what turns a sparse sequence into continuous motion. With a dense
   * sequence it is a no-op; with a sparse one it is the whole trick.
   */
  /**
   * 3D playhead. Deliberately a SEPARATE loop from the flat renderer's below
   * rather than a branch inside it: the two modes are a temporary comparison,
   * and a duplicated ten-line lerp is cleanly deletable in one block once one
   * of them wins. Branching the verified flat effect would not be.
   */
  useEffect(() => {
    if (!is3D) return;
    let raf = 0;
    if (still) { three.current?.update(1); return; }
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = pinned ?? target.current;
      if (cur.current < 0) cur.current = t;
      else cur.current += (t - cur.current) * EASE;
      if (Math.abs(t - cur.current) < 0.0002) cur.current = t;
      three.current?.update(cur.current, tail.current);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [is3D, still, pinned]);

  /** Stats bar + scroll cue ride the tail. Style writes only — running this
   *  through React state would re-render the tree on every frame of the
   *  handoff, which is the one place the scroll must stay glassy. */
  useEffect(() => {
    if (still) return;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const k = tail.current;
      if (stats.current) {
        stats.current.style.transform = `translate3d(0, ${((1 - k) * 100).toFixed(2)}%, 0)`;
        stats.current.style.opacity = String(Math.min(1, k * 2.2));
      }
      // The cue only appears once the stats are seated, and points onward.
      if (cue.current) cue.current.style.opacity = String(span(0.72, 1, k));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [still]);

  /* Skipping the intro drops the visitor straight onto the hero. CinematicIntro
     is a sibling component, so it signals with a window event rather than a
     callback threaded through App for this one cue. */
  useEffect(() => {
    const onSkip = () => {
      three.current?.focusGate();
      /* The split-gate doors cover the whole viewport until scroll progress
         GATE_END (0.08 of a 4vh pin), so without this the camera move plays
         behind them and is never seen. Half a viewport clears that on both the
         desktop (4vh) and phone (2.7vh) runways without restating either. */
      const lenis = (window as unknown as { lenis?: Lenis }).lenis;
      const to = window.scrollY + window.innerHeight * 0.5;
      if (lenis) lenis.scrollTo(to, { duration: 1.6 });
      else window.scrollTo({ top: to, behavior: 'smooth' });
    };
    window.addEventListener('alipson:skip-intro', onSkip);
    return () => window.removeEventListener('alipson:skip-intro', onSkip);
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d', { alpha: false });
    if (!ctx) return;

    // ---- decode every frame up front; they are the film ---------------------
    const imgs: HTMLImageElement[] = HERO_FRAMES.map((src) => {
      const im = new Image();
      im.decoding = 'async';
      im.src = src;
      return im;
    });

    let w = 0, h = 0, raf = 0, visible = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cur.current = -1;            // force a redraw at the new size
    };

    /** Cover-fit, biased low so the horizon sits where the CSS crop had it. */
    const paint = (im: HTMLImageElement, alpha: number) => {
      if (!im.complete || !im.naturalWidth) return;
      const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
      const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
      ctx.globalAlpha = alpha;
      ctx.drawImage(im, (w - dw) / 2, (h - dh) * 0.62, dw, dh);
      ctx.globalAlpha = 1;
    };

    const draw = (raw: number) => {
      // Phases 1-3 are the drawing's whole life; it dissolves through phase 4.
      const wireAlpha = 1 - span(PHASE_3_END, WIRE_END, raw);
      wire.current?.draw(span(GATE_END, PHASE_3_END, raw), wireAlpha);
      // The plate keeps the photography dark enough for the red grid to glow
      // against it, then lifts to hand the frame over.
      if (plate.current) plate.current.style.opacity = String(wireAlpha * 0.82);

      // Phase 4: interior lights warm up from inside the volume, and stay on
      // through the reveal — the finished frames are lit, so this only has to
      // carry the transition into them.
      if (glow.current) glow.current.style.opacity = String(span(PHASE_3_END, PHASE_4_END, raw) * 0.55);

      // The film holds on frame 0 — the empty plot — for the whole of phase 1,
      // then runs to its last frame at BUILD_END. Starting it at 0 instead puts
      // a photographed structure faintly behind the excavation grid, which is
      // the one thing phase 1 must not show.
      const p = span(PHASE_1_END, BUILD_END, raw);
      const f = p * (N - 1);
      const i = Math.min(N - 1, Math.floor(f));
      const frac = f - i;
      ctx.fillStyle = '#0b0d13';
      ctx.fillRect(0, 0, w, h);
      paint(imgs[i], 1);
      if (frac > 0 && i + 1 < N) paint(imgs[i + 1], frac);
      // Slow push-in across the WHOLE section, not just the film, so the camera
      // is already creeping while the plan is being surveyed. Compositor-only.
      cv.style.transform = `scale(${1.1 - 0.1 * raw})`;
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const t = target.current;
      if (cur.current < 0) cur.current = t;
      else cur.current += (t - cur.current) * EASE;
      if (Math.abs(t - cur.current) < 0.0002) cur.current = t;
      draw(cur.current);
    };

    resize();
    window.addEventListener('resize', resize);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(cv);

    if (pinned !== null) {
      // Loop still runs, but the target never moves — it settles on frame one
      // and holds, so late-decoding images still repaint.
      target.current = pinned;
      imgs.forEach((im) => { im.onload = () => { cur.current = -1; }; });
      raf = requestAnimationFrame(loop);
    } else if (still) {
      target.current = 1;
      const last = imgs[N - 1];
      if (last.complete) draw(1); else last.onload = () => draw(1);
    } else {
      // Repaint as each frame lands so the opening shot is never a blank plate.
      imgs.forEach((im) => { im.onload = () => { cur.current = -1; }; });
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      io.disconnect();
    };
  }, [still]);

  useEffect(() => {
    if (still || !root.current) return;

    const lenis = (window as unknown as { lenis?: Lenis }).lenis;
    const onScroll = () => ScrollTrigger.update();
    if (pinned === null) lenis?.on('scroll', onScroll);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline(pinned !== null ? { paused: true } : {
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          /* The section is now ONE viewport tall and ScrollTrigger generates the
             runway as a pin-spacer, so the scroll length lives here rather than
             in the CSS height. Function form, not "+=300%", because the two
             disagree about what the percentage is a percentage OF — px is
             unambiguous — and because it lets the phone get a shorter timeline
             without a media query that could desync from the pin. */
          end: () => '+=' + Math.round(PIN_RUNWAY()),
          pin: true,
          pinSpacing: true,
          /* Pinning for real (not CSS sticky) means the pin CAN jump if you
             arrive at speed: ScrollTrigger has to wait for a scroll event before
             it fixes the element, and at high velocity that lands a frame late.
             anticipatePin pins fractionally early to absorb exactly that. */
          anticipatePin: 1,
          /* The dampener. 1.2 = the playhead spends ~1.2s catching up to the
             scroll position, so a flick of the wheel and a slow drag both render
             as the same continuous take. The canvas lerp then smooths what's
             left. */
          scrub: 1.2,
          /* Blow past the end fast and the scrubbed timeline is forced to its
             final state instead of easing there over the next 1.2s — without
             this, a hard flick leaves a half-built building and a half-faded
             headline still resolving while the ribbon is already on screen. */
          fastScrollEnd: true,
          onUpdate: (self) => {
            const build = clamp01(self.progress / BUILD_FRACTION);
            target.current = build;
            tail.current = span(TAIL_FROM, 1, self.progress);
            // Functional updater returning the SAME value makes React bail out,
            // so this is free on every frame that does not cross a boundary.
            const i = phaseAt(build);
            setPhase((cur) => (cur === i ? cur : i));
          },
        },
      });
      // A scrubbed timeline maps its OWN duration across the whole scroll, so
      // this empty tween fixes the length at SPAN — letting every beat below be
      // written as a fraction of the scroll map above. Remove the spacer and the
      // doors take 60% of the scroll to part.
      const SPAN = 6 * BUILD_FRACTION;
      tl.to({}, { duration: SPAN }, 0)
        // The doors part left/right from the seam; the brand mark goes with them.
        // Kept power2.inOut, not power1.out — a shutter with mass has to lean in
        // before it leaves, and an out-only ease reads as a slide, not a door.
        .to('.story__gate-l', { xPercent: -104, ease: 'power2.inOut', duration: GATE_END * SPAN }, 0)
        .to('.story__gate-r', { xPercent: 104, ease: 'power2.inOut', duration: GATE_END * SPAN }, 0)
        .to('.story__gate-brand', { autoAlpha: 0, scale: 0.9, ease: 'power1.out', duration: GATE_END * SPAN * 0.8 }, 0)
        // Headline and CTAs resolve in behind the opening doors and then hold,
        // readable over every phase rather than arriving at the end.
        .fromTo('.story__finale-copy',
          { autoAlpha: 0, yPercent: 18 },
          { autoAlpha: 1, yPercent: 0, ease: 'power1.out', duration: PHASE_1_END * SPAN },
          GATE_END * SPAN * 0.5)
        // …and clear out before the handoff. autoAlpha (not opacity) so it also
        // goes visibility:hidden — at opacity 0 alone the CTAs stay clickable and
        // stay in the a11y tree, hovering invisibly over the stats section.
        .to('.story__finale-copy',
          { autoAlpha: 0, y: -20, ease: 'power1.out', duration: (1 - COPY_OUT) * SPAN },
          COPY_OUT * SPAN);

      if (pinned !== null) tl.progress(pinned);
    }, root);

    if (pinned !== null) return () => { ctx.revert(); };

    const t = window.setTimeout(() => ScrollTrigger.refresh(), 350);
    return () => {
      window.clearTimeout(t);
      lenis?.off('scroll', onScroll);
      ctx.revert();
    };
  }, [still, pinned]);

  return (
    <section id="hero" className={`story ${still ? 'story--static' : ''} ${is3D ? 'story--3d' : ''}`} ref={root} aria-label="Alipson Builders — a project from excavation to handover">
      <div className="story__stage">
        {is3D ? (
          /* Real 3D — one WebGL canvas, camera cranes and orbits as it builds.
             No fallback element behind it: the ink-900 section colour already
             shows through while the chunk loads, so there is nothing to flash. */
          <Suspense fallback={<HeroLoader />}>
            <HeroThree ref={three} className="story__three" />
          </Suspense>
        ) : (
          <>
            {/* Scroll-scrubbed construction film */}
            <canvas
              ref={canvas}
              className="story__canvas"
              role="img"
              aria-label="A single Alipson project filmed from empty site through excavation, structure and facade to the finished, illuminated building"
            />
            <div className="story__plate" ref={plate} />
            <HeroWireframe ref={wire} className="story__wire" />
            {/* Phase 4 — warm light coming on inside the volume */}
            <div className="story__interior" ref={glow} aria-hidden />
          </>
        )}
        <div className="story__grade" />

        {/* Stats bar — rises over the still-pinned canvas at the end of the
            scroll instead of being a separate section below it. The counters
            fire off their own IntersectionObserver, which only trips once this
            has actually slid into view, so they still count from 0 on reveal. */}
        <div className="story__stats" ref={stats}>
          {/* Cue lives INSIDE the stats block, in normal flow. Absolutely
              positioning it against the stage put it on top of the numbers as
              soon as the bar rose past it. */}
          <div className="story__cue" ref={cue} aria-hidden>
            <span>Scroll to Explore Our Story</span>
            <ChevronDown size={16} />
          </div>
          <Ribbon />
        </div>

        {/* Headline + CTAs — the only overlay. The headline block swaps with the
            construction phase; the CTAs sit OUTSIDE the animated subtree so they
            never blink on a phase change. `mode="wait"` is what guarantees the
            outgoing beat is gone before the incoming one mounts — with the
            default mode the two overlap mid-crossfade and the copy doubles. */}
        <div className="story__finale-copy">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <span className="eyebrow story__eyebrow">Alipson Builders Pvt Ltd</span>
              {/* No `text-white` utility here — colour belongs to .story__headline,
                  which the daylight theme overrides. A Tailwind colour utility on
                  the element wins the cascade and pins it white on a white sky. */}
              {/* Sizing and weight belong to .story__headline, NOT Tailwind utilities.
                  `text-3xl` was winning the cascade and pinning this to 30px/700,
                  which killed both the clamp() and the 800 weight — the same trap
                  `text-white` caused here before. */}
              <h1 className="story__headline text-left">
                {PHASES[phase].title}<em>{PHASES[phase].accent}</em>
              </h1>
              <p className="story__sub">{PHASES[phase].sub}</p>
            </motion.div>
          </AnimatePresence>
          <div className="story__cta flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button className="btn btn-primary" onClick={() => scrollToId('work')}>
              Explore Projects <ArrowUpRight size={16} />
            </button>
            <button className="btn btn-watch" onClick={openVideo} aria-label="Watch our story">
              <span className="btn-watch__play"><Play size={13} fill="currentColor" /></span>
              Watch Story
            </button>
          </div>
        </div>

        {/* Split gate — parts left/right on the first beat of scroll */}
        <div className="story__gate" aria-hidden>
          <div className="story__gate-l" />
          <div className="story__gate-r" />
          <div className="story__gate-brand">
            <LogoMark size={72} />
            <span className="story__gate-name">ALIPSON BUILDERS</span>
            <span className="story__gate-sub">PVT LTD</span>
            <span className="story__gate-hint">Scroll to Enter</span>
          </div>
        </div>
      </div>
    </section>
  );
}

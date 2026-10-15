import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, ChevronDown, Play } from 'lucide-react';
/* TYPE-ONLY. This file never constructs a Lenis — it reads the instance off
   `window` when one exists. A value import put the whole scroll library in the
   eager graph of the hero, which is exactly where a phone (where Lenis is never
   created at all — see useLenis) should not be paying for it. */
import type Lenis from 'lenis';
import { LogoMark } from './ui/Logo';
import { scrollToId } from '../hooks/useLenis';
import { useUI } from '../context/UIContext';
import { isCapture } from '../lib/capture';
import Ribbon from './Ribbon';
import HeroLoader from './HeroLoader';
import HeroWireframe, { P1_T, P2_T, type WireHandle } from './HeroWireframe';
import type { ThreeHandle } from './HeroSite';
import { HERO_FRAMES, HERO_FRAMES_SMALL, MEDIA, mediaSmall } from '../lib/media';
import { isLite, isPhone } from '../lib/device';
import { onScrollFrame, viewportH, viewportW } from '../lib/scrollbus';

gsap.registerPlugin(ScrollTrigger);

/* three is ~150KB gzipped — lazy so the flat hero never pays for it, and so it
   is never in the critical path for first paint. */
const HeroSite = lazy(() => import('./HeroSite'));

/**
 * TWO HERO RENDERERS, ONE TIMELINE.
 *
 *   default   real 3D — HeroSite: one continuous scroll-driven construction,
 *             blueprint → excavation → frame → facade → finished landmark.
 *             Its own phase map lives in that file; everything below (pin,
 *             gate, copy, tail) is renderer-agnostic.
 *   ?flat     the authored SVG drawing over the photographic frame sequence
 *
 * Both are driven by the identical playhead, phase map, pin, gate and copy
 * logic below; only the thing being painted differs. This is a COMPARISON
 * switch, not architecture — once one is chosen, delete the other and this
 * flag with it.
 */
/**
 * THREE RENDERERS, ONE TIMELINE. Everything below — the pin, the Lenis sync,
 * the damped playhead, the phase copy, the stats and the section hand-off — is
 * renderer-agnostic and shared. Only the thing being painted differs.
 *
 *   default   3D — HeroSite, the scroll-driven construction scene.
 *   ?flat     the authored SVG drawing over the photographic frame sequence.
 *   ?video    a scrubbed <video>. Opt-in, because the hero is the 3D scene.
 *
 * `?video` needs `public/assets/timelapse.mp4`, which is not in the repo. Until
 * it is, the element fails to load and the mode falls back to 3D — so the flag
 * is safe to add to a URL today, it simply shows the normal hero.
 */
type HeroMode = 'three' | 'flat' | 'video';
const pickMode = (): HeroMode => {
  const q = typeof window === 'undefined' ? '' : window.location.search;
  if (q.includes('video')) return 'video';
  if (q.includes('flat')) return 'flat';
  return 'three';
};

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
/* MOVIE PACING. 4.0 viewports of pinned runway on desktop, 2.3 on a phone —
   both ~28% shorter than the 5.6 / 3.2 they were, at the client's request for
   a faster, more direct hero. Every phase beat, the gate, the copy, the CTAs
   and the stats are fractions of this number, so the whole sequence plays
   intact, just over less scroll.

   The phone gets less than the desktop: a swipe covers far more of the runway
   than a wheel notch does, so matching the desktop number would make the
   phone SLOWER in scroll-gestures, not slower in time. */
/* Reads the CACHED viewport, not `window`. This is called from the navbar's
   scroll handler, i.e. on every scroll frame, and `innerWidth`/`innerHeight`
   are live-layout reads — asking for them while GSAP's pin has the page dirty
   forces a synchronous layout. The cache is refreshed on `resize`, which is
   every event that can actually change the answer. */
const PIN_RUNWAY = () => viewportH() * (viewportW() < 760 ? 2.3 : 4.0);
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

/**
 * THE BUILD, THEN THE HAND-OFF — all over the finished building, which holds.
 *
 *   0    → 0.70   THE BUILD. The construction playhead runs 0..1 across this,
 *                 so every phase fraction in HeroSite stays expressed against
 *                 the construction.
 *   0.70 → 0.84   "From Vision To Structure" and the CTAs over the final frame.
 *   0.84 → 0.92   the headline clears (CTAs leave CTA_LEAD earlier).
 *   0.90 → 1      the four stat cards and the scroll cue rise, then the pin
 *                 releases onto the next section.
 *
 * The old act two (camera drop, gate opening, hero car driving out, follow
 * shot) is gone: HeroSite is always driven with outro 0, which is exactly the
 * frame the build ends on.
 */
const BUILD_FRACTION = 0.70;
/** When the headline starts to leave, as a fraction of the trigger. */
const COPY_OUT = 0.84;
/** …and how long it takes to go. Short: it is leaving, not being animated. */
const COPY_FADE = 0.08;
/** The buttons leave this much timeline ahead of the copy, so the outgoing
 *  pills are gone before the headline starts to fade — never the two together. */
const CTA_LEAD = 0.06;
/** When the stat cards rise, as a fraction of the trigger: after the CTAs are
 *  gone (they share the foot of the stage), before the pin releases. */
const STATS_AT = 0.90;

/** WHEN THE TWO CTAs ARE ON SCREEN — a state, not a pair of scroll numbers.
 *
 *  They were latched off RAW scroll progress (in at 0.70, out at 0.88) while
 *  the headline they belong to lives on two OTHER clocks: the beat swaps on the
 *  eased playhead and the block fades on the scrubbed timeline. So the pills
 *  outlived "From Vision To Structure" by ~18% of the pin, sitting alone over
 *  the outro in both scroll directions.
 *
 *  Now all three conditions are read from the clocks that actually paint:
 *    1. the build is finished — scroll wants it AND the eased playhead the
 *       renderer draws has arrived there;
 *    2. the final beat's entrance animation has completed;
 *    3. the scrubbed timeline is not about to fade the copy (COPY_OUT - CTA_LEAD).
 *  Any one failing hides them, so reverse scrolling hides them again before
 *  the sequence rewinds. See `syncCta`. */
const LAST_BEAT = 4; // index of 'From Vision To Structure' in PHASES
/** "Arrived" for the eased playhead. It approaches 1 exponentially, so an exact
 *  1 lands ~0.5s after the scene has visibly stopped; the last 0.5% of the
 *  final pull-back is sub-pixel. */
const BUILT = 0.995;

/**
 * Left-hand copy, keyed to construction progress. `at` is the scroll fraction
 * the beat takes over at. `accent` is the tail of the headline that carries the
 * brand red — kept as a separate field so the string stays one sentence.
 */
/* Four words per beat, changing AT the stage they name — keyed to the phase map
   in HeroSite: foundation 0–0.12, columns 0.12–0.28, frame 0.28–0.62, facade
   0.62–0.88, handover 0.88–1. The copy is the caption; the render is the story,
   so every beat is short enough to read in one glance and then get out of the
   way of the building. */
const PHASES = [
  {
    at: 0,
    title: 'From ', accent: 'Vision',
    sub: 'Every Alipson landmark starts as a set of lines on bare ground.',
  },
  {
    at: 0.10,
    title: 'Built With ', accent: 'Precision',
    sub: 'Footings, grade beams and reinforcement, set out to the millimetre.',
  },
  {
    at: 0.30,
    title: 'Structure In ', accent: 'Motion',
    sub: 'Columns rise, beams span, slabs cast — floor after floor.',
  },
  {
    at: 0.64,
    title: 'Engineered ', accent: 'To Last',
    sub: 'Stone, glass and detail, closed around a frame built to outlive us.',
  },
  {
    at: 0.88,
    title: 'From Vision ', accent: 'To Structure',
    sub: 'Alipson Builders — landmarks, delivered.',
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
 *  and QA of a single phase, mirroring `?introstep=` on the cinematic intro.
 *  `?hero=1&outro=0.6` freezes act two as well, which is the only way to hold a
 *  single frame of the gate/car shot still enough to look at. */
const pinnedAt = (key: string) => {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get(key);
  return v === null || v === '' || Number.isNaN(+v) ? null : clamp01(+v);
};
const pinnedHero = () => pinnedAt('hero');

export default function StoryScroll() {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wire = useRef<WireHandle>(null);
  const plate = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const three = useRef<ThreeHandle>(null);
  const video = useRef<HTMLVideoElement>(null);
  const mode = useRef<HeroMode>(pickMode()).current;
  /* A missing or undecodable file drops back to the 3D hero rather than
     leaving a black rectangle where the hero was. Since the mp4 is not in the
     repo yet, this IS the live path for `?video` today. */
  const [videoFailed, setVideoFailed] = useState(false);
  const active: HeroMode = mode === 'video' && videoFailed ? 'three' : mode;
  /* Every existing guard in this file keys off `is3D`, and all of them mean
     "the WebGL scene is the renderer" — which the video mode is not. */
  const is3D = active === 'three';
  /* THE 3D SCENE IS NOT PART OF FIRST PAINT ON A PHONE.
     three.js is 720 KB of script before the scene itself is built, and on a
     mid-range phone that parse-plus-build is most of the page's blocking time —
     spent on a canvas the split gate is covering anyway at scroll 0. So on a
     lite device the stage opens on a poster (one ~106 KB WebP) and the chunk is
     only requested once the visitor does the thing the gate is asking them to
     do: scroll, touch, or point at it. Desktop mounts it immediately, as
     before. `heavy` only ever goes false → true, so the scene never unloads. */
  const [heavy, setHeavy] = useState(() => !isLite());
  useEffect(() => {
    if (heavy) return;
    /* THE TRIGGER IS THE FIRST SCROLL; THE WORK IS NOT DONE ON THAT FRAME.
       Flipping `heavy` synchronously in the scroll handler mounted the lazy
       3D scene in the middle of the visitor's opening swipe — and that mount
       is the single longest task the page ever runs: three.js evaluates, the
       whole scene is constructed, and the shaders compile, all on the main
       thread while a finger is on the glass. The gesture stalled, which is
       exactly the "scroll stutter on first touch" this is meant to avoid.
       `requestIdleCallback` moves it into the gap BETWEEN frames instead. The
       timeout is the backstop: a visitor who keeps scrolling never yields an
       idle period, and 1200ms of a 2.3-viewport phone runway is well before
       the poster has anything left to show. Nothing is skipped and nothing is
       downgraded — the same scene is built, a beat later, off the gesture. */
    let idle = 0;
    const go = () => {
      if (idle) return;
      const ric = (window as unknown as {
        requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      }).requestIdleCallback;
      idle = ric
        ? ric(() => setHeavy(true), { timeout: 1200 })
        : window.setTimeout(() => setHeavy(true), 200);
    };
    const opts = { once: true, passive: true } as const;
    /* PREPARED BEFORE THE SWIPE, NOT ON IT. Waiting for the first scroll put the
       whole build inside the visitor's opening gesture — measured as a 600 ms
       frozen frame on a throttled phone. The gate is closed and still at load,
       which is the one moment nobody is watching the stage, so the scene starts
       in the first idle slot after `load` (first paint is long done by then) and
       builds in stages behind the doors. The input triggers stay as a backstop
       for a visitor who swipes before that idle slot arrives. */
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, opts);
    window.addEventListener('scroll', go, opts);
    window.addEventListener('touchstart', go, opts);
    window.addEventListener('pointerdown', go, opts);
    return () => {
      window.removeEventListener('load', go);
      window.removeEventListener('scroll', go);
      window.removeEventListener('touchstart', go);
      window.removeEventListener('pointerdown', go);
    };
  }, [heavy]);
  const target = useRef(0);   // where scroll wants the playhead
  const cur = useRef(-1);     // where it actually is (eased toward target)
  const { openVideo } = useUI();
  const pinned = useRef(pinnedHero()).current;
  const [phase, setPhase] = useState(() => phaseAt(pinnedHero() ?? 0));
  /* THE COPY FOLLOWS THE PLAYHEAD, NOT THE SCROLLBAR. It used to be computed
     from `self.progress` inside ScrollTrigger's onUpdate — the RAW scroll
     position — while the thing on screen is drawn from `cur`, which is eased
     and trails the scroll by the 1.2s scrub plus the canvas lerp. So on any
     brisk scroll the headline announced a stage the building had not reached
     yet: "Structure In Motion" over a set of footings. Reading the same eased
     value the renderer reads puts the caption back on the frame it captions.
     `syncPhase` (below `syncCta`, which it calls) only touches React state on
     the frames that cross a phase boundary. */
  /* Restarts the playhead loop below, which parks itself once it has caught up
     with the scroll. Held in a ref because the only caller — ScrollTrigger's
     onUpdate — is created in a different effect. */
  const wake = useRef<() => void>(() => {});
  const stats = useRef<HTMLDivElement>(null);
  const cta = useRef<HTMLDivElement>(null);
  /* TWO-WAY, AND THAT IS THE WHOLE FIX. This used to be a one-way latch — once
     `revealed` went true the class was never removed — on the theory that
     letting the bar drop again would flicker. What it actually did was leave
     four opaque cards parked over the excavation and the rebar for the rest of
     the session: scroll down to the end once, come back to the top, and the
     figures are sitting on the foundation phase with `pointer-events: auto`,
     taking taps meant for the hero behind them.
     So it is a SETTER now, not a latch, and the scroll position is the only
     thing that decides. The guard stays: this is called from ScrollTrigger's
     onUpdate, i.e. on every scroll frame, and without the early return it
     would touch classList sixty times a second to write the value already
     there. With it, the DOM is touched twice per crossing and not at all in
     between.
     A ref and a classList write, NOT React state: a setState here would
     re-render the hero mid-scrub for something CSS can do on its own — and the
     CSS transition on `.story__stats` is what makes the reverse a smooth fade
     and slide back down rather than a snap. `pointer-events: none` comes back
     with it, because it lives on the base rule that `is-in` overrides. */
  const shown = useRef(false);
  const setStatsIn = useCallback((on: boolean) => {
    if (shown.current === on) return;
    shown.current = on;
    stats.current?.classList.toggle('is-in', on);
  }, []);

  /* THE BUTTONS RUN ON THE SAME CLOCK AS THE BAR, and that is the point.
     They used to be a `fromTo` on the scrubbed timeline while the bar keyed off
     ScrollTrigger's RAW progress — two clocks about 1.2s apart, so the bar
     could be up while the pills were still fading, and at 375x667 that is a
     44px collision with the figures rising straight through "Explore
     Projects". Binding the bar to the timeline instead was tried and is worse:
     a scrubbed timeline is not guaranteed to render all the way to 1 —
     measured stranding at 0.956 with the scroll well past the trigger — so the
     bar simply never arrived.
     One clock, two latches, and CSS carries the motion. Same mechanism
     `.story__stats` has always used, and the transition on `.story__cta` is
     what makes this the "fade in with a slight slide up" the brief asks for,
     in BOTH directions. */
  const ctaShown = useRef(false);
  const setCtaIn = useCallback((on: boolean) => {
    if (ctaShown.current === on) return;
    ctaShown.current = on;
    cta.current?.classList.toggle('is-in', on);
  }, []);
  /* The inputs to the CTA rule (see LAST_BEAT). `beatIn` is the beat whose
     entrance has finished — the one on screen at mount is at rest, so it
     counts. */
  const beatIn = useRef(phase);
  /* False once the scrubbed timeline reaches COPY_OUT - CTA_LEAD. */
  const copyLive = useRef(true);
  const syncCta = useCallback(() => {
    setCtaIn(target.current >= 1 && cur.current >= BUILT && beatIn.current === LAST_BEAT && copyLive.current);
  }, [setCtaIn]);
  /* A new beat has not finished entering yet, so the CTAs drop before it
     mounts — they never ride a crossfade. */
  const phaseNow = useRef(phase);
  const syncPhase = useCallback((v: number) => {
    const i = phaseAt(v);
    if (i === phaseNow.current) return;
    phaseNow.current = i;
    beatIn.current = -1;
    syncCta();
    setPhase(i);
  }, [syncCta]);
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
    if (still) { three.current?.update(1, 0); return; }
    /* IT SLEEPS BETWEEN SCROLLS. This loop's only job is to ease `cur` toward
       where the scroll wants the playhead — so once it has arrived and the
       outro value has stopped moving there is nothing left to interpolate, and
       re-arming anyway meant a rAF callback every frame for the entire life of
       the page, hero on screen or twelve sections away. ScrollTrigger's
       onUpdate is the only thing that can change either input, so that is what
       wakes it (`wake.current`, below). It never parks before the lazy scene
       has mounted, or the first playhead would never reach it. */
    const loop = () => {
      const t = pinned ?? target.current;
      if (cur.current < 0) cur.current = t;
      else cur.current += (t - cur.current) * EASE;
      if (Math.abs(t - cur.current) < 0.0002) cur.current = t;
      three.current?.update(cur.current, 0);
      syncPhase(cur.current);
      syncCta();
      if (three.current && cur.current === t) { raf = 0; return; }
      raf = requestAnimationFrame(loop);
    };
    wake.current = () => { if (!raf) raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      wake.current = () => {};
    };
  }, [is3D, still, pinned, syncPhase, syncCta]);

  /**
   * VIDEO SCRUB. Same damped playhead as the other two renderers — `cur` eases
   * toward the scroll target, and the frame shown is that number times the
   * duration. Nothing here plays: `play()` is never called, the element is only
   * ever seeked, which is what makes the scroll the transport.
   *
   * THE SEEK GUARD IS THE WHOLE TRICK. Assigning `currentTime` while a seek is
   * still in flight cancels it and starts another, and at 60 fps that is a
   * decoder that never lands a frame — the classic "scrubbing video stutters"
   * bug. One seek at a time, and only when the target has moved more than a
   * frame's worth, so a resting scroll issues none at all.
   */
  useEffect(() => {
    if (active !== 'video') return;
    const v = video.current;
    if (!v) return;

    let raf = 0, dur = 0, seeking = false;
    const onMeta = () => { dur = v.duration || 0; };
    const onSeeked = () => { seeking = false; };
    const onError = () => setVideoFailed(true);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('seeked', onSeeked);
    v.addEventListener('error', onError);
    if (v.readyState >= 1) onMeta();

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!dur) return;
      const t = still ? 1 : (pinned ?? target.current);
      if (cur.current < 0) cur.current = t;
      else cur.current += (t - cur.current) * EASE;
      if (Math.abs(t - cur.current) < 0.0002) cur.current = t;
      const want = clamp01(cur.current) * dur;
      // A frame at 30fps. Below this the seek would land on the frame already
      // on screen, so it is pure decoder work for no visible change.
      if (!seeking && Math.abs(v.currentTime - want) > 1 / 30) {
        seeking = true;
        v.currentTime = want;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('seeked', onSeeked);
      v.removeEventListener('error', onError);
    };
  }, [active, still, pinned]);

  /* NO rAF LOOP FOR THE STATS ANY MORE. The bar's three-move choreography was
     the only thing this effect drove, and it wrote a transform and an opacity
     on every animation frame of the entire pin to do it. One class, latched
     from the scroll handler that already runs, replaces the lot — see
     `setStatsIn` below and `.story__stats.is-in` in the stylesheet. The
     hand-off needs no overlay: the camera rises, the road runs to a fogged
     horizon, and the pin releases onto the next section. */

  /* THE STATS BAR STILL HAS TO ARRIVE WHEN NOTHING IS SCRUBBING.
   *
   * Under `still` — a visitor who asked for reduced motion, or `?noloader`
   * capture mode — the whole ScrollTrigger effect below returns early, so the
   * pin, the scrub and `onUpdate` never exist and nothing was left to add
   * `is-in`. The stylesheet covered for that by pinning the bar open
   * (`.story--static .story__stats { opacity: 1 }`), and that is the bug: four
   * opaque cards, counters already run out, sitting over the hero from the
   * first painted frame. Exactly the thing the reveal exists to prevent, and
   * on the devices least able to afford the distraction.
   *
   * REDUCED MOTION MEANS NO MOTION, NOT NO SEQUENCE. The bar still starts
   * hidden and still arrives when the visitor scrolls; it simply fades instead
   * of sliding up (the `prefers-reduced-motion` rule on `.story__stats` in the
   * stylesheet already reduces the transition to opacity alone). There is no
   * pin on this path, so the hero is one viewport tall and 40% of it is the
   * point where the visitor has plainly started leaving it.
   *
   * Capture mode is the exception and latches immediately: `?noloader` exists
   * to photograph the finished composition, which includes the bar.
   *
   * `onScrollFrame` rather than a listener of its own — one scroll
   * subscription for the whole app, read once per frame. */
  useEffect(() => {
    if (!still) return;
    if (isCapture()) { setStatsIn(true); return; }
    /* Two-way here too: scroll back up to the hero on a reduced-motion device
       and the bar leaves again, same as it does under the scrub. */
    return onScrollFrame((y) => setStatsIn(y > viewportH() * 0.4));
  }, [still, setStatsIn]);

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
    const frames = isPhone() ? HERO_FRAMES_SMALL : HERO_FRAMES;
    const imgs: HTMLImageElement[] = frames.map((src) => {
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
      /* Reduced motion / capture: hold on the finished building rather than
         scrubbing to it. The 3D loop answers `still` the same way. */
      if (still) { draw(1); return; }
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

  /* `useLayoutEffect`, NOT `useEffect`, AND THAT IS THE WHOLE OF A CRASH FIX.
   *
   * ScrollTrigger's `pin: true` does not just set styles — it RE-PARENTS the
   * element. It inserts a pin-spacer into the DOM where the section was and
   * moves the section inside it. React knows nothing about that: its fiber
   * still records `<main>` as the section's host parent.
   *
   * So on any navigation away from `/` — every link in the mobile drawer and
   * the navbar — React unmounts this component and calls
   * `main.removeChild(section)`. The section's real parent is the spacer, so
   * the browser throws `NotFoundError: The node to be removed is not a child
   * of this node`, React tears down the root, and the app stops responding.
   * That is the "menu freezes on tap" symptom, and it fires on the FIRST
   * navigation out of the home page.
   *
   * `ctx.revert()` below undoes the pin and puts the section back — but as a
   * `useEffect` cleanup it is a PASSIVE effect, and React flushes those AFTER
   * the mutation phase. The unwrap was arriving after the removal it needed to
   * precede. A layout-effect cleanup runs synchronously during deletion,
   * before the host node is touched, so the section is back under `<main>` by
   * the time React reaches for it. This is the same reason GSAP's own
   * `useGSAP` hook is built on `useLayoutEffect`. */
  useLayoutEffect(() => {
    if (still || !root.current) return;

    /* Lenis → ScrollTrigger sync lives in useLenis, where the instance exists. */
    const ctx = gsap.context(() => {
      /* The copy fade is scrubbed, so whether it has started is read off the
         timeline itself rather than raw scroll, which runs ~0.6s ahead. */
      function onTl(this: gsap.core.Timeline) { copyLive.current = this.progress() < COPY_OUT - CTA_LEAD; syncCta(); }
      const tl = gsap.timeline(pinned !== null ? { paused: true, onUpdate: onTl } : {
        onUpdate: onTl,
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
          /* The dampener. 0.6 = the playhead spends ~0.6s catching up to the
             scroll position, so a flick of the wheel and a slow drag both render
             as the same continuous take. The canvas lerp then smooths what's
             left. It was 1.2 — stacked on Lenis's lerp and the canvas EASE that
             is three dampers in series, and the building trailed the wheel by
             well over a second, which reads as lag, not polish. */
          scrub: 0.6,
          /* Blow past the end fast and the scrubbed timeline is forced to its
             final state instead of easing there over the next 1.2s — without
             this, a hard flick leaves a half-built building and a half-faded
             headline still resolving while the ribbon is already on screen. */
          fastScrollEnd: true,
          /* Backstop for the flick that leaves the pin in one frame: onUpdate
             does fire at progress 1, but a scroll that overshoots the trigger
             entirely is the one case where "the end was reached" is easier to
             ask ScrollTrigger than to infer from the last sample we saw. */
          /* The four edges of the trigger, so a flick that skips past onUpdate
             entirely still lands on the right state. `onLeave` is the scroll
             that overshoots the end in one frame; `onLeaveBack` is the one that
             flies back above the start, which is exactly the journey that used
             to strand the bar on screen. `onRefresh` re-syncs after a layout
             change — a lazily-mounted section below resizing the page, an
             orientation change — because a refresh recomputes progress without
             necessarily firing onUpdate. */
          onLeave: () => { setCtaIn(false); setStatsIn(true); root.current?.toggleAttribute('data-open', true); },
          onLeaveBack: () => { setCtaIn(false); setStatsIn(false); },
          onUpdate: (self) => {
            const build = clamp01(self.progress / BUILD_FRACTION);
            target.current = build;
            wake.current();
            /* The poster only matters once the doors have parted. Hidden
               behind the closed gate it is never painted, so
               preparing the scene at load does not turn a decorative
               placeholder into the page's LCP. */
            root.current?.toggleAttribute('data-open', self.progress > 0.001);
            syncCta();
            setStatsIn(self.progress >= STATS_AT);
            /* The 3D hero publishes its own phase from the eased playhead in
               the loop above (`syncPhase`), so this only covers the renderers
               that have no such loop running — and `?flat`/`?video` are debug
               modes where the raw progress is close enough. */
            if (!is3D) syncPhase(build);
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
        // The headline resolves in behind the opening doors and is fully up by
        // the time they clear (GATE_END * 1.5) — over PHASE_1_END it was still
        // at ~30-50% opacity through all of "Built With Precision".
        // A fixed rise, not yPercent: on a phone the block now stretches down
        // the stage to carry the CTAs at its foot, and 18% of THAT height
        // would triple the slide.
        .fromTo('.story__finale-copy',
          { autoAlpha: 0, y: 44 },
          { autoAlpha: 1, y: 0, ease: 'power1.out', duration: GATE_END * SPAN },
          GATE_END * SPAN * 0.5)
        // Scrim rides the copy exactly — it exists only to back this text.
        .fromTo('.story__copy-scrim',
          { autoAlpha: 0 },
          { autoAlpha: 1, ease: 'power1.out', duration: GATE_END * SPAN },
          GATE_END * SPAN * 0.5)
        /* …and the TEXT clears out before the cards rise — `.story__beats`, not
           the whole block, because the CTAs are its children and opacity
           multiplies down the tree. autoAlpha so the outgoing copy also leaves
           the a11y tree. */
        .to('.story__beats',
          { autoAlpha: 0, y: -26, ease: 'power1.out', duration: COPY_FADE * SPAN },
          COPY_OUT * SPAN)
        .to('.story__copy-scrim',
          { autoAlpha: 0, ease: 'power1.out', duration: COPY_FADE * SPAN },
          COPY_OUT * SPAN);

      if (pinned !== null) {
        root.current?.toggleAttribute('data-open', true);
        tl.progress(pinned);
      }
    }, root);

    if (pinned !== null) return () => { ctx.revert(); };

    const t = window.setTimeout(() => ScrollTrigger.refresh(), 350);
    return () => {
      window.clearTimeout(t);
      ctx.revert();
    };
  }, [still, pinned, is3D, syncPhase, syncCta, setStatsIn, setCtaIn]);

  /* One element, two jobs: the Suspense fallback while the 3D chunk downloads,
     and HeroSite's own placeholder while the scene builds in stages. */
  const heroFallback = (
    isLite()
              ? <img
                  className="story__poster"
                  src={mediaSmall('heroPoster')}
                  srcSet={`${mediaSmall('heroPoster')} 800w, ${MEDIA.heroPoster} 1024w`}
                  sizes="100vw" width={1024} height={1024}
                  alt="" aria-hidden decoding="async"
                  /* LOW, not high: this is a stand-in shown only if the doors
                     open before the 3D chunk has landed, so it must not compete
                     with that chunk for bandwidth. (Lowercase attribute: React
                     18 does not map camelCase `fetchPriority`.) */
                  {...{ fetchpriority: 'low' }}
                />
              : <HeroLoader />
  );

  return (
    <section id="hero" className={`story ${still ? 'story--static' : ''} ${active !== 'flat' ? 'story--3d' : ''}`} ref={root} aria-label="Alipson Builders — a project from excavation to handover">
      <div className="story__stage">
        {active === 'video' && (
          /* Scrubbed timelapse — opt-in via ?video, never the default. It is
             never PLAYED: the scroll seeks it, which is what makes the scrub
             the transport. `preload="auto"` so the decoder has data to seek
             into, muted + playsInline so mobile browsers allow it, and a
             compositor promotion (in CSS) so each seek repaints on the GPU.
             Missing file -> `error` -> the 3D hero, so this flag is safe on a
             URL today. */
          <video
            ref={video}
            className="story__video"
            src="/assets/timelapse.mp4"
            preload="auto"
            muted
            playsInline
            disablePictureInPicture
            aria-hidden
          />
        )}
        {active === 'three' && (
          /* Real 3D — one WebGL canvas, camera cranes and orbits as it builds.
             The poster sits UNDER it rather than being swapped out, so the
             hand-off is a crossfade the compositor does for free instead of a
             frame where the stage is empty. */
          heavy && (
            /* THE POSTER IS THE SUSPENSE FALLBACK, which is the whole trick: it
               is on screen for exactly the window the 3D chunk is in flight and
               not one frame longer, with no readiness flag to keep in sync.

               It is also why it renders at `heavy` rather than at mount. This
               image is big enough to be the phone's LCP element — the split
               gate covers it but occlusion does not disqualify an LCP
               candidate — so painting it at scroll 0 made a decorative
               placeholder behind an opaque door into the metric the whole page
               is judged on. Rendered on the first scroll instead, it costs
               nothing and still does its job, because index.html preloads it at
               the same media query and it comes back from cache. */
            <Suspense fallback={heroFallback}>
              <HeroSite ref={three} className="story__three" fallback={heroFallback} />
            </Suspense>
          )
        )}
        {active === 'flat' && (
          <>
            {/* Scroll-scrubbed construction film — ?flat ONLY. The default hero
                is the 3D scene and nothing else; these photographs are never
                painted behind it. */}
            <canvas
              ref={canvas}
              className="story__canvas"
              role="img"
              aria-label="A single Alipson project filmed from excavation through structure and facade to the finished, illuminated building"
            />
            <div className="story__plate" ref={plate} />
            <HeroWireframe ref={wire} className="story__wire" />
            {/* Phase 4 — warm light coming on inside the volume */}
            <div className="story__interior" ref={glow} aria-hidden />
          </>
        )}
        {/* Left-weighted scrim so the finale copy always clears the 3D
            canvas behind it. Full-bleed and fading to transparent — a box-shaped
            scrim draws a hard seam across the render. */}
        <div className="story__copy-scrim" />
        <div className="story__grade" />

        {/* Stats bar — rises over the still-pinned canvas at the end of the
            scroll instead of being a separate section below it. The counters
            fire off their own IntersectionObserver, which only trips once this
            has actually slid into view, so they still count from 0 on reveal. */}
        <div className="story__stats" ref={stats}>
          {/* Cue lives INSIDE the stats block, in normal flow. Absolutely
              positioning it against the stage put it on top of the numbers as
              soon as the bar rose past it. It fades in off the same `is-in`
              class the bar does, a quarter-second behind it — it used to need a
              ref and a per-frame opacity write to do the same thing. */}
          <div className="story__cue" aria-hidden>
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
          {/* THE BEATS CROSS-DISSOLVE; THEY DO NOT TAKE TURNS.
              This was `mode="wait"`, which holds the incoming beat until the
              outgoing one has fully left — and for those ~0.5s the container
              has NO child at all, so it collapses to zero height and the CTAs
              below snap up and back down. That collapse is the "jumping" in
              this section, and it fires on every phase boundary.
              `.story__beats` is a one-cell grid and every beat is placed in
              that cell (see the stylesheet), so the two overlap instead of
              queueing: the outgoing fades down as the incoming fades up, the
              row keeps the height of the taller of the two, and nothing below
              it moves. Removing `mode` is what lets them coexist; the grid is
              what stops them stacking into a double-height block. */}
          <div className="story__beats">
          <AnimatePresence initial={false}>
            <m.div
              key={phase}
              className="story__beat"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              onAnimationComplete={(d) => {
                if ((d as { opacity?: number }).opacity !== 1) return; // the exit, not the entrance
                beatIn.current = phase;
                syncCta();
              }}
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
            </m.div>
          </AnimatePresence>
          </div>
          {/* NO LAYOUT UTILITIES ON THIS ROW. They were `flex flex-col
              sm:flex-row sm:items-center gap-4`, and every one of those shims
              carries `!important` (see index.css) — so `flex-col` was what
              stacked the two pills full-height on a phone, and no rule in the
              stylesheet could say otherwise. `.story__cta` is already a
              wrapping flex ROW; letting it own the layout is what puts the
              buttons side by side on small screens, and `flex-wrap` is the
              escape hatch that drops them back to two lines below ~340px
              rather than pushing the page into horizontal scroll. */}
          <div className="story__cta" ref={cta}>
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

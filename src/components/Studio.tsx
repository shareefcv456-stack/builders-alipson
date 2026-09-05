import { useRef, useState } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent, type MotionValue } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import Reveal from './ui/Reveal';
import RevealText from './ui/RevealText';
import Magnetic from './ui/Magnetic';
import AmbientCanvas from './AmbientCanvas';
import { HIGHLIGHTS } from '../data/site';
import { HERO_FRAMES, HERO_FRAMES_SMALL } from '../lib/media';
import { scrollToId } from '../hooks/useLenis';

/* THE PANEL CARRIES ONE DRAWING, NOT TWO. A second piece of architectural
   line-art used to bleed out from behind the frame's top-right corner. On its
   own it was a nice flourish; over a panel that is already a technical
   elevation dissolving into a photograph it was a third overlapping image, and
   it is the first thing to go when the brief is "one state should dominate".
   Removed here and in the stylesheet — `.studio__bp*` went with it. */

/* THE FOUR ACTS OF A BUILD, AND THE FILM THAT SHOWS THEM.
   `HERO_FRAMES` is the existing construction story — one Alipson project, one
   camera position, one dusk hour, photographed at five genuine stages. It is
   already the hero's scrub film; the studio panel plays the same reel under
   the reader's scroll instead of maintaining a second set of images.
   Five frames, four captions: the stepper names the acts a client cares about,
   the film carries the extra intermediate frame so the dissolve stays smooth. */
const STAGES = [
  { n: '01', label: 'Foundation', sub: 'A strong beginning' },
  { n: '02', label: 'Frame', sub: 'Building possibilities' },
  { n: '03', label: 'Structure', sub: 'Shaping spaces' },
  { n: '04', label: 'Finish', sub: 'Delivering dreams' },
];

/* One frame of the film. A STEP-IN RAMP, NOT A CROSSFADE PEAK: each frame
   fades from 0 to 1 across the segment before it and then STAYS at 1, so the
   stack is always fully opaque and mid-dissolve never shows the navy card
   through two half-transparent photographs. Frame 0 sits at 1 throughout —
   it is the ground the rest are painted over. */
function FilmFrame({ i, n, build }: { i: number; n: number; build: MotionValue<number> }) {
  const seg = 1 / (n - 1);
  const opacity = useTransform(build, [(i - 1) * seg, i * seg], [0, 1], { clamp: true });
  return (
    <motion.img
      className="studio__fr"
      style={{ opacity }}
      src={HERO_FRAMES[i]}
      srcSet={`${HERO_FRAMES_SMALL[i]} 800w, ${HERO_FRAMES[i]} 1608w`}
      sizes="(max-width: 900px) 100vw, 46vw"
      width={1608}
      height={978}
      alt=""
      decoding="async"
      loading="lazy"
    />
  );
}

export default function Studio() {
  const visualRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: visualRef, offset: ['start end', 'end start'] });

  /* ONE PLAYHEAD DRIVES THE WHOLE PANEL, and it is a function of scroll
     position — not a clock. 0 is a bare site under a blueprint, 1 is the
     finished, lit landmark; the film, the drafting overlay, the blueprint wash
     and the stepper all read from it, so they cannot drift apart.
     The window is 0.18-0.72 of the panel's pass through the viewport rather
     than 0-1: the head and tail of that range are the panel entering and
     leaving, where nobody is looking at it. Landing mid-section and stopping
     leaves the building topped out rather than half-built. */
  const build = useTransform(scrollYProgress, [0.18, 0.72], [0, 1], { clamp: true });

  /* The drafting sheet is a set of CSS keyframes on a 9s clock. Rather than
     rewrite them as scroll animations, the clock is PAUSED and scrubbed with a
     negative `animation-delay` — a paused animation sits frozen at |delay| into
     its own timeline, so feeding that from `build` plays the exact same
     sequence under the reader's thumb with no keyframe changed. The six stages
     draw across the first 40% of the clock. */
  /* THE DRAWING FINISHES DRAWING BEFORE IT HANDS OVER. The six stages of the
     sheet complete at 31% of its own clock, and scroll used to be mapped
     0-40% of that — so the whole build was over by `build` 0.78 while the
     sheet's opacity was already down to 0.14 by 0.55. The last two stages were
     therefore drawn onto something nobody could see, and the middle of the
     scroll showed a HALF-DRAWN elevation over a photograph of a different
     stage. That is the layered look: two states arguing, neither dominant.
     Now the drawing completes by `build` 0.58 — inside the STRUCTURE act, at
     full opacity — and only then does the photograph take over. */
  const buildDelay = useTransform(build, [0, 0.58], ['-0s', '-2.80s'], { clamp: true });
  /* ONE HAND-OVER, LATE AND SHORT. Linework owns the frame through FOUNDATION,
     FRAME and STRUCTURE; it drops to a technical ghost across FINISH. */
  const sheetFade = useTransform(build, [0.6, 0.86], [1, 0.09], { clamp: true });
  /* The blueprint wash holds the photograph back to a toned underlay for the
     same three acts — so what dominates early is unmistakably a DRAWING — and
     clears only as the finished landmark arrives. */
  const wash = useTransform(build, [0.6, 0.9], [0.94, 0.04], { clamp: true });
  /* The scanner. One thin red line, bottom to top, driven by the same
     playhead: at 0 it sits on the foundation, at 1 it has run out at the
     parapet. It is a survey line, not a beam — see `.studio__scan`. */
  const scanY = useTransform(build, [0.04, 0.96], ['96%', '4%'], { clamp: true });

  /* Which act is lit. State, not a motion value, because it is text the DOM has
     to re-render — and it only changes four times across the whole section. */
  const [act, setAct] = useState(0);
  useMotionValueEvent(build, 'change', (v) => {
    setAct(Math.min(STAGES.length - 1, Math.floor(v * STAGES.length)));
  });

  return (
    <section id="studio" className="section section--noir studio grain">
      <AmbientCanvas variant="blueprint" className="z-10" />
      <div className="container studio__grid relative z-20">

        {/* ---- LEFT · image composition ------------------------------------ */}
        <div className="studio__visual" ref={visualRef}>
          <Reveal dir="up" className="studio__stack">
            <motion.div
              className="studio__frame"
              /* The cast is for the custom properties alone — framer types its
                 own transform keys, but not arbitrary `--*` entries. */
              style={{ ...({
                '--build-delay': buildDelay,
                '--sheet-fade': sheetFade,
              } as Record<string, unknown>) }}
            >
              {/* THE STORY, IN PHOTOGRAPHS. Five stages of ONE project on one
                  camera, dissolving into each other as the reader scrolls:
                  excavation, columns, topped-out frame, facade, delivered and
                  lit. Not an illustration of a building — the building. */}
              <div
                className="studio__film"
                role="img"
                aria-label="One Alipson project photographed from foundation through frame and structure to the finished, illuminated building"
              >
                {HERO_FRAMES.map((src, i) => (
                  <FilmFrame key={src} i={i} n={HERO_FRAMES.length} build={build} />
                ))}
                {/* Blueprint wash. Deep navy over the bare site, gone by the
                    time the landmark is standing — the panel literally moves
                    from drawing to architecture. */}
                <motion.span className="studio__wash" style={{ opacity: wash }} aria-hidden="true" />
              </div>
              {/* THE SCANNER. A single hairline with two end ticks and a short
                  red glow under it, riding the playhead up the elevation. It is
                  the only moving mark on the panel: the stages themselves are
                  crossfades, so without it nothing tells the reader that what
                  they are looking at is being scrubbed by their own scroll. */}
              <motion.span className="studio__scan" style={{ top: scanY }} aria-hidden="true" />

              {/* 6-stage construction sequence on one shared 9s clock. Every
                  stage is a dash-drawn layer whose window is set in the CSS
                  keyframes; the build lands complete at ~2.8s and holds. */}
              <svg className="studio__sheet" viewBox="0 0 400 500" aria-hidden="true" focusable="false">
                {/* static drafting grid */}
                <g className="studio__grid">
                  {Array.from({ length: 21 }).map((_, i) => <path key={`gv${i}`} d={`M${i * 20} 0V500`} />)}
                  {Array.from({ length: 26 }).map((_, i) => <path key={`gh${i}`} d={`M0 ${i * 20}H400`} />)}
                </g>

                <g className="studio__plan">
                  {/* 1 — plot, structural axes, dimension strings, elevation tags */}
                  <g className="studio__st studio__st--1">
                    <path d="M60 90h280v328H60z" />
<path d="M84 46V426" /><path d="M200 46V426" /><path d="M316 46V426" />
<path d="M30 402h300M30 270h300" />
<path d="M60 446h188M60 438v16M248 438v16M154 438v16" />
<path d="M352 110v292M344 110h16M344 402h16M344 270h16" />
                    <circle cx="84" cy="40" r="9" /><circle cx="200" cy="40" r="9" /><circle cx="316" cy="40" r="9" />
                    <path d="M40 344h14M40 286h14M40 228h14M40 170h14M40 110h14" />
                  </g>

                  {/* 2 — foundation raft, ground beam and pad footings */}
                  <g className="studio__st studio__st--2">
                    <path d="M64 402h272v14H64z" /><path d="M70 416h260v9H70z" /><path d="M67 416h34v16h-34z" /><path d="M128 416h34v16h-34z" /><path d="M183 416h34v16h-34z" /><path d="M238 416h34v16h-34z" /><path d="M299 416h34v16h-34z" /><path d="M70 425l11 9M100 425l11 9M130 425l11 9M160 425l11 9M190 425l11 9M220 425l11 9M250 425l11 9M280 425l11 9M310 425l11 9" />
                  </g>

                  {/* 3 — load-bearing columns rising to the top slab */}
                  <g className="studio__st studio__st--3">
                    <path d="M78 402V110h12v292z" /><path d="M139 402V110h12v292z" /><path d="M194 402V110h12v292z" /><path d="M249 402V110h12v292z" /><path d="M310 402V110h12v292z" />
                  </g>

                  {/* 4 — floor slabs, room partitions, balcony cantilevers */}
                  <g className="studio__st studio__st--4">
                    <path d="M64 344h272v9H64z" /><path d="M64 286h272v9H64z" /><path d="M64 228h272v9H64z" /><path d="M64 170h272v9H64z" /><path d="M110 402V350h64v52M225 344v-52h58v52" /><path d="M110 286v-52h50v52M240 228v-52h56v52" /><path d="M336 320h30v9h-30zM336 204h30v9h-30z" />
                  </g>

                  {/* 5 — glazing, door openings and facade louvers */}
                  <g className="studio__st studio__st--5">
                    <path d="M96 368h38v26h-38zM157 368h32v26h-32zM212 368h32v26h-32zM267 368h38v26h-38z" /><path d="M96 310h38v26h-38zM157 310h32v26h-32zM212 310h32v26h-32zM267 310h38v26h-38z" /><path d="M96 252h38v26h-38zM157 252h32v26h-32zM212 252h32v26h-32zM267 252h38v26h-38z" /><path d="M96 194h38v26h-38zM157 194h32v26h-32zM212 194h32v26h-32zM267 194h38v26h-38z" /><path d="M96 136h38v26h-38zM157 136h32v26h-32zM212 136h32v26h-32zM267 136h38v26h-38z" /><path d="M186 402v-32h28v32" /><path d="M96 140h38M96 148h38M96 156h38M267 140h38M267 148h38M267 156h38" />
                  </g>

                  {/* 6 — roof truss and parapet crown */}
                  <g className="studio__st studio__st--6">
                    <path d="M64 110h272v10H64z" /><path d="M70 110 200 64l130 46" /><path d="M70 110h260M200 64v46" /><path d="M70 110 135 86M135 86l65 24M200 64l65 22M265 86l65 24" /><path d="M135 86v24M265 86v24" /><path d="M64 50h272v12H64z" />
                  </g>
                </g>

                {/* The crimson sweep that used to live here ran on the build
                    clock and fired once, near the end. The scroll-driven
                    scanner outside the SVG replaces it — two red sweeps on one
                    panel was one of the layers the panel did not need. */}
              </svg>
              <span className="studio__scrim" aria-hidden="true" />

              {/* diagonal red wedge, top-right */}
              <svg className="studio__cut" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path d="M100 0v46L36 0z" />
              </svg>

              <span className="studio__vision">From vision<br />to landmarks</span>
              <span className="studio__wm">
                Alipson Builders
                <em>Building a brighter tomorrow</em>
              </span>
            </motion.div>

            {/* THE STEPPER IS A SIBLING OF THE FRAME, NOT A CHILD — which is
                what lets it be an overlay down the right edge on desktop and a
                plain list UNDER the photograph on a phone, from one markup
                path. Absolutely positioned text over a 320px-tall image is how
                you get four captions sitting on a building. */}
            <ol className="studio__steps">
              {STAGES.map(({ n, label, sub }, i) => (
                <li className={`studio__step${i === act ? ' is-on' : ''}`} key={label}>
                  <i className="studio__step-dot" aria-hidden="true" />
                  <b className="studio__step-n">{n}</b>
                  <em className="studio__step-l">{label}</em>
                  <span className="studio__step-s">{sub}</span>
                </li>
              ))}
            </ol>

            <div className="studio__badge">
              <b>15+</b>
              <span>Years of<br />Excellence</span>
            </div>
          </Reveal>
        </div>

        {/* ---- RIGHT · content card ---------------------------------------- */}
        <Reveal dir="left" className="studio__detailsWrap">
          <div className="studio__details">
            <Reveal delay={0.05}><span className="eyebrow eyebrow--center studio__eyebrow">The Studio</span></Reveal>
            <RevealText
              className="title studio__title"
              lines={[<>Architecture with</>, <>a sense of <em>permanence.</em></>]}
            />

            <Reveal dir="up" delay={0.2}>
              <blockquote className="studio__quote">
                "We believe architecture has the power to inspire, shape cultures and{' '}
                <span>build lasting legacies.</span>"
              </blockquote>
            </Reveal>

            <Reveal dir="up" delay={0.28}>
              <p className="studio__body">
                For over fifteen years, Alipson Builders has turned bold visions into
                enduring landmarks. We are architects, structural engineers and luxury
                homebuilders devoted to premium craftsmanship, absolute transparency and
                design that stands the test of time.
              </p>
            </Reveal>

            {/* THREE SPECIFICATION CARDS. The scroll-driven rail that used to
                thread them together is gone: the panel already has one
                scroll-driven mechanism in it — the build, on the left — and a
                second one competing for the same attention is what made this
                column read as a second animation rather than as the claim it
                makes. Each card dims to 0.7 once it leaves the read position
                rather than staying lit, so the list still tracks the scroll;
                `once: false` is what makes that a state instead of a one-shot
                entrance, on the way back up as well as down. */}
            <ul className="studio__highlights">
              {HIGHLIGHTS.map((h, i) => (
                <motion.li
                  className="studio__hl"
                  key={h.title}
                  variants={{
                    rest: { opacity: 0.7, borderColor: 'rgba(255,255,255,0.10)' },
                    active: { opacity: 1, borderColor: 'rgba(211,16,24,0.30)' },
                  }}
                  initial="rest"
                  whileInView="active"
                  viewport={{ amount: 0.7, once: false }}
                  /* Each card lands a beat after the one above it, so the
                     principles arrive as a sequence rather than a block. The
                     step is small: at 0.07s a reader scrolling normally sees a
                     cascade, not a queue they have to wait out. */
                  transition={{ duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="studio__hl-icon"><h.icon size={20} strokeWidth={1.9} /></span>
                  <span className="studio__hl-txt">
                    <em className="studio__hl-step">0{i + 1}</em>
                    <h4>{h.title}</h4>
                    <p>{h.desc}</p>
                  </span>
                </motion.li>
              ))}
            </ul>

            <Reveal dir="up" delay={0.7}>
              <div className="btn-group studio__cta">
                <Magnetic strength={0.25}>
                  <button className="btn btn-primary" onClick={() => scrollToId('intro')}>
                    Our Story <ArrowUpRight size={16} />
                  </button>
                </Magnetic>
                {/* A text link, not a second button: the reference gives these
                    two actions different weights, and two filled pills side by
                    side is how a page ends up with no primary action at all. */}
                <button className="studio__link" onClick={() => scrollToId('founder')}>
                  Meet the Founder
                </button>
              </div>
            </Reveal>
          </div>
        </Reveal>

      </div>
    </section>
  );
}

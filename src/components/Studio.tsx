import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight, Download } from 'lucide-react';
import Reveal from './ui/Reveal';
import RevealText from './ui/RevealText';
import Magnetic from './ui/Magnetic';
import AmbientCanvas from './AmbientCanvas';
import { HIGHLIGHTS } from '../data/site';
import { useUI } from '../context/UIContext';

/* Architectural line-art that sits behind the photo's top-right corner: a
   framed elevation over a faint measuring grid. Decorative only. */
function BlueprintArt() {
  return (
    <svg className="studio__bp" viewBox="0 0 260 300" aria-hidden="true" focusable="false">
      <g className="studio__bp-grid">
        {Array.from({ length: 9 }).map((_, i) => (
          <path key={`v${i}`} d={`M${20 + i * 28} 10V290`} />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <path key={`h${i}`} d={`M10 ${20 + i * 28}H250`} />
        ))}
      </g>
      <g className="studio__bp-line">
        <path d="M48 250V96l82-58 82 58v154" />
        <path d="M48 250h164M76 250v-62h48v62M148 148h40v40h-40zM76 118h48v40H76z" />
        <path d="M130 38v212" />
      </g>
      <g className="studio__bp-dim">
        <path d="M30 268h200M30 262v12M230 262v12" />
      </g>
    </svg>
  );
}

const PHASE_LABELS = ['Foundation', 'Framing', 'Finish'];

export default function Studio() {
  const visualRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLUListElement>(null);
  const { openQuote, openBrochure } = useUI();
  const { scrollYProgress } = useScroll({ target: visualRef, offset: ['start end', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], ['-4%', '4%']);

  /* THE BUILD IS A TIMED LOOP, NOT A SCROLL SCRUB — and the loop is weighted so
     the FINISHED building is what is on screen almost all the time.
     Scrubbing tied the sequence to scroll position, which meant the only way to
     see the completed structure was to scroll the panel most of the way past
     the viewport; land on the section and stop, and you were stuck looking at
     bare foundations. Back on a clock, the whole build now takes ~2.8s of a 9s
     cycle and the remaining ~6s holds the finished plan. The timing lives
     entirely in the CSS keyframes (`@keyframes studioS1..S6`) — nothing here
     drives it, which is why all six motion values and the phase-tracking state
     that used to sit in this component are gone.
     `<Deferred>` mounts this section about a viewport early, so the animation
     starts a beat before the panel is actually reached. */

  /* The value stepper's rail fill — same pattern as <Process>. */
  const { scrollYProgress: stepsProgress } = useScroll({
    target: stepsRef, offset: ['start 85%', 'end 65%'],
  });
  const stepFill = useTransform(stepsProgress, [0, 1], [0, 1]);

  return (
    <section id="studio" className="section section--noir studio grain">
      <AmbientCanvas variant="blueprint" className="z-10" />
      <div className="container studio__grid relative z-20">

        {/* ---- LEFT · image composition ------------------------------------ */}
        <div className="studio__visual" ref={visualRef}>
          <Reveal dir="up" delay={0.25}><BlueprintArt /></Reveal>

          <Reveal dir="up" className="studio__stack">
            <motion.figure className="studio__frame" style={{ y: imgY }}>
              {/* 6-stage construction sequence on one shared 9s clock. Every
                  stage is a dash-drawn layer whose window is set in the CSS
                  keyframes; the build lands complete at ~2.8s and holds. */}
              <svg className="studio__sheet" viewBox="0 0 400 500" aria-hidden="true" focusable="false">
                <defs>
                  <linearGradient id="studioBeam" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#d31018" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#d31018" stopOpacity="0" />
                  </linearGradient>
                </defs>

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

                {/* Laser sweep — same 9s clock, sweeping base→roof as the last
                    stage tops out. */}
                <rect className="studio__beam" x="52" y="0" width="296" height="120" fill="url(#studioBeam)" />
              </svg>
              <span className="studio__scrim" aria-hidden="true" />

              {/* Phase caption. The sequence draws six stages but reads as three
                  acts, and without naming them the panel is a pretty line
                  animation rather than a claim about how the work is done.
                  Which one is lit is a CSS animation on the same clock as the
                  drawing — there is no React state behind it, so the caption
                  cannot drift out of step with what the lines are doing. */}
              <div className="studio__phases" aria-hidden="true">
                {PHASE_LABELS.map((label) => (
                  <span className="studio__phase" key={label}>{label}</span>
                ))}
              </div>

              {/* diagonal navy wedge, top-right */}
              <svg className="studio__cut" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path d="M100 0v46L36 0z" />
              </svg>
              {/* red chevron, bottom-left */}
              <svg className="studio__chev" viewBox="0 0 120 160" aria-hidden="true">
                <path d="M6 156V42L48 0h44L50 42v114z" />
              </svg>

              <span className="studio__wm">Alipson Builders</span>
              <figcaption className="studio__badge">
                <b>15+</b>
                <span>Years of<br />Excellence</span>
              </figcaption>
            </motion.figure>
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

            {/* A STEPPER, not three boxes. Same mechanism as <Process>: a rail
                behind the nodes with a crimson fill scaled by scroll progress,
                and each step revealing as the fill reaches it. The rail is the
                only new part — the icon, title and copy are the same nodes the
                cards had. `amount: 0.6` on each step is what syncs the reveal
                to the fill rather than to the list entering the viewport. */}
            <ul className="studio__highlights" ref={stepsRef}>
              <div className="studio__hl-rail" aria-hidden="true">
                <motion.div className="studio__hl-fill" style={{ scaleY: stepFill }} />
              </div>
              {HIGHLIGHTS.map((h, i) => (
                <Reveal dir="up" delay={0} amount={0.6} key={h.title} className="studio__hl-row">
                  <li className="studio__hl">
                    <span className="studio__hl-icon"><h.icon size={20} strokeWidth={1.9} /></span>
                    <span className="studio__hl-txt">
                      <em className="studio__hl-step">0{i + 1}</em>
                      <h4>{h.title}</h4>
                      <p>{h.desc}</p>
                    </span>
                  </li>
                </Reveal>
              ))}
            </ul>

            <Reveal dir="up" delay={0.7}>
              <div className="btn-group studio__cta">
                <Magnetic strength={0.25}>
                  <button className="btn btn-primary" onClick={openQuote}>
                    Start a Project <ArrowUpRight size={16} />
                  </button>
                </Magnetic>
                <button className="btn btn-ghost" onClick={openBrochure}>
                  <Download size={15} /> Brochure
                </button>
              </div>
            </Reveal>
          </div>
        </Reveal>

      </div>
    </section>
  );
}

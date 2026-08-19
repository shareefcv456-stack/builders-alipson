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

export default function Studio() {
  const visualRef = useRef<HTMLDivElement>(null);
  const { openQuote, openBrochure } = useUI();
  const { scrollYProgress } = useScroll({ target: visualRef, offset: ['start end', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], ['-4%', '4%']);

  return (
    <section id="studio" className="section studio grain">
      <AmbientCanvas variant="blueprint" className="z-10" />
      <div className="container studio__grid relative z-20">

        {/* ---- LEFT · image composition ------------------------------------ */}
        <div className="studio__visual" ref={visualRef}>
          <Reveal dir="up" delay={0.25}><BlueprintArt /></Reveal>

          <Reveal dir="up" className="studio__stack">
            <motion.figure className="studio__frame" style={{ y: imgY }}>
              {/* Structural construction plan. A crimson laser sweeps up from
                  the foundation over 4s; each layer draws in as the beam passes
                  it (grid axes → load pillars → shear walls → roof beams), then
                  the whole sheet glows, holds, and loops. */}
              <svg className="studio__sheet" viewBox="0 0 400 500" aria-hidden="true" focusable="false">
                <defs>
                  <linearGradient id="studioLaser" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C8102E" stopOpacity="0" />
                    <stop offset="40%" stopColor="#C8102E" stopOpacity="0.55" />
                    <stop offset="50%" stopColor="#ffffff" stopOpacity="0.95" />
                    <stop offset="60%" stopColor="#C8102E" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#C8102E" stopOpacity="0" />
                  </linearGradient>
                </defs>

                <g className="studio__plan">
                  {/* setting-out grid + column reference axes */}
                  <g className="studio__lyr studio__lyr--grid">
                    {[60, 130, 200, 270, 340].map((x) => <path key={`gx${x}`} d={`M${x} 60V430`} />)}
                    {[110, 180, 250, 320, 390].map((y) => <path key={`gy${y}`} d={`M40 ${y}H360`} />)}
                    <path d="M40 430h320" />
                  </g>

                  {/* load-bearing pillars on the grid intersections */}
                  <g className="studio__lyr studio__lyr--pillars">
                    {[60, 130, 200, 270, 340].map((x) => (
                      <path key={`p${x}`} d={`M${x - 7} 430V96h14v334z`} />
                    ))}
                    <path d="M40 430h320v18H40z" />
                  </g>

                  {/* shear walls + floor slabs */}
                  <g className="studio__lyr studio__lyr--walls">
                    {[110, 180, 250, 320].map((y) => (
                      <path key={`s${y}`} d={`M53 ${y - 6}h294v12H53z`} />
                    ))}
                    <path d="M137 320h56v70h-56zM207 250h56v70h-56z" />
                    <path d="M67 180h56v62H67z" />
                  </g>

                  {/* roof beam network */}
                  <g className="studio__lyr studio__lyr--roof">
                    <path d="M40 96h320" />
                    <path d="M40 96 200 52l160 44" />
                    <path d="M130 96 200 52l70 44M60 96l140-44M340 96 200 52" />
                    <path d="M40 78h320" />
                  </g>

                  {/* elevation dimension strings */}
                  <g className="studio__lyr studio__lyr--dims">
                    <path d="M374 96v334M366 96h16M366 430h16" />
                    <path d="M40 460h320M40 452v16M360 452v16" />
                  </g>
                </g>

                {/* Step 1 — the laser itself */}
                <rect className="studio__laser" x="28" y="0" width="344" height="56" fill="url(#studioLaser)" />

                <text className="studio__mark" x="200" y="486" textAnchor="middle">ALIPSON BUILDERS</text>
              </svg>
              <span className="studio__scrim" aria-hidden="true" />

              {/* diagonal navy wedge, top-right */}
              <svg className="studio__cut" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path d="M100 0v46L36 0z" />
              </svg>
              {/* red chevron, bottom-left */}
              <svg className="studio__chev" viewBox="0 0 120 160" aria-hidden="true">
                <path d="M6 156V42L48 0h44L50 42v114z" />
              </svg>

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

            <ul className="studio__highlights">
              {HIGHLIGHTS.map((h, i) => (
                <Reveal dir="up" delay={0.36 + i * 0.1} key={h.title}>
                  <li className="studio__hl">
                    <span className="studio__hl-icon"><h.icon size={20} strokeWidth={1.9} /></span>
                    <span className="studio__hl-txt">
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

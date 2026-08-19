import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowRight, ArrowLeft } from 'lucide-react';
import RevealText from './ui/RevealText';
import Reveal, { Stagger, staggerItem } from './ui/Reveal';
import AmbientCanvas from './AmbientCanvas';
import { SERVICES, type Service } from '../data/site';
import Sketch, { type SketchVariant } from './ui/Sketch';
import { scrollToId } from '../hooks/useLenis';

/* The crimson track that sweeps behind the cards, with a car riding it.
   The car lives INSIDE the svg and moves with <animateMotion> along the same
   `d`, so it shares the viewBox: a CSS offset-path would be in CSS-pixel space
   and would slide off the road at every width but one. */
const ROAD = 'M-40 400 C 200 400, 380 590, 700 590 S 1150 430, 1560 230';

function RoadTrack() {
  const still = useReducedMotion();
  return (
    <div className="svc__road" aria-hidden="true">
      <svg viewBox="0 0 1440 700" preserveAspectRatio="xMidYMid slice">
        <path className="svc__road-bed" d={ROAD} />
        <path className="svc__road-dash" d={ROAD} />
        {!still && (
          <g className="svc__car">
            <g transform="translate(-26 -13) scale(1.2)">
              <rect x="1" y="5" width="42" height="12" rx="6" fill="#FFFFFF" />
              <rect x="12" y="1.5" width="19" height="8" rx="3.5" fill="#FFFFFF" />
              <rect x="14" y="3" width="15" height="5" rx="2" fill="#0B132B" opacity=".35" />
              <circle cx="12" cy="17" r="3.4" fill="#0B132B" />
              <circle cx="32" cy="17" r="3.4" fill="#0B132B" />
            </g>
            <animateMotion dur="17s" repeatCount="indefinite" rotate="auto" path={ROAD} />
          </g>
        )}
      </svg>
    </div>
  );
}

/* Index-aligned with SERVICES — each card gets its own drawing:
   01 villa elevation + courtyard, 02 commercial floorplate + column grid,
   03 compass/scale/golden ratio, 04 retrofit beam reinforcement. */
const SVC_SKETCH: SketchVariant[] = ['villa', 'commercial', 'planning', 'retrofit'];

function Card({ service, sketch, active, onToggle }: {
  service: Service; sketch: SketchVariant; active: boolean; onToggle: () => void;
}) {
  const Icon = service.icon;
  return (
    <motion.article
      className={`svc ${active ? 'is-active' : ''}`}
      variants={staggerItem}
      onClick={onToggle}
    >
      <Sketch variant={sketch} className="svc__sketch" />
      <span className="svc__num">{service.num}</span>
      <span className="svc__icon"><Icon size={22} strokeWidth={1.9} /></span>
      <h3 className="svc__title">{service.title}</h3>
      <span className="svc__rule" aria-hidden="true" />
      <p className="svc__desc">{service.desc}</p>
      <button
        className="svc__more"
        onClick={(e) => { e.stopPropagation(); scrollToId('contact'); }}
      >
        Explore <ArrowRight size={16} />
      </button>
    </motion.article>
  );
}

export default function Services() {
  const [active, setActive] = useState<number | null>(null);
  /* Nudges the grid on narrow screens, where the cards scroll horizontally. */
  const nudge = (dir: -1 | 1) => {
    const el = document.querySelector<HTMLElement>('.services__grid');
    if (el) el.scrollBy({ left: dir * (el.clientWidth * 0.6), behavior: 'smooth' });
  };

  return (
    <section id="services" className="section svcs">
      <AmbientCanvas variant="assembly" className="z-10" />
      <RoadTrack />

      <div className="container relative z-20">
        <div className="svcs__head">
          <div className="section-head">
            <Reveal><span className="eyebrow svcs__eyebrow">Capabilities</span></Reveal>
            <RevealText className="title svcs__title" lines={[<>Every discipline,</>, <>under <em>one roof.</em></>]} />
          </div>
          <Reveal dir="left" delay={0.1}>
            <div className="svcs__nav">
              <button className="svcs__nav-btn" onClick={() => nudge(-1)} aria-label="Previous capabilities">
                <ArrowLeft size={18} />
              </button>
              <button className="svcs__nav-btn svcs__nav-btn--dark" onClick={() => nudge(1)} aria-label="Next capabilities">
                <ArrowRight size={18} />
              </button>
            </div>
          </Reveal>
        </div>

        <Stagger className="services__grid" gap={0.12}>
          {SERVICES.map((s, i) => (
            <Card
              key={s.num}
              service={s}
              sketch={SVC_SKETCH[i]}
              active={active === i}
              onToggle={() => setActive(active === i ? null : i)}
            />
          ))}
        </Stagger>

        <Reveal delay={0.1}>
          <div className="svcs__foot">
            <button className="ul-link" onClick={() => scrollToId('contact')}>
              Discuss your requirement <ArrowUpRight size={15} />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

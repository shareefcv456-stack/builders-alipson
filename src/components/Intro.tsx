import { useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import Reveal, { Stagger } from './ui/Reveal';
import RevealText from './ui/RevealText';
import { scrollToId } from '../hooks/useLenis';
import { WHY } from '../data/site';
import Sketch from './ui/Sketch';

/**
 * The Alipson Standard — one head, one lede, one 4-card grid.
 *
 * Each card carries a blueprint line-drawing that sits at 0.12 opacity by
 * default and brightens when the card takes its dark state. Cards go dark on
 * hover, on focus-within (keyboard), or when clicked — the click state is the
 * only one React tracks; the other two are pure CSS.
 */

/* Index-aligned with WHY: contracts, timeline, framing, ecology. Drawn with
   currentColor so the card's dark state recolours them for free; the `.hl`
   group is the crimson structural detail that only shows in that state. */
const BLUEPRINTS: ReactNode[] = [
  // 01 — contract documents, stamped and signed
  <g>
    <rect x="14" y="10" width="62" height="80" rx="3" />
    <path d="M26 26h38M26 38h38M26 50h26M26 62h32" />
    <g className="hl"><circle cx="62" cy="70" r="10" /><path d="M56 70h12M62 64v12" /></g>
    <path d="M4 22h10M4 34h10" />
  </g>,
  // 02 — Gantt / programme bars against a time axis
  <g>
    <path d="M8 14v76M8 90h84" />
    <rect x="16" y="22" width="40" height="9" rx="2" />
    <rect x="30" y="38" width="46" height="9" rx="2" />
    <rect x="22" y="54" width="30" height="9" rx="2" />
    <g className="hl"><rect x="44" y="70" width="38" height="9" rx="2" /><path d="M63 14v76" /></g>
    <path d="M24 90v6M48 90v6M72 90v6" />
  </g>,
  // 03 — structural framing grid, braced bays
  <g>
    <path d="M10 88V16h72v72" />
    <path d="M34 16v72M58 16v72M10 40h72M10 64h72" />
    <g className="hl"><path d="M10 16l24 24M58 64l24 24" /><circle cx="34" cy="40" r="3" /><circle cx="58" cy="64" r="3" /></g>
    <path d="M4 88h84" />
  </g>,
  // 04 — eco elevation, planted roof and solar shading
  <g>
    <path d="M16 90V44l28-20 28 20v46" />
    <path d="M32 90V64h24v26M16 44h56" />
    <g className="hl"><path d="M44 34c8 0 12 5 12 10-8 0-12-4-12-10zM44 34c-8 0-12 5-12 10 8 0 12-4 12-10z" /></g>
    <path d="M6 90h82M24 54h8M56 54h8" />
  </g>,
];

/* 0.7s fade-in-up; the 0.15s stagger lives on the parent. */
const cardItem: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

export default function Intro() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <section id="intro" className="section std">
      <Sketch variant="tower" className="std__sketch" />

      <div className="container">
        <div className="section-head section-head--center">
          <Reveal><span className="eyebrow eyebrow--center std__eyebrow">Why Alipson</span></Reveal>
          <RevealText className="title std__title" as="h2" lines={[<>The Alipson <em>Standard.</em></>]} />
          <Reveal dir="up" delay={0.1}>
            <p className="lede std__lede">
              Structure that outlives the fashion around it. We control quality at
              source — verified materials, third-party tested concrete and load paths
              engineered with margin. Costs are open-book from day one, and the
              handover date you are given is the date you get the keys.
            </p>
          </Reveal>
        </div>

        <Stagger className="std__grid" gap={0.15}>
          {WHY.map((b, i) => (
            <motion.article
              className={`std__card ${active === i ? 'is-active' : ''}`}
              key={b.title}
              variants={cardItem}
              onClick={() => setActive(active === i ? null : i)}
            >
              <span className="std__sweep" aria-hidden="true" />
              <svg className="std__bp" viewBox="0 0 96 100" aria-hidden="true" focusable="false">
                {BLUEPRINTS[i]}
              </svg>

              <span className="std__ic" aria-hidden="true">
                <b.icon size={20} strokeWidth={1.75} />
                <i className="std__dot" />
              </span>

              <h3>{b.title}</h3>
              <p>{b.desc}</p>

              {/* ponytail: every card points at Services — there are no
                  per-value detail pages yet. Repoint when they exist. */}
              <button
                className="std__more"
                onClick={(e) => { e.stopPropagation(); scrollToId('services'); }}
              >
                Learn More <ArrowRight size={14} />
              </button>
            </motion.article>
          ))}
        </Stagger>

        <Reveal dir="up" delay={0.15}>
          <div className="std__foot">
            <button className="ul-link std__cta" onClick={() => scrollToId('founder')}>
              Discover Our Legacy <ArrowRight size={16} />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

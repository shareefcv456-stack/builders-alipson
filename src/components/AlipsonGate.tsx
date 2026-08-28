import { useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ShieldCheck, Landmark, Lightbulb, ArrowRight } from 'lucide-react';
import Reveal, { Stagger, staggerItem } from './ui/Reveal';
import RevealText from './ui/RevealText';
import { scrollToId } from '../hooks/useLenis';
import { media } from '../lib/media';
import Sketch from './ui/Sketch';

const FEATURES = [
  { icon: ShieldCheck, title: 'Automated Smart Access Control', desc: 'Motorised leaves with app, RFID and intercom entry, plus a battery fallback so the gate never strands a resident.' },
  { icon: Landmark,    title: 'Custom Steel & Concrete Archway Aesthetics', desc: 'Fabricated in-house — board-formed concrete piers, powder-coated steel spans and stone cladding matched to the facade.' },
  { icon: Lightbulb,   title: 'Integrated Facade Ambient Lighting', desc: 'Recessed grazers and step-lit approaches wired into the estate circuit, tuned warm so the entrance reads at dusk.' },
];

/* Bottom-right corner pattern: stepped crimson-over-charcoal wedges, with thin
   crimson rules running parallel to the step as texture. */
function GeoPattern() {
  return (
    <svg className="gate__geo" viewBox="0 0 90 90" aria-hidden="true" focusable="false">
      <path className="gf-dark" d="M90 90H30L90 30z" />
      <path className="gf-red" d="M90 90H58L90 58z" />
      <g className="gf-bars">
        <path d="M22 90 90 22M14 90 90 14M6 90 90 6" />
      </g>
    </svg>
  );
}

export default function AlipsonGate() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start end', 'end start'] });
  /* Parallax zoom: 1.0 → 1.04 across the section's pass through the viewport. */
  const zoom = useTransform(scrollYProgress, [0, 1], [1, 1.04]);

  return (
    <section id="gateway" className="section gate">
      <div className="container">
        {/* THE SECTION HEAD LIVES INSIDE THE IMAGE. It used to sit above the
            banner as a centred block, which pushed the photo a full heading's
            height down the page and left the image itself captioned only at the
            bottom. Overlaid on the top-left it does both jobs at once — names
            the section and gives the banner its title.
            The badge pill that used to sit in this corner ("01 / Signature
            Gateway") is gone: it said less than the heading now standing in its
            place, and two stacked labels in one corner is clutter. */}
        <div className="gate__stage" ref={stageRef}>
          <Reveal dir="scale">
            <figure className="gate__visual">
              <motion.img
                src={media('gateway')}
                alt="An Alipson entrance — lit portico, stone piers and step-lit approach at dusk"
                style={{ scale: zoom }}
                loading="lazy"
              />
              <div className="gate__head">
                <Reveal><span className="eyebrow gate__eyebrow">The Alipson Gate</span></Reveal>
                <RevealText
                  className="title gate__title"
                  lines={[<>The Gateway to Luxury Living</>, <><em>Signature Entry Architecture</em></>]}
                />
              </div>
              <figcaption className="gate__caption">
                <b>Signature Entrance</b>
                <span>Stone piers · lit portico · step-lit approach</span>
              </figcaption>
            </figure>
          </Reveal>

        </div>

        <Stagger className="gate__features" gap={0.12}>
          {FEATURES.map((f, i) => (
            <motion.article
              className={`gate__card ${active === i ? 'is-active' : ''}`}
              key={f.title}
              variants={staggerItem}
              onClick={() => setActive(active === i ? null : i)}
            >
              <Sketch variant="gate" className="gate__sketch" />
              <GeoPattern />
              <span className="gate__card-ic"><f.icon size={20} strokeWidth={1.9} /></span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              {/* ponytail: no per-feature pages yet — same destination as the
                  Standard cards. Repoint when they exist. */}
              <button className="gate__more" onClick={(e) => { e.stopPropagation(); scrollToId('services'); }}>
                Learn More <ArrowRight size={14} />
              </button>
            </motion.article>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

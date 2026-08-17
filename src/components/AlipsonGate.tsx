import { motion } from 'framer-motion';
import { ShieldCheck, Landmark, Lightbulb } from 'lucide-react';
import Reveal, { Stagger, staggerItem } from './ui/Reveal';
import RevealText from './ui/RevealText';
import { media } from '../lib/media';

const FEATURES = [
  { icon: ShieldCheck, title: 'Automated Smart Access Control', desc: 'Motorised leaves with app, RFID and intercom entry, plus a battery fallback so the gate never strands a resident.' },
  { icon: Landmark,    title: 'Custom Steel & Concrete Archway Aesthetics', desc: 'Fabricated in-house — board-formed concrete piers, powder-coated steel spans and stone cladding matched to the facade.' },
  { icon: Lightbulb,   title: 'Integrated Facade Ambient Lighting', desc: 'Recessed grazers and step-lit approaches wired into the estate circuit, tuned warm so the entrance reads at dusk.' },
];

export default function AlipsonGate() {
  return (
    <section id="gateway" className="section">
      <div className="container">
        <div className="section-head section-head--center">
          <Reveal><span className="eyebrow eyebrow--center">The Alipson Gate</span></Reveal>
          <RevealText
            className="title"
            lines={[<>The Gateway to Luxury Living</>, <><em>Signature Entry Architecture</em></>]}
          />
        </div>

        <Reveal dir="scale">
          <figure className="gate__visual">
            <img
              src={media('gateway')}
              alt="An Alipson entrance — lit portico, stone piers and step-lit approach at dusk"
              loading="lazy"
            />
            <figcaption className="gate__caption">
              <b>Signature Entrance</b>
              <span>Stone piers · lit portico · step-lit approach</span>
            </figcaption>
          </figure>
        </Reveal>

        <Stagger className="gate__features">
          {FEATURES.map((f) => (
            <motion.article className="gate__card" key={f.title} variants={staggerItem}>
              <span className="gate__card-ic"><f.icon size={20} /></span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </motion.article>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

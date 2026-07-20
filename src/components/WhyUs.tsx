import { motion } from 'framer-motion';
import RevealText from './ui/RevealText';
import Reveal, { Stagger, staggerItem } from './ui/Reveal';
import { WHY } from '../data/site';

export default function WhyUs() {
  return (
    <section id="why" className="section">
      <div className="container">
        <div className="section-head section-head--center">
          <Reveal><span className="eyebrow eyebrow--center">Why Alipson</span></Reveal>
          <RevealText className="title" as="h2" lines={[<>Reasons this becomes</>, <>your <em>final</em> decision.</>]} />
        </div>
        <Stagger className="bento" gap={0.08}>
          {WHY.map((b) => (
            <motion.div key={b.title} className={`bento__cell ${b.span}`} variants={staggerItem}>
              <div className="bento__glow" />
              <div className="bento__icon"><b.icon size={22} /></div>
              <h3>{b.title}</h3>
              <p>{b.desc}</p>
            </motion.div>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

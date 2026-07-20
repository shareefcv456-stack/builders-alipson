import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import RevealText from './ui/RevealText';
import Reveal, { Stagger, staggerItem } from './ui/Reveal';
import { SERVICES, type Service } from '../data/site';
import { scrollToId } from '../hooks/useLenis';

function Card({ service }: { service: Service }) {
  const Icon = service.icon;
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <motion.article className="svc cursor-target" variants={staggerItem} onMouseMove={onMove}>
      <span className="svc__num">{service.num}</span>
      <div className="svc__icon"><Icon size={22} /></div>
      <h3 className="svc__title">{service.title}</h3>
      <p className="svc__desc">{service.desc}</p>
    </motion.article>
  );
}

export default function Services() {
  return (
    <section id="services" className="section">
      <div className="container">
        <div className="section-head">
          <Reveal><span className="eyebrow">Capabilities</span></Reveal>
          <RevealText className="title" lines={[<>Every discipline,</>, <>under <em>one roof.</em></>]} />
        </div>
        <Stagger className="services__grid">
          {SERVICES.map((s) => (
            <Card key={s.num} service={s} />
          ))}
        </Stagger>
        <Reveal delay={0.1}>
          <div style={{ marginTop: '2.5rem' }}>
            <button className="ul-link" onClick={() => scrollToId('contact')}>
              Discuss your requirement <ArrowUpRight size={15} />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

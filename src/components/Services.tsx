import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import RevealText from './ui/RevealText';
import Reveal, { Stagger, staggerItem } from './ui/Reveal';
import AmbientCanvas from './AmbientCanvas';
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
    <motion.article className="svc cursor-target bg-[#FAF9F6] text-[#111827] rounded-xl p-6 shadow-xl border border-gray-100" variants={staggerItem} onMouseMove={onMove}>
      <span className="svc__num text-gray-400">{service.num}</span>
      <div className="svc__icon text-[#C8102E]"><Icon size={22} /></div>
      <h3 className="svc__title font-bold text-xl mb-2">{service.title}</h3>
      <p className="svc__desc !text-gray-700">{service.desc}</p>
    </motion.article>
  );
}

export default function Services() {
  return (
    <section id="services" className="section">
      <div className="absolute inset-0 bg-[#0D1117] z-0" aria-hidden />
      <AmbientCanvas variant="assembly" className="z-10" />
      <div className="container relative z-20">
        <div className="section-head">
          <Reveal><span className="eyebrow !text-[#C8102E]">Capabilities</span></Reveal>
          <RevealText className="title text-white" lines={[<>Every discipline,</>, <>under <em className="!text-[#C8102E]">one roof.</em></>]} />
        </div>
        <Stagger className="services__grid">
          {SERVICES.map((s) => (
            <Card key={s.num} service={s} />
          ))}
        </Stagger>
        <Reveal delay={0.1}>
          <div style={{ marginTop: '2.5rem' }}>
            <button className="ul-link text-white" onClick={() => scrollToId('contact')}>
              Discuss your requirement <ArrowUpRight size={15} />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

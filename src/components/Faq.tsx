import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import RevealText from './ui/RevealText';
import Reveal from './ui/Reveal';
import { FAQS } from '../data/site';

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="journal" className="section">
      <div className="container">
        <div className="section-head section-head--center">
          <Reveal><span className="eyebrow eyebrow--center">Answers</span></Reveal>
          <RevealText className="title" lines={[<>Frequently asked</>, <><em>questions.</em></>]} />
        </div>
        <div className="faq">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div className={`faq__item ${isOpen ? 'open' : ''}`} key={i}>
                <button className="faq__q" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
                  {f.q}
                  <span className="faq__ic"><Plus size={16} /></span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      className="faq__a"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <p>{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

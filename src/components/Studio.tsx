import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight, Download } from 'lucide-react';
import Reveal from './ui/Reveal';
import RevealText from './ui/RevealText';
import Magnetic from './ui/Magnetic';
import AmbientCanvas from './AmbientCanvas';
import { HIGHLIGHTS } from '../data/site';
import { MEDIA } from '../lib/media';
import { useUI } from '../context/UIContext';

export default function Studio() {
  const visualRef = useRef<HTMLDivElement>(null);
  const { openQuote, openBrochure } = useUI();
  const { scrollYProgress } = useScroll({ target: visualRef, offset: ['start end', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], ['-8%', '8%']);

  return (
    <section id="studio" className="section bg-alt grain">
      <AmbientCanvas variant="blueprint" className="z-10" />
      <div className="container studio__grid relative z-20">
        <div className="studio__visual" ref={visualRef}>
          <Reveal dir="scale">
            <div className="studio__frame rounded-2xl overflow-hidden shadow-2xl" style={{ overflow: 'hidden' }}>
              <motion.img
                src={MEDIA.studio}
                alt="An Alipson architect drafting a building elevation at the studio desk"
                style={{ y: imgY, scale: 1.12 }}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </div>
          </Reveal>
          <Reveal dir="up" delay={0.2}>
            <div className="studio__badge glass !text-[#1A1D20] bg-[#FFFFFF]/90 backdrop-blur-md">
              <b className="text-[#C8102E]">15+</b>
              <span>Years of<br />Excellence</span>
            </div>
          </Reveal>
        </div>

        <div className="studio__details bg-[#FFFFFF] text-[#1A1D20] rounded-2xl p-6 sm:p-10 shadow-2xl">
          <Reveal><span className="eyebrow !text-[#C8102E]">The Studio</span></Reveal>
          <RevealText
            className="title !text-[#1A1D20]"
            lines={[<>Architecture with</>, <>a sense of <em className="!text-[#C8102E]">permanence.</em></>]}
          />
          <Reveal delay={0.1}>
            <p className="studio__quote !text-gray-800 text-lg sm:text-xl font-medium my-6 border-l-4 border-[#C8102E] pl-6">
              "We believe architecture has the power to inspire, shape cultures and{' '}
              <span className="text-[#C8102E]">build lasting legacies.</span>"
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="studio__body !text-gray-700 leading-relaxed text-base sm:text-lg">
              For over fifteen years, Alipson Builders has turned bold visions into
              enduring landmarks. We are architects, structural engineers and luxury
              homebuilders devoted to premium craftsmanship, absolute transparency and
              design that stands the test of time.
            </p>
          </Reveal>

          <div className="studio__highlights my-8">
            {HIGHLIGHTS.map((h, i) => (
              <Reveal key={h.title} delay={0.1 + i * 0.08}>
                <div className="studio__hl flex gap-4 items-start mb-4">
                  <div className="studio__hl-icon text-[#C8102E] mt-1"><h.icon size={20} /></div>
                  <div>
                    <h4 className="font-bold text-[#1A1D20]">{h.title}</h4>
                    <p className="text-gray-600 text-sm">{h.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.15}>
            <div className="btn-group flex flex-wrap gap-4 mt-8">
              <Magnetic strength={0.25}>
                <button className="btn btn-primary" onClick={openQuote}>
                  Start a Project <ArrowUpRight size={16} />
                </button>
              </Magnetic>
              <button className="btn btn-ghost !text-gray-700 hover:!text-[#1A1D20]" onClick={openBrochure}>
                <Download size={15} /> Brochure
              </button>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

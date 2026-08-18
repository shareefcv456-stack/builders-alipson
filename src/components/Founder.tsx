import { Quote } from 'lucide-react';
import RevealText from './ui/RevealText';
import Reveal from './ui/Reveal';
import AmbientCanvas from './AmbientCanvas';
import { FOUNDER } from '../data/site';
import { media } from '../lib/media';

export default function Founder() {
  return (
    <section id="founder" className="section bg-alt grain">
      <AmbientCanvas variant="dusk" className="z-10" />
      
      <div className="container relative z-20">
        <div className="founder__grid">
          <Reveal>
            <div className="founder__visual bg-[#FFFFFF] text-[#1A1D20] rounded-2xl overflow-hidden shadow-2xl p-4 sm:p-8">
              <div className="founder__frame rounded-xl overflow-hidden mb-8">
                <img src={media('founder')} alt={`${FOUNDER.name} — ${FOUNDER.role}`} loading="lazy" className="w-full h-full object-cover" />
                <div className="founder__caption">
                  <b>{FOUNDER.name}</b>
                  <span>{FOUNDER.role}</span>
                </div>
              </div>
              <div className="founder__values grid grid-cols-2 gap-4">
                {FOUNDER.values.map((v) => (
                  <div className="founder__value bg-white/50 backdrop-blur-md p-4 rounded-xl border border-gray-200" key={v.v}>
                    <b className="block text-xl font-bold mb-1">{v.k}</b>
                    <span className="text-sm font-medium">{v.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="founder__body bg-[#FFFFFF] text-[#1A1D20] rounded-2xl shadow-2xl p-6 sm:p-10 lg:p-12">
            <Reveal><span className="eyebrow">{FOUNDER.eyebrow}</span></Reveal>
            <RevealText className="title founder__title !text-[#1A1D20]" lines={[<>{FOUNDER.title}</>, <em>{FOUNDER.titleEm}</em>]} />

            <Reveal dir="up" delay={0.1}>
              <blockquote className="founder__quote !text-gray-800 border-l-4 border-[#C8102E] pl-6 my-8 font-medium italic text-lg sm:text-xl">
                <Quote size={26} className="founder__quote-mark text-[#C8102E] mb-2" />
                {FOUNDER.quote}
              </blockquote>
            </Reveal>

            {FOUNDER.body.map((p, i) => (
              <Reveal dir="up" delay={0.15 + i * 0.08} key={i}>
                <p className="founder__text !text-gray-700 leading-relaxed text-base sm:text-lg mb-6 last:mb-0">{p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

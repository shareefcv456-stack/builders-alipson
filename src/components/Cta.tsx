import { ArrowUpRight, Download } from 'lucide-react';
import Reveal from './ui/Reveal';
import RevealText from './ui/RevealText';
import Magnetic from './ui/Magnetic';
import { imgProps } from '../lib/media';
import { useUI } from '../context/UIContext';

export default function Cta() {
  const { openQuote, openBrochure } = useUI();
  return (
    <section className="section cta grain">
      <div className="cta__bg">
        <img {...imgProps('heroPoster', '100vw')} alt="" aria-hidden />
      </div>
      <div className="container cta__inner">
        <Reveal><span className="eyebrow eyebrow--center">Start Today</span></Reveal>
        <RevealText
          className="cta__title"
          lines={[<>Ready to build</>, <>something <em>timeless?</em></>]}
        />
        <Reveal delay={0.1}>
          <p className="cta__sub">
            Partner with Kerala's leading design-build studio. Your first consultation
            and detailed estimate are entirely on us.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="btn-group" style={{ justifyContent: 'center' }}>
            <Magnetic strength={0.3}>
              <button className="btn btn-primary" onClick={openQuote}>
                Book Consultation <ArrowUpRight size={16} />
              </button>
            </Magnetic>
            <button className="btn btn-ghost" onClick={openBrochure}>
              <Download size={15} /> Download Brochure
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

import { ArrowUpRight } from 'lucide-react';
import Reveal from './ui/Reveal';
import RevealText from './ui/RevealText';
import { scrollToId } from '../hooks/useLenis';

/* NOTE: these two figures contradict the rest of the site — the stats ribbon
   says "150+ Projects Delivered / 15+ Years", and Studio and Founder both say
   "over fifteen years". Copy below is as requested; align the numbers before
   launch. */
const BADGES = [
  { k: '25+', v: 'Years of Trust' },
  { k: '100+', v: 'Completed Landmarks' },
];

export default function Intro() {
  return (
    <section id="intro" className="section">
      <div className="container intro__grid">
        <div>
          <Reveal><span className="eyebrow">Our Standard</span></Reveal>
          <RevealText
            className="title intro__title"
            lines={[<>Engineering Architectural</>, <>Landmarks with <em>Precision</em></>, <>&amp; <em>Integrity.</em></>]}
          />
          <Reveal delay={0.12}>
            <ul className="intro__badges">
              {BADGES.map((b) => (
                <li className="intro__badge" key={b.k}>
                  <b>{b.k}</b>
                  <span>{b.v}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal dir="up" delay={0.18}>
          <div className="intro__copy">
            <p>
              Every Alipson project is held to one standard: structure that outlives
              the fashion around it. We control quality at source — verified materials,
              third-party tested concrete and load paths engineered with margin, not
              to the minimum. Costs are open-book from day one and the handover date
              you are given is the date you get the keys.
            </p>
            <button className="ul-link intro__link" onClick={() => scrollToId('founder')}>
              Discover Our Legacy <ArrowUpRight size={15} />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

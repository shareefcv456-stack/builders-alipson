import { Star, Play } from 'lucide-react';
import RevealText from './ui/RevealText';
import Reveal from './ui/Reveal';
import { TESTIMONIALS, type Testimonial } from '../data/site';
import { media, type MediaKey } from '../lib/media';
import { useUI } from '../context/UIContext';

/* One per testimonial, index-aligned — keep this at least as long as
   TESTIMONIALS or thumbs repeat. Quotes about a DELIVERED home get the
   completed-project photos; quotes about the build process get site photos.
   (`interior`/`heights`/`residency` are all mid-construction shots — showing
   rubble under "our interior detailing is premium" is why they are gone.) */
const THUMBS: MediaKey[] = [
  'villa',          // Anand — "site updates were phenomenal" → an active site fits
  'team',           // Shreya — premium interior → completed, landscaped project
  'stageDelivered', // Rahul & Anjali — luxury villa handover → finished, lit at dusk
  'hub',            // K. M. Mathew — commercial
  'riverside',      // Fathima — apartment, soil test to handover
];

function TCard({ t, thumb }: { t: Testimonial; thumb: MediaKey }) {
  const { openVideo } = useUI();
  return (
    <article className="tcard">
      <button className="tcard__thumb" onClick={openVideo} aria-label={`Watch ${t.name}'s story`}>
        <img src={media(thumb)} alt="" loading="lazy" />
        <span className="tcard__play"><Play size={16} fill="currentColor" /></span>
        <span className="tcard__thumb-lbl">Watch their story</span>
      </button>
      <div className="tcard__stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={14} fill="currentColor" />
        ))}
      </div>
      <p className="tcard__quote">"{t.quote}"</p>
      <div className="tcard__author">
        <div className="tcard__avatar">{t.initials}</div>
        <div>
          <h4>{t.name}</h4>
          <p>{t.role}</p>
        </div>
      </div>
    </article>
  );
}

export default function Testimonials() {
  const loop = [...TESTIMONIALS, ...TESTIMONIALS];
  return (
    <section id="voices" className="section">
      <div className="container">
        <div className="section-head section-head--center">
          <Reveal><span className="eyebrow eyebrow--center">Client Voices</span></Reveal>
          <RevealText className="title" lines={[<>Trusted by the</>, <>families we <em>build for.</em></>]} />
        </div>
      </div>
      <div className="marquee" style={{ paddingBlock: '0.5rem' }}>
        <div className="marquee__track">
          {loop.map((t, i) => (
            <TCard key={i} t={t} thumb={THUMBS[i % THUMBS.length]} />
          ))}
        </div>
      </div>
    </section>
  );
}

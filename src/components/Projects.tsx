import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, Ruler, ArrowUpRight } from 'lucide-react';
import RevealText from './ui/RevealText';
import Reveal from './ui/Reveal';
import BeforeAfter from './BeforeAfter';
import AmbientCanvas from './AmbientCanvas';
import { PROJECTS, PROJECT_FILTERS, type Project } from '../data/site';
import { imgProps } from '../lib/media';
import { useUI } from '../context/UIContext';

const EASE = [0.16, 1, 0.3, 1] as const;

function Card({ project }: { project: Project }) {
  const { openQuote } = useUI();
  return (
    <motion.article
      layout
      className="proj cursor-target rounded-2xl overflow-hidden shadow-xl"
      onClick={openQuote}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.6, ease: EASE }}
      data-cursor="View"
    >
      <div className="proj__img relative">
        {/* No `h-auto` here. That utility carries `!important` and was beating
            `.proj__img img { height: 100% }`, so the photo sat at its own 16:9
            ratio inside a 16:11 frame and left a dead grey band under every
            card — the "empty gaps" in the project grid. */}
        <img {...imgProps(project.image, '(max-width: 800px) 100vw, 560px')} alt={`${project.title} - ${project.category} in ${project.location}`} className="w-full object-cover" />
        <div className="proj__scrim absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
      </div>
      <span className="proj__tag absolute top-4 left-4 bg-black/75 backdrop-blur-md text-white font-semibold text-xs px-3 py-1 rounded-full border border-white/20">{project.category}</span>
      <div className="proj__meta p-6">
        <div className="proj__loc font-medium text-sm mb-3">
          <span><MapPin size={12} /> {project.location}</span>
          <span><Ruler size={12} /> {project.area}</span>
          <span>{project.year}</span>
        </div>
        {/* No `text-2xl`. Like `text-white` and `h-auto` above it, that utility
            carries `!important` and pinned the title to a flat 1.5rem, killing
            the clamp() in `.proj__title` that scales it with the viewport. */}
        <h3 className="proj__title font-bold mb-2">{project.title}</h3>
        <div className="proj__reveal">
          <p>{project.desc}</p>
          <span className="proj__view font-semibold mt-4 inline-flex items-center gap-1">View project <ArrowUpRight size={14} /></span>
        </div>
      </div>
    </motion.article>
  );
}

export default function Projects() {
  const [filter, setFilter] = useState('All');
  const shown = filter === 'All' ? PROJECTS : PROJECTS.filter((p) => p.tags.includes(filter));

  return (
    <section id="work" className="section section--noir grain">
      <AmbientCanvas variant="cranes" className="z-10" />
      <div className="container relative z-20">
        <div className="projects__head">
          <div>
            <Reveal><span className="eyebrow !text-[#d31018]">Selected Work</span></Reveal>
            <RevealText className="title" lines={[<>Landmark</>, <><em className="!text-[#d31018]">masterpieces.</em></>]} />
          </div>
          <Reveal dir="left" delay={0.1}>
            <div className="filters">
              {PROJECT_FILTERS.map((f) => (
                <button
                  key={f}
                  className={`filter ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </Reveal>
        </div>

        <motion.div className="projects__grid" layout>
          <AnimatePresence mode="popLayout">
            {shown.map((p) => (
              <Card key={p.title} project={p} />
            ))}
          </AnimatePresence>
        </motion.div>

        <Reveal dir="up" delay={0.1}>
          <div style={{ marginTop: '2rem' }}>
            <div className="eyebrow" style={{ marginBottom: '1.2rem' }}>Transformation · Drag to compare</div>
            <BeforeAfter
              before="stageStructure"
              after="stageDelivered"
              beforeAlt="Site under active construction — framing and scaffolding"
              afterAlt="The same project, fully delivered"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

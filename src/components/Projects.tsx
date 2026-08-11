import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, Ruler, ArrowUpRight } from 'lucide-react';
import RevealText from './ui/RevealText';
import Reveal from './ui/Reveal';
import BeforeAfter from './BeforeAfter';
import AmbientCanvas from './AmbientCanvas';
import { PROJECTS, PROJECT_FILTERS, type Project } from '../data/site';
import { media } from '../lib/media';
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
        <img src={media(project.image)} alt={`${project.title} - ${project.category} in ${project.location}`} loading="lazy" className="w-full h-auto object-cover" />
        <div className="proj__scrim absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
      </div>
      <span className="proj__tag absolute top-4 left-4 bg-black/75 backdrop-blur-md text-white font-semibold text-xs px-3 py-1 rounded-full border border-white/20">{project.category}</span>
      <div className="proj__meta p-6">
        <div className="proj__loc font-medium text-sm mb-3">
          <span><MapPin size={12} /> {project.location}</span>
          <span><Ruler size={12} /> {project.area}</span>
          <span>{project.year}</span>
        </div>
        <h3 className="proj__title font-bold text-2xl mb-2">{project.title}</h3>
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
    <section id="work" className="section bg-alt grain">
      <div className="absolute inset-0 bg-[#0D1117] z-0" aria-hidden />
      <AmbientCanvas variant="cranes" className="z-10" />
      <div className="container relative z-20">
        <div className="projects__head">
          <div>
            <Reveal><span className="eyebrow !text-[#C8102E]">Selected Work</span></Reveal>
            <RevealText className="title text-white" lines={[<>Landmark</>, <><em className="!text-[#C8102E]">masterpieces.</em></>]} />
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
            <BeforeAfter before="heroPoster" after="villa" beforeAlt="Site at foundation stage" afterAlt="Completed villa" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

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
      className="proj cursor-target"
      onClick={openQuote}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.6, ease: EASE }}
      data-cursor="View"
    >
      <div className="proj__img">
        <img src={media(project.image)} alt={project.title} loading="lazy" />
        <div className="proj__scrim" />
      </div>
      <span className="proj__tag glass">{project.category}</span>
      <div className="proj__meta">
        <div className="proj__loc">
          <span><MapPin size={12} /> {project.location}</span>
          <span><Ruler size={12} /> {project.area}</span>
          <span>{project.year}</span>
        </div>
        <h3 className="proj__title">{project.title}</h3>
        <div className="proj__reveal">
          <p>{project.desc}</p>
          <span className="proj__view">View project <ArrowUpRight size={14} /></span>
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
      <AmbientCanvas variant="cranes" />
      <div className="container">
        <div className="projects__head">
          <div>
            <Reveal><span className="eyebrow">Selected Work</span></Reveal>
            <RevealText className="title" lines={[<>Landmark</>, <><em>masterpieces.</em></>]} />
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

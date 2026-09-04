import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, Ruler, ArrowUpRight, Calendar, Tag } from 'lucide-react';
import RevealText from './ui/RevealText';
import Reveal from './ui/Reveal';
import Modal from './ui/Modal';
import BeforeAfter from './BeforeAfter';
import AmbientCanvas from './AmbientCanvas';
import { PROJECTS, PROJECT_FILTERS, type Project } from '../data/site';
import { imgProps } from '../lib/media';
import { useUI } from '../context/UIContext';

const EASE = [0.16, 1, 0.3, 1] as const;

/* The project the drag-to-compare frames actually show: the glass-facade
   commercial landmark. Looked up rather than hard-coded so the caption stays
   in step with the project data. */
const TRANSFORMATION = PROJECTS.find((p) => p.title === 'Alipson Business Hub');

/* The card face carries a location and a name and nothing else on a phone.
   Everything it used to stack on top of the photograph — category, area, year,
   the description — lives in here, one tap away. On desktop this is a centred
   dialog; on a phone `.modal--sheet` docks it to the bottom edge as a drawer. */
function ProjectSheet({ open, project, onClose }: {
  open: boolean; project: Project | null; onClose: () => void;
}) {
  const { openQuote } = useUI();
  return (
    <Modal open={open} onClose={onClose} className="modal--sheet">
      {project && (
        <div className="psheet">
          <img {...imgProps(project.image, '(max-width: 800px) 100vw, 520px')} alt="" className="psheet__img" />
          <span className="psheet__cat">{project.category}</span>
          <h3 className="psheet__title">{project.title}</h3>
          <dl className="psheet__specs">
            <div><dt><MapPin size={14} /> Location</dt><dd>{project.location}</dd></div>
            <div><dt><Ruler size={14} /> Built-up area</dt><dd>{project.area}</dd></div>
            <div><dt><Calendar size={14} /> Completion</dt><dd>{project.year}</dd></div>
            <div><dt><Tag size={14} /> Category</dt><dd>{project.category}</dd></div>
          </dl>
          <p className="psheet__desc">{project.desc}</p>
          <button className="btn btn-primary psheet__cta" onClick={() => { onClose(); openQuote(); }}>
            Enquire about this project <ArrowUpRight size={16} />
          </button>
        </div>
      )}
    </Modal>
  );
}

function Card({ project, onOpen }: { project: Project; onOpen: () => void }) {
  return (
    <motion.article
      layout
      className="proj cursor-target rounded-2xl overflow-hidden shadow-xl"
      onClick={onOpen}
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
        {/* Named, not `:nth-child`. The phone face keeps ONLY the place and
            drops area and year into the sheet, and a positional selector for
            that would silently target the wrong span the day this row changes. */}
        <div className="proj__loc font-medium text-sm mb-3">
          <span className="proj__place"><MapPin size={12} /> {project.location}</span>
          <span className="proj__area"><Ruler size={12} /> {project.area}</span>
          <span className="proj__year">{project.year}</span>
        </div>
        {/* No `text-2xl`. Like `text-white` and `h-auto` above it, that utility
            carries `!important` and pinned the title to a flat 1.5rem, killing
            the clamp() in `.proj__title` that scales it with the viewport. */}
        <h3 className="proj__title font-bold mb-2">{project.title}</h3>
        <div className="proj__reveal">
          <p>{project.desc}</p>
          {/* A <button>, not the <span> this was: it is the card's stated
              affordance, so it has to be focusable and announce itself. The
              click is the card's own handler either way — `stopPropagation`
              only keeps the card from firing it twice. */}
          <button
            type="button"
            className="proj__view font-semibold mt-4 inline-flex items-center gap-1"
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
          >
            View project <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
    </motion.article>
  );
}

export default function Projects() {
  const [filter, setFilter] = useState('All');
  /* TWO pieces of state, deliberately. `open` drives the modal; `detail` holds
     the LAST opened project and is never cleared. Closing on `setDetail(null)`
     alone would blank the panel's contents on the first frame of the exit
     animation, so the sheet would collapse to an empty box on its way out. */
  const [detail, setDetail] = useState<Project | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openDetail = (p: Project) => { setDetail(p); setSheetOpen(true); };
  const shown = filter === 'All' ? PROJECTS : PROJECTS.filter((p) => p.tags.includes(filter));

  return (
    /* THE SHEET IS A SIBLING OF THE SECTION, NOT A CHILD. `.section` carries
       `isolation: isolate`, which opens a stacking context — and inside one,
       the modal's `z-index: 1000` is only ever compared against its siblings in
       that section. The fixed navbar (z-800) and the floating action buttons
       (z-940) live outside it and so painted straight over the open sheet.
       Hoisting it out of the section puts it back on the page's own stacking
       order, where 1000 means what it says. */
    <>
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
              <Card key={p.title} project={p} onOpen={() => openDetail(p)} />
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Metadata comes off the project record rather than being retyped here,
            so the name, town and year cannot drift from the card above. */}
        <Reveal dir="up" delay={0.1}>
          <div style={{ marginTop: '2rem' }}>
            <BeforeAfter
              before="stageStructure"
              after="stageDelivered"
              beforeAlt="The same building as an RCC frame — columns, beams and slabs cast, tower crane still standing"
              afterAlt="The same building delivered — glazed, lit and landscaped at blue hour"
              project={TRANSFORMATION?.title}
              location={TRANSFORMATION?.location}
              year={TRANSFORMATION?.year}
            />
          </div>
        </Reveal>
      </div>
    </section>
    <ProjectSheet open={sheetOpen} project={detail} onClose={() => setSheetOpen(false)} />
    </>
  );
}

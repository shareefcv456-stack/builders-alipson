import { useEffect, useRef, useState } from 'react';
import { useScroll, useMotionValueEvent } from 'framer-motion';
import { MapPin, Ruler, ArrowUpRight, Calendar, Tag } from 'lucide-react';
import RevealText from './ui/RevealText';
import Reveal from './ui/Reveal';
import Modal from './ui/Modal';
import BeforeAfter from './BeforeAfter';
import AmbientCanvas from './AmbientCanvas';
import { PROJECTS, PROJECT_FILTERS, type Project } from '../data/site';
import { imgProps } from '../lib/media';
import { useUI } from '../context/UIContext';

/* The project the drag-to-compare frames actually show: the glass-facade
   commercial landmark. Looked up rather than hard-coded so the caption stays
   in step with the project data. */
const TRANSFORMATION = PROJECTS.find((p) => p.title === 'Alipson Business Hub');

const pad = (n: number) => String(n).padStart(2, '0');

/* Everything the panel already shows plus the full description, one tap away.
   On desktop this is a centred dialog; on a phone `.modal--sheet` docks it to
   the bottom edge as a drawer. */
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

  /* WHICH PROJECT IS ON SCREEN IS A FUNCTION OF SCROLL POSITION, and that is
     the only thing scroll drives here — an index, not a transform. The track is
     `shown.length` screens of scroll; progress 0 is the first project and 1 is
     the last, so the run is divided into equal dwells and `round` hands over at
     the midpoint of each. Everything else (the clip, the fade, the copy lift)
     is a plain CSS transition off the resulting `.is-on` class, so there is no
     per-frame work and no half-transitioned states to reason about. */
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    setActive(Math.min(shown.length - 1, Math.max(0, Math.round(p * (shown.length - 1)))));
  });
  /* A filter change rewrites the list under the index — without this, picking
     "Commercial Buildings" while sitting on project 05 leaves the showcase
     pointing past the end of a two-item list. */
  useEffect(() => { setActive(0); }, [filter]);

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

        {/* ONE PROJECT AT A TIME. The panels share a single sticky frame and
            only the active one is painted — the rest are `visibility: hidden`,
            so they are out of the picture and out of the a11y tree rather than
            stacked behind it. `--n` is what makes the track tall enough to give
            every project its own dwell, and it comes off the FILTERED list so a
            two-project filter is two screens of scroll, not six. */}
        <div className="pshow" ref={track} style={{ '--n': shown.length } as React.CSSProperties}>
          <div className="pshow__vp">
            {shown.map((p, i) => (
              <article key={p.title} className={`pshow__panel${i === active ? ' is-on' : ''}`}>
                <div className="pshow__idx">
                  <span><b>{pad(i + 1)}</b> / {pad(shown.length)}</span>
                  <i />
                </div>
                <div
                  className="pshow__frame cursor-target"
                  onClick={() => openDetail(p)}
                  data-cursor="View"
                >
                  <img
                    {...imgProps(p.image, '(max-width: 900px) 100vw, 720px')}
                    alt={`${p.title} — ${p.category} in ${p.location}`}
                  />
                </div>
                <div className="pshow__body">
                  <span className="pshow__cat">{p.category}</span>
                  <h3 className="pshow__title">{p.title}</h3>
                  <dl className="pshow__specs">
                    <div><dt><MapPin size={12} /> Location</dt><dd>{p.location}</dd></div>
                    <div><dt><Ruler size={12} /> Area</dt><dd>{p.area}</dd></div>
                    <div><dt><Calendar size={12} /> Year</dt><dd>{p.year}</dd></div>
                  </dl>
                  <p className="pshow__desc">{p.desc}</p>
                  {/* A <button>, not the <span> this was: it is the panel's
                      stated affordance, so it has to be focusable and announce
                      itself. The frame above opens the same sheet on click. */}
                  <button type="button" className="pshow__view" onClick={() => openDetail(p)}>
                    View case study <ArrowUpRight size={14} />
                  </button>
                </div>
              </article>
            ))}
            {/* Decorative: the count is already spelled out as "01 / 06" on the
                panel itself, so this is a second rendering of the same fact. */}
            <div className="pshow__rail" aria-hidden="true">
              {shown.map((p, i) => (
                <span key={p.title} className={`pshow__dot${i === active ? ' is-on' : ''}`} />
              ))}
            </div>
          </div>
        </div>

        {/* Metadata comes off the project record rather than being retyped here,
            so the name, town and year cannot drift from the panel above. */}
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

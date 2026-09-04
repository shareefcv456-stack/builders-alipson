import { motion } from 'framer-motion';
import { STATS, type Stat } from '../data/site';
import { useCountUp } from '../hooks/useCountUp';
import { isCapture } from '../lib/capture';

/* Slide-up + fade, staggered per card. Written inline rather than reusing
   ui/Reveal's Stagger because these cards live inside the pinned hero, which is
   already translating — an extra wrapper element there fights the transform the
   stats bar itself is under. */
const EASE = [0.16, 1, 0.3, 1] as const;
const item = {
  hidden: { opacity: 0, y: 26 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay: i * 0.09, ease: EASE },
  }),
};

function Cell({ stat, index }: { stat: Stat; index: number }) {
  const { value, ref } = useCountUp(stat.value);
  const Icon = stat.icon;
  return (
    <motion.div
      className="ribbon__cell"
      custom={index}
      variants={item}
      initial={isCapture() ? 'show' : 'hidden'}
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
      /* The lift lives here, not in CSS. framer-motion writes an inline
         `transform` when the in-view animation settles, and an inline transform
         beats a `:hover` rule in the cascade — the CSS lift silently did
         nothing. whileHover composes with the entrance animation instead of
         fighting it. */
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
    >
      {/* Two inner layers, not styling for its own sake: `-edge` is the 1px
          crimson bevel (clip-path clips `border` away, so the edge has to be a
          layer) and `-face` carries the glass. See the CSS block for why the
          glow cannot live on either of them. */}
      <div className="ribbon__cell-edge">
        <div className="ribbon__cell-face">
          {/* Decorative: the label already says what the figure is, so an
              accessible name here would only make a screen reader read each
              card twice. */}
          <span className="ribbon__icon" aria-hidden>
            <Icon size={17} strokeWidth={1.75} />
          </span>
          <div className="ribbon__num">
            {/* Count-up runs off this span's own IntersectionObserver, so it
                starts when the card is on screen — not when the pinned hero
                mounts, which is long before anyone can see it. */}
            <span ref={ref}>{value.toLocaleString()}</span>
            <em>{stat.suffix}</em>
          </div>
          <div className="ribbon__label">{stat.label}</div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Ribbon() {
  return (
    <section className="ribbon">
      <div className="ribbon__grid container">
        {STATS.map((s, i) => (
          <Cell key={s.label} stat={s} index={i} />
        ))}
      </div>
    </section>
  );
}

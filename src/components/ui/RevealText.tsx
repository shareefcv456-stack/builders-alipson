import { Fragment } from 'react';
import { motion, type Variants } from 'framer-motion';
import { isCapture } from '../../lib/capture';

const EASE = [0.16, 1, 0.3, 1] as const;

const lineVariants: Variants = {
  hidden: { y: '110%' },
  show: (i: number) => ({
    y: '0%',
    transition: { duration: 0.9, ease: EASE, delay: 0.05 * i },
  }),
};

/**
 * Split-text headline. Each line is passed as a string in `lines` and masked,
 * rising into place on scroll. Renders semantic heading content.
 */
export default function RevealText({
  lines,
  className,
  as = 'h2',
  delay = 0,
}: {
  lines: (string | React.ReactNode)[];
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
  delay?: number;
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={isCapture() ? 'show' : 'hidden'}
      whileInView="show"
      viewport={{ once: true, amount: 0.5 }}
    >
      {lines.map((line, i) => (
        <span className="split-line" key={i}>
          <motion.span
            style={{ display: 'block' }}
            custom={i + delay * 10}
            variants={lineVariants}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Word-by-word fade — good for lede paragraphs. */
export function RevealWords({ text, className }: { text: string; className?: string }) {
  const words = text.split(' ');
  return (
    <motion.p
      className={className}
      initial={isCapture() ? 'show' : 'hidden'}
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
      variants={{ show: { transition: { staggerChildren: 0.018 } } }}
    >
      {words.map((w, i) => (
        <Fragment key={i}>
          <motion.span
            style={{ display: 'inline-block' }}
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
            }}
          >
            {w}
          </motion.span>{' '}
        </Fragment>
      ))}
    </motion.p>
  );
}

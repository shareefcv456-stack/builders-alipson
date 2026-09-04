import { useState } from 'react';
import { MoveHorizontal } from 'lucide-react';
import type { MediaKey } from '../lib/media';
import { imgProps } from '../lib/media';

/**
 * DRAG-TO-COMPARE.
 *
 * THE SLIDER IS A NATIVE `<input type="range">` STRETCHED OVER THE FRAME AT
 * ZERO OPACITY, and it stays that way deliberately. It is the reason this
 * component has no pointer handlers, no drag state, no `setPointerCapture`, no
 * touch-action juggling and no listeners to tear down: mouse drag, touch drag,
 * pen, click-to-jump, keyboard arrows, Home/End, focus ring and the screen
 * reader announcement all come from the platform, already correct on every
 * browser, and already correct on the phone where hand-rolled drag handling
 * usually fights the scroller. Replacing it with custom pointer code would be
 * more work and less accessible.
 *
 * The position is published ONCE, as a `--split` custom property on the frame.
 * The clip on the after-image and the offset of the handle are then both CSS's
 * problem, which is what keeps the two from ever disagreeing by a pixel.
 */
export default function BeforeAfter({
  before,
  after,
  beforeAlt = 'Before construction',
  afterAlt = 'After completion',
  project,
  location,
  year,
}: {
  before: MediaKey;
  after: MediaKey;
  beforeAlt?: string;
  afterAlt?: string;
  /** Optional caption above the frame. All three, or none. */
  project?: string;
  location?: string;
  year?: string;
}) {
  const [split, setSplit] = useState(50);
  return (
    <figure className="ba-block">
      {project && (
        <figcaption className="ba-meta">
          <span className="ba-meta__eyebrow">Project Transformation</span>
          <span className="ba-meta__line">
            <strong>{project}</strong>
            <span className="ba-meta__dot" aria-hidden>·</span>{location}
            <span className="ba-meta__dot" aria-hidden>·</span>Completed {year}
          </span>
        </figcaption>
      )}

      <div className="ba cursor-target" style={{ '--split': `${split}%` } as React.CSSProperties}>
        <img {...imgProps(before, '(max-width: 800px) 100vw, 1100px')} alt={beforeAlt} className="ba__before" />
        <img {...imgProps(after, '(max-width: 800px) 100vw, 1100px')} alt={afterAlt} className="ba__after" />

        {/* The qualifier is its own element so a phone can drop it. At 390px the
            two full labels are wider than the frame and land on top of each
            other in the middle of the slider. */}
        <span className="ba__before-lbl glass">Before<span className="ba__lbl-more"> · Under Construction</span></span>
        <span className="ba__after-lbl glass">After<span className="ba__lbl-more"> · Fully Delivered</span></span>

        <div className="ba__handle" aria-hidden>
          <span className="ba__grip"><MoveHorizontal size={18} /></span>
        </div>

        <input
          className="ba__range"
          type="range"
          min={2}
          max={98}
          value={split}
          aria-label="Drag to compare before and after"
          onChange={(e) => setSplit(Number(e.target.value))}
        />
      </div>
    </figure>
  );
}

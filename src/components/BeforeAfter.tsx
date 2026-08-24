import { useState } from 'react';
import { MoveHorizontal } from 'lucide-react';
import type { MediaKey } from '../lib/media';
import { imgProps } from '../lib/media';

/** Draggable before/after comparison slider. */
export default function BeforeAfter({
  before,
  after,
  beforeAlt = 'Before construction',
  afterAlt = 'After completion',
}: {
  before: MediaKey;
  after: MediaKey;
  beforeAlt?: string;
  afterAlt?: string;
}) {
  const [split, setSplit] = useState(50);
  return (
    <div className="ba cursor-target">
      <img {...imgProps(before, '(max-width: 800px) 100vw, 1100px')} alt={beforeAlt} className="ba__before" />
      <img
        {...imgProps(after, '(max-width: 800px) 100vw, 1100px')}
        alt={afterAlt}
        className="ba__after"
        style={{ clipPath: `inset(0 0 0 ${split}%)` }}
      />
      {/* The qualifier is its own element so a phone can drop it. At 390px the
          two full labels are wider than the frame and land on top of each
          other in the middle of the slider. */}
      <span className="ba__before-lbl glass">Before<span className="ba__lbl-more">: Under Construction</span></span>
      <span className="ba__after-lbl glass">After<span className="ba__lbl-more">: Fully Delivered</span></span>
      <div className="ba__handle" style={{ left: `${split}%` }}>
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
  );
}

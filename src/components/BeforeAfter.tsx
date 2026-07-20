import { useState } from 'react';
import { MoveHorizontal } from 'lucide-react';
import type { MediaKey } from '../lib/media';
import { media } from '../lib/media';

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
      <img src={media(before)} alt={beforeAlt} className="ba__before" loading="lazy" />
      <img
        src={media(after)}
        alt={afterAlt}
        className="ba__after"
        style={{ clipPath: `inset(0 0 0 ${split}%)` }}
        loading="lazy"
      />
      <span className="ba__before-lbl glass">Foundation</span>
      <span className="ba__after-lbl glass">Delivered</span>
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

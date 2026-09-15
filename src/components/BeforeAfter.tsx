import { useCallback, useRef, useState } from 'react';
import { MoveHorizontal } from 'lucide-react';
import type { MediaKey } from '../lib/media';
import { imgProps } from '../lib/media';

/**
 * DRAG-TO-COMPARE.
 *
 * THE FRAME IS THE CONTROL, AND POINTER EVENTS DRIVE IT. One handler path
 * covers mouse, touch and pen, because `pointerdown`/`pointermove`/`pointerup`
 * are the same events for all three — there is no separate touch branch to
 * drift out of step with the mouse one.
 *
 * THIS USED TO BE A BARE `<input type="range">` STRETCHED OVER THE FRAME, and
 * on a desktop that was genuinely the better answer: drag, click-to-jump,
 * arrow keys and the screen-reader announcement all came from the platform for
 * free. On a phone it did not work, for two measured reasons:
 *
 *  1. THE GRIP AND THE THUMB WERE NOT IN THE SAME PLACE. A range with
 *     `appearance: none` insets its thumb by half the thumb width at each end,
 *     so the thumb centre is `28 + frac * (width - 56)` while the grip sits at
 *     `frac * width`. They agree at exactly 50% and nowhere else — measured
 *     10px apart at 25%, 17px at 90%, 20px at the ends. iOS Safari only starts
 *     a range drag when the touch lands ON the thumb, so grabbing the handle
 *     the user can actually see missed it everywhere except dead centre.
 *  2. `touch-action` WAS `auto`. That lets the compositor decide a horizontal
 *     drag might be a scroll and claim the gesture before the renderer ever
 *     sees a move. `pan-y` below is the fix: vertical scrolling still works if
 *     a finger happens to land on the frame, horizontal never leaves us.
 *
 * Computing the split from the frame's own geometry removes (1) by
 * construction — the number the grip is drawn at is the number the pointer
 * produced, so they cannot disagree by a pixel at any value.
 *
 * THE RANGE INPUT STAYS, for the keyboard and the screen reader: arrows,
 * Home/End, the focus ring and the announced value are still the platform's.
 * It is `pointer-events: none` in the stylesheet so it can no longer contest
 * the gesture, and a pointerdown focuses it so the arrows work straight after
 * a drag.
 *
 * The position is published ONCE, as a `--split` custom property on the frame.
 * The clip on the after-image and the offset of the handle are then both CSS's
 * problem, which is what keeps the two from ever disagreeing by a pixel.
 */

/** Matches the range's own bounds, so dragging and the arrow keys cannot reach
 *  different extremes — at 0 or 100 one image would be gone entirely. */
const MIN = 2;
const MAX = 98;

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
  /* DURING A DRAG THE SPLIT BYPASSES REACT. A setState per pointermove was a
     re-render per move; the value is one CSS property, so it is written straight
     onto the frame and handed back to state once, on release, for the range
     input's announced value. React's style diff compares props, not the DOM,
     so the renders in between (dragging on/off) never overwrite it. */
  const live = useRef(50);
  const [dragging, setDragging] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);
  /* MEASURED ONCE PER DRAG, not per move. The frame cannot change width
     mid-gesture, and `touch-action: pan-y` means the only scrolling possible
     while dragging is vertical — which moves `top`, and nothing here reads it.
     So this is a layout read on pointerdown and none at all during the drag,
     which is what keeps a finger-tracking handler off the layout path. */
  const box = useRef<{ left: number; width: number } | null>(null);

  const applyX = useCallback((clientX: number) => {
    const b = box.current;
    if (!b || b.width === 0) return;
    const pct = ((clientX - b.left) / b.width) * 100;
    live.current = pct < MIN ? MIN : pct > MAX ? MAX : pct;
    frame.current?.style.setProperty('--split', `${live.current}%`);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Secondary mouse buttons are not a drag; let the browser have them.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = frame.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    box.current = { left: r.left, width: r.width };
    /* CAPTURE IS WHAT MAKES IT 1:1. Without it the pointer stops reporting the
       moment it leaves the frame — drag past the edge and the handle sticks
       mid-travel until you come back. With it, every move is delivered here
       until release, so the divider tracks the finger across the whole screen
       and still lands exactly where it is let go. */
    el.setPointerCapture(e.pointerId);
    setDragging(true);
    applyX(e.clientX);          // click / tap-to-jump, same as the range gave
    // The input is pointer-events:none, so focus it by hand — that is what
    // keeps the arrow keys working straight after a pointer drag.
    range.current?.focus({ preventScroll: true });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    applyX(e.clientX);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    setSplit(live.current);
    box.current = null;
    const el = frame.current;
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  };

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

      <div
        ref={frame}
        className={`ba cursor-target${dragging ? ' is-dragging' : ''}`}
        style={{ '--split': `${split}%` } as React.CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        /* `pointercancel` is not an edge case on a phone: the browser fires it
           whenever it takes the gesture back (an incoming call, a system edge
           swipe). Without it `dragging` stays true and the grip sits scaled-up
           and "held" with nothing touching it. */
        onPointerCancel={endDrag}
      >
        {/* `draggable={false}`: with the range no longer covering the frame, a
            mouse-down now lands on the photograph, and the browser's native
            image drag would hijack the gesture and show a ghost image. */}
        <img {...imgProps(before, '(max-width: 800px) calc(100vw - 32px), min(92vw, 1140px)')} alt={beforeAlt} className="ba__before" draggable={false} />
        <img {...imgProps(after, '(max-width: 800px) calc(100vw - 32px), min(92vw, 1140px)')} alt={afterAlt} className="ba__after" draggable={false} />

        {/* The qualifier is its own element so a phone can drop it. At 390px the
            two full labels are wider than the frame and land on top of each
            other in the middle of the slider. */}
        <span className="ba__before-lbl glass">Before<span className="ba__lbl-more"> · Under Construction</span></span>
        <span className="ba__after-lbl glass">After<span className="ba__lbl-more"> · Fully Delivered</span></span>

        <div className="ba__handle" aria-hidden>
          <span className="ba__grip"><MoveHorizontal size={18} /></span>
        </div>

        <input
          ref={range}
          className="ba__range"
          type="range"
          min={MIN}
          max={MAX}
          value={Math.round(split)}
          aria-label="Drag to compare before and after"
          onChange={(e) => { live.current = Number(e.target.value); setSplit(live.current); }}
        />
      </div>
    </figure>
  );
}

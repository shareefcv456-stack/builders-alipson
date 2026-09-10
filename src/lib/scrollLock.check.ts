/**
 * OPENING AND CLOSING A MODAL A HUNDRED TIMES MUST LEAVE THE PAGE SCROLLABLE.
 *
 * The bug this guards is the one that made the lock worth rewriting: a
 * mismatched pair leaves the document stuck at `overflow: hidden` (page dead)
 * or unlocks it while a second overlay is still open (background glides behind
 * it). Both are pure refcount arithmetic over the real module — no renderer,
 * no browser, just a stub document and the same code the modals import.
 */
import assert from 'node:assert/strict';
import { lockScroll, unlockScroll, __resetScrollLock } from './scrollLock.js';

type Lenis = { stopped: boolean; stops: number; starts: number; stop(): void; start(): void };

/* `withLenis: false` is the PHONE, where hooks/useLenis deliberately never
   constructs one — the branch that has to pin the body instead. */
const stub = ({ withLenis = true } = {}) => {
  const lenis: Lenis = { stopped: false, stops: 0, starts: 0, stop() { this.stopped = true; this.stops++; }, start() { this.stopped = false; this.starts++; } };
  const body = { style: { position: '', top: '', left: '', right: '' } };
  const doc = { documentElement: { style: { overflow: '' } }, body };
  const win = { scrollY: 0, lenis: withLenis ? lenis : undefined, scrollTo: (_x: number, y: number) => { win.scrollY = y; } };
  (globalThis as Record<string, unknown>).document = doc;
  (globalThis as Record<string, unknown>).window = win;
  __resetScrollLock();
  return { doc, win, lenis, body };
};
const locked = (d: { documentElement: { style: { overflow: string } } }) => d.documentElement.style.overflow === 'hidden';

/* ---- one modal: lock, unlock, page is exactly as it was ------------------ */
{
  const { doc, win, lenis } = stub();
  win.scrollY = 4200;
  lockScroll();
  assert.ok(locked(doc), 'document not locked on open');
  assert.ok(lenis.stopped, 'Lenis still running — the wheel would scroll the page behind the modal');
  win.scrollY = 0;                       // a browser that clamps while unscrollable
  unlockScroll();
  assert.ok(!locked(doc), 'overflow left on the document after close');
  assert.ok(!lenis.stopped, 'Lenis left stopped — the page would never scroll again');
  assert.equal(win.scrollY, 4200, 'scroll position not restored');
}

/* ---- two overlays: the quote modal opens ON TOP of the project sheet ----- */
{
  const { doc, lenis } = stub();
  lockScroll();                          // sheet
  lockScroll();                          // quote modal over it
  unlockScroll();                        // sheet closes underneath
  assert.ok(locked(doc), 'inner overlay left the page scrollable');
  assert.ok(lenis.stopped, 'Lenis restarted while an overlay was still open');
  unlockScroll();
  assert.ok(!locked(doc), 'page still locked once every overlay closed');
}

/* ---- StrictMode mounts every effect twice (lock, unlock, lock) ----------- */
{
  const { doc } = stub();
  lockScroll(); unlockScroll(); lockScroll();
  assert.ok(locked(doc), 'StrictMode double-invoke lost the lock');
  unlockScroll();
  assert.ok(!locked(doc), 'StrictMode double-invoke left the page locked');
}

/* ---- open/close 100 times, plus a stray unlock, and no drift ------------- */
{
  const { doc, win, lenis } = stub();
  win.scrollY = 900;
  unlockScroll();                        // unbalanced close: must be a no-op
  for (let i = 0; i < 100; i++) { lockScroll(); assert.ok(locked(doc)); unlockScroll(); assert.ok(!locked(doc)); }
  assert.equal(lenis.stops, 100, 'Lenis stop/open pairing drifted');
  assert.equal(lenis.starts, 100, 'Lenis start/close pairing drifted');
  assert.equal(win.scrollY, 900, 'scroll position drifted over repeated opens');
}

/* ---- NO LENIS (a phone): the body is pinned, and released ---------------- */
{
  const { doc, win, body } = stub({ withLenis: false });
  win.scrollY = 2600;
  lockScroll();
  assert.ok(locked(doc), 'document not locked without Lenis');
  assert.equal(body.style.position, 'fixed', 'body not pinned — iOS would drag the page behind the modal');
  assert.equal(body.style.top, '-2600px', 'pinned body did not carry the scroll offset, so the page jumps to the top');
  win.scrollY = 0;                       // what pinning the body actually does
  unlockScroll();
  assert.equal(body.style.position, '', 'body left pinned after close — the page would never scroll again');
  assert.equal(body.style.top, '', 'body offset left behind');
  assert.ok(!locked(doc), 'overflow left on the document after close');
  assert.equal(win.scrollY, 2600, 'scroll position not restored after unpinning');
}

/* ---- and it still balances over repeated opens on that path ------------- */
{
  const { doc, win, body } = stub({ withLenis: false });
  win.scrollY = 512;
  for (let i = 0; i < 50; i++) {
    lockScroll(); lockScroll();          // an overlay opening on top of another
    unlockScroll();
    assert.ok(locked(doc) && body.style.position === 'fixed', 'inner overlay released the page early');
    unlockScroll();
    win.scrollY = 512;
  }
  assert.equal(body.style.position, '', 'body pin drifted over repeated opens');
  assert.equal(win.scrollY, 512, 'scroll position drifted over repeated opens');
}

console.log('scrollLock.check: ok');

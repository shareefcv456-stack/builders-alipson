import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// Lazy load sections CSS to avoid blocking critical path
import './styles/sections.css'
import { watchFrameBudget } from './lib/frameBudget'

const mount = () => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

  /* Drop the static boot gate from index.html once React has painted its own.
     Two frames, not one: the first rAF fires before the commit's pixels are on
     screen, so removing there can flash the empty page between the two gates. */
  requestAnimationFrame(() =>
    requestAnimationFrame(() => document.getElementById('boot')?.remove())
  )

  watchFrameBudget()
}

/* LET THE STATIC GATE PAINT ITS NAME FIRST. The boot gate's text uses an inline
   font subset with `font-display: block`, so it stays invisible until that font
   is decoded — and on a fast load React used to mount and paint its own copy of
   the name before that happened. React's copy then became the Largest
   Contentful Paint, tying LCP to the JavaScript download instead of to the HTML.
   So React mounts once the browser has RECORDED the static name's paint (the
   LCP entry for an element inside #boot); React's identical copy is then not
   "larger" and LCP stays at first paint. Browsers without the LCP API (Safari)
   just wait for the ~2 KB inline font. Capped at 300 ms either way, so nothing
   can hold the app back. */
const bootFont = document.fonts?.load
  ? document.fonts.load("500 1em 'Jakarta Boot'").then(() => undefined, () => undefined)
  : Promise.resolve()
const hasLcp = typeof PerformanceObserver !== 'undefined' &&
  (PerformanceObserver.supportedEntryTypes ?? []).includes('largest-contentful-paint')
const bootPainted = !hasLcp ? bootFont : new Promise<void>((resolve) => {
  const po = new PerformanceObserver((list) => {
    if (list.getEntries().some((e) => (e as PerformanceEntry & { element?: Element | null }).element?.closest('#boot'))) {
      po.disconnect()
      resolve()
    }
  })
  po.observe({ type: 'largest-contentful-paint', buffered: true })
})
Promise.race([bootPainted, new Promise((r) => setTimeout(r, 300))]).then(() =>
  requestAnimationFrame(mount)
)

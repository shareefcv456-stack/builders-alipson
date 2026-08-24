import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// Lazy load sections CSS to avoid blocking critical path
import './styles/sections.css'

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

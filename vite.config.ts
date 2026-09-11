import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// https://vitejs.dev/config/
/**
 * The app stylesheet is render-blocking, and on this page it has nothing to
 * block FOR: the only thing in the document before React mounts is the boot
 * gate, which carries its own inline styles. Loading it at `media="print"` and
 * flipping it on load takes it off the critical path without deferring it —
 * it is still requested immediately, in parallel, and it is 20 KB against
 * ~400 KB of script, so it has always landed long before React can paint.
 *
 * Build only. The dev server serves CSS through the module graph for HMR and
 * there is no <link> in the HTML to rewrite.
 */
const nonBlockingCss = () => ({
  name: 'non-blocking-css',
  apply: 'build' as const,
  enforce: 'post' as const,
  transformIndexHtml(html: string) {
    return html.replace(
      /<link rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/g,
      (_m: string, href: string) =>
        `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'">` +
        `<noscript><link rel="stylesheet" href="${href}"></noscript>`,
    );
  },
});

/**
 * CLIENT ROUTES NEED A FILE AT THEIR URL, or they only work when you arrive by
 * clicking. Typing /projects, refreshing it, or following a shared link asks the
 * host for a path that does not exist and gets a 404 — the classic SPA deploy
 * trap, and it would hit exactly the six URLs this change is about.
 *
 * The usual fix is a host rewrite (`_redirects`, `vercel.json`, `try_files`),
 * but that is a different file per host and this project has no way to know
 * which one it lands on. So instead: write a copy of the built index.html at
 * each route. Any static host serves them with no configuration at all, and it
 * is the SAME approach the site already uses for /privacy and /terms, which are
 * real files under public/. Each copy boots the app, which reads
 * `location.pathname` and renders that route.
 *
 * Derived from ROUTES in src/router.tsx — keep the two in step; a route added
 * there and not here still works when clicked and 404s when refreshed.
 */
const ROUTE_PAGES = ['story', 'projects', 'services', 'founder', 'contact'];

const staticRoutes = () => ({
  name: 'static-routes',
  apply: 'build' as const,
  closeBundle() {
    const out = resolve(__dirname, 'dist');
    const html = readFileSync(resolve(out, 'index.html'), 'utf8');
    for (const r of ROUTE_PAGES) {
      mkdirSync(resolve(out, r), { recursive: true });
      writeFileSync(resolve(out, r, 'index.html'), html);
    }
  },
});

export default defineConfig({
  plugins: [react(), nonBlockingCss(), staticRoutes()],
  build: {
    rollupOptions: {
      output: {
        /* Chunk split by CHANGE RATE, not just by size. Anything in here gets a
           content hash and is cached independently, so editing the hero scene
           does not force a re-download of three.js.

           NOTE: only packages actually installed may be listed. Naming a module
           that is not in the dependency graph (e.g. @react-three/fiber, which
           this project does not use — it is raw three) makes Rollup fail the
           build. The scroll library is `lenis`; `@studio-freight/lenis` is that
           package's former name and is not what is installed. */
        manualChunks: {
          // ~600 KB and effectively frozen — it only changes when three is
          // upgraded, so it deserves its own long-lived cache entry. Reachable
          // ONLY through the dynamic import of HeroSite, so it stays out of
          // the initial payload.
          three: ['three', 'n8ao'],
          /* Split, not merged. Both are eager (gsap pins the hero, framer
             drives the phase copy), but as one 217 KB chunk they were a single
             serial download in front of first paint; as two they come down the
             same connection pool in parallel. */
          gsap: ['gsap'],
          /* framer-motion is NOT forced into one chunk any more, and that is
             the whole point of the LazyMotion wrapper in App: naming it here
             told Rollup to emit every export as a single eager module, so the
             ~100 KB feature bundle `domAnimation` exists to defer came down in
             front of first paint regardless. Left unnamed, Rollup splits it
             along the dynamic import — the `m` primitives stay in the entry,
             the DOM animation features land in their own async chunk. */
          scroll: ['lenis'],
          react: ['react', 'react-dom'],
          /* lucide-react is NOT named here either. Naming it collapsed every
             icon the whole site imports into ONE chunk, and because the navbar
             and the hero import from it, that chunk was eager — so the phone
             downloaded the icons for the FAQ, the process timeline and the
             contact form before it painted the hero. Rollup's default split
             puts each icon in the chunk that actually reaches it, which for the
             below-the-fold sections means their own lazy chunk. */
        },
      },
    },
    /* 1000, per spec. Worth being clear about what this does: it silences a
       warning, it does not make anything smaller. The real win is the split
       above plus the fact that the 3D hero is behind React.lazy — a visitor on
       ?flat never downloads any of it. */
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    cssMinify: 'esbuild',
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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

export default defineConfig({
  plugins: [react(), nonBlockingCss()],
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
          // ONLY through the dynamic import of HeroThree, so it stays out of
          // the initial payload.
          three: ['three', 'n8ao'],
          /* Split, not merged. Both are eager (gsap pins the hero, framer
             drives the phase copy), but as one 217 KB chunk they were a single
             serial download in front of first paint; as two they come down the
             same connection pool in parallel. */
          gsap: ['gsap'],
          motion: ['framer-motion'],
          scroll: ['lenis'],
          react: ['react', 'react-dom'],
          icons: ['lucide-react'],
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

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
          animation: ['gsap', 'framer-motion'],
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

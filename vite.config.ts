import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split animation libraries to reduce critical bundle
          'animation': ['gsap', 'framer-motion'],
          // Split scroll library
          'scroll': ['lenis'],
          // Keep vendor core separate
          'react': ['react', 'react-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
    // Optimize CSS
    cssCodeSplit: true,
    // Minify CSS aggressively
    cssMinify: 'esbuild',
  },
})

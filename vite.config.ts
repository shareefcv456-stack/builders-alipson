import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [
        '.',
        '/Users/muhammedshareefcv/.gemini/antigravity-ide/brain/ba741a77-9329-4e7e-a39a-fa43095822a7'
      ]
    }
  }
})

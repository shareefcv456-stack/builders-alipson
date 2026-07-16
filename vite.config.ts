import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [
        '.',
        '/Users/muhammedshareefcv/.gemini/antigravity-ide/brain/ba741a77-9329-4e7e-a39a-fa43095822a7',
        '/Users/muhammedshareefcv/.gemini/antigravity-ide/brain/d81aacfd-ca94-4147-bd40-c1e593c95da5'
      ]
    }
  }
})

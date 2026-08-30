import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const ttsProxy = {
  '/tts': {
    target: 'http://127.0.0.1:8765',
    rewrite: (path: string) => path.replace(/^\/tts/, '') || '/',
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 47291,
    strictPort: true,
    proxy: ttsProxy,
  },
  preview: {
    host: '127.0.0.1',
    port: 47291,
    strictPort: true,
    proxy: ttsProxy,
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
  },
})

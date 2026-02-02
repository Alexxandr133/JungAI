import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Максимально простой и безопасный конфиг Vite
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  // Чуть более удобный прод‑бандл для отладки:
  // читаемые sourcemaps и отключённую минификацию JS.
  build: {
    sourcemap: true,
    minify: false,
  },
})

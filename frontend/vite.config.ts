import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

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
  resolve: {
    // Критично: гарантируем, что используется одна и та же копия React
    // Это исправляет ошибку "Cannot read properties of null (reading 'useContext')"
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
  // Чуть более удобный прод‑бандл для отладки:
  // читаемые sourcemaps и отключённую минификацию JS.
  build: {
    sourcemap: true,
    minify: false,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    force: true, // Пересобрать зависимости при следующем запуске
  },
})

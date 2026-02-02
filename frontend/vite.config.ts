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
    // Критично: гарантируем, что в бандле только одна копия React
    // Это исправляет ошибку "Cannot read properties of null (reading 'useContext')"
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

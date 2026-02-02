import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Критично: заставляем Vite всегда использовать ОДНУ копию React/ReactDOM/Router
    // из корневого node_modules монорепы, чтобы не было "Invalid hook call".
    alias: {
      react: path.resolve(__dirname, '../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../node_modules/react-dom'),
      'react-router': path.resolve(__dirname, '../node_modules/react-router'),
      'react-router-dom': path.resolve(__dirname, '../node_modules/react-router-dom'),
    },
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  // Оставим только немного более удобный прод‑бандл для отладки:
  // читаемые sourcemaps и отключённую минификацию JS.
  build: {
    sourcemap: true,
    minify: false,
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Гарантируем одну копию React (через корневой node_modules) и дедупликацию,
    // но не ломаем под-импорты вроде "react-dom/client".
    alias: {
      react: path.resolve(__dirname, '../node_modules/react'),
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

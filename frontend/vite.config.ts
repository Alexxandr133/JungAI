import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
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
  // ВРЕМЕННО: заставляем React собраться в dev-режиме даже для прод-бандла,
  // чтобы вместо "Minified React error #130" увидеть полный текст ошибки.
  define: {
    'process.env.NODE_ENV': '"development"',
  },
  // И дополнительно отключаем минификацию и включаем sourcemap,
  // чтобы стек и сообщения были читаемыми.
  build: {
    sourcemap: true,
    minify: false,
  },
})

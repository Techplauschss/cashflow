import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/eodhd': {
        target: 'https://eodhd.com',
        changeOrigin: true,
        secure: false,
        headers: {
          origin: '',
        },
        rewrite: (path) => path.replace(/^\/api\/eodhd/, '/api'),
      },
      '/api/frankfurter': {
        target: 'https://api.frankfurter.dev',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/frankfurter/, '/v1'),
      },
      '/api/coingecko': {
        target: 'https://api.coingecko.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/coingecko/, '/api/v3'),
      },
    },
  },
})

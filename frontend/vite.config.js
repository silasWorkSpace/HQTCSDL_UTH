import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/v1/auth': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/api/v1/repositories': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/webhooks': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/documents': {
        target: 'http://localhost:8083',
        changeOrigin: true,
      },
      '/api/v1/reviews': {
        target: 'http://localhost:8084',
        changeOrigin: true,
      },
      '/api/v1/suggestions': {
        target: 'http://localhost:8084',
        changeOrigin: true,
      },
      '/api/v1/governance': {
        target: 'http://localhost:8085',
        changeOrigin: true,
      },
      '/api/v1/notifications': {
        target: 'http://localhost:8086',
        changeOrigin: true,
      },
    },
  },
});

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/v1/documents': {
        target: 'http://localhost:8083',
        changeOrigin: true,
      },
      '/api/v1/governance': {
        target: 'http://localhost:8085',
        changeOrigin: true,
      },
    },
  },
});

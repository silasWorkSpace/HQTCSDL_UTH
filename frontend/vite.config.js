import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'antd': path.resolve(import.meta.dirname, './src/components/ui/antd-shim.jsx'),
      'react-i18next': path.resolve(import.meta.dirname, './src/components/ui/i18next-shim.js'),
      '@tanstack/react-query': path.resolve(import.meta.dirname, './src/components/ui/query-shim.js'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/v1/auth': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/api/v1/users': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/api/v1/integrations': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/analysis-runs': {
        target: 'http://localhost:8082',
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
      // Cảnh báo drift của tài liệu do workflow-service phục vụ
      '^/api/v1/documents/[^/]+/drift-alerts': {
        target: 'http://localhost:8084',
        changeOrigin: true,
      },
      '^/api/v1/documents/[^/]+/submit$': {
        target: 'http://localhost:8084',
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
      '/api/v1/templates': {
        target: 'http://localhost:8085',
        changeOrigin: true,
      },
      '/api/v1/collections': {
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

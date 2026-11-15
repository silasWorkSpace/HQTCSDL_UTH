// Vi du cau hinh. KHONG chep de len vite.config.js cua nhom: chi them hai khoi `server` va `test` vao file hien co.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1/auth': 'http://localhost:8081',
      '/api/v1/users': 'http://localhost:8081',
      '/api/v1/admin': 'http://localhost:8081',
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
})

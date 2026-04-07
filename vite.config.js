import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',  // Relative paths so dist/ works offline from file://
  resolve: {
    alias: {
      tslib: 'tslib/tslib.es6.js'
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  optimizeDeps: {
    include: ['@supabase/supabase-js', 'tslib']
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})

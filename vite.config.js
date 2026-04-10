import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Performance optimizations for low-end PCs
    cssCodeSplit: true,
    target: 'es2015',
    minify: 'esbuild',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-ui': ['react', 'react-dom', 'react-router-dom'],
          'vendor-utils': ['@supabase/supabase-js', 'uuid'],
          'vendor-icons': ['lucide-react']
        }
      }
    },
    commonjsOptions: {
      include: [/tslib/, /node_modules/],
    },
  },
  optimizeDeps: {
    include: ['@supabase/supabase-js']
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})

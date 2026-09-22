import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',  // Local development
    port: 4173,         // Specific port to avoid conflicts
    cors: true,
    // Allow requests from the reverse proxy domain
    allowedHosts: ['peter.geniusbee.net', '.hodgepodge-studio.com', 'localhost', '127.0.0.1'],
    // Disable HMR to avoid WebSocket connection issues through reverse proxy
    // Forward backend paths to Django so the app works through one address
    // (local http://127.0.0.1:4173 or the Cloudflare Tunnel domain).
    // Host header is kept so Django builds links with the public domain.
    proxy: Object.fromEntries(
      ['/api', '/admin', '/static', '/media', '/swagger', '/redoc'].map((p) => [
        p,
        { target: 'http://127.0.0.1:8000', changeOrigin: false },
      ])
    ),
    hmr: false,
    watch: {
      usePolling: true
    }
  },
  assetsInclude: ['**/*.glb'],
  optimizeDeps: {
    exclude: ['openai']
  },
  build: {
    commonjsOptions: {
      include: [/openai/, /node_modules/]
    }
  }
}) 
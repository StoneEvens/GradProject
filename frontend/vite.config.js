import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',  // Local development
    port: 5173,         // Specific port to avoid conflicts
    cors: true,
    // Allow requests from the reverse proxy domain
    allowedHosts: ['petapp.geniusbee.net', 'localhost', '127.0.0.1'],
    // Disable HMR to avoid WebSocket connection issues through reverse proxy
    hmr: false,
    watch: {
      usePolling: true
    }
  },
  assetsInclude: ['**/*.glb'],
}) 
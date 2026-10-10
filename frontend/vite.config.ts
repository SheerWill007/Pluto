import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: 'hidden',
    // three.js alone is ~900 kB; it's lazy-loaded with the topology view, never on first paint
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        // Split large, rarely-changing vendors into their own long-cacheable chunks. Groups also
        // capture their dependencies, so React must claim its modules first (highest priority)
        // or the three.js group would absorb react-dom and force it onto every page.
        codeSplitting: {
          groups: [
            { name: 'vendor-three', test: /node_modules[/\\](three|@react-three|three-stdlib|troika|maath|meshline)/, priority: 10 },
            { name: 'vendor-motion', test: /node_modules[/\\](framer-motion|motion-dom|motion-utils|gsap|lenis)/, priority: 20 },
            { name: 'vendor-react', test: /node_modules[/\\](react|react-dom|react-router|scheduler|zustand|use-sync-external-store)[/\\]/, priority: 30 },
          ],
        },
      },
    },
  },
})

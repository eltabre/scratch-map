import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // GitHub Pages serves project sites from /<repo-name>/, so the base path
  // must match the repository name for asset URLs to resolve correctly.
  base: '/scratch-map/',
})

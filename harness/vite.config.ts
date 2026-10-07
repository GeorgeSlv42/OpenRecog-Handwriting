import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The shared ink/ package lives next to the harness, outside Vite's root.
  server: { fs: { allow: ['.', '../ink'] } },
})

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { configDefaults } from 'vitest/config'

// Desktop-only Electron app configuration
export default defineConfig({
  plugins: [
    vue()
  ],
  base: './', // Use relative paths for Electron
  server: {
    port: 3000,
    strictPort: true, // Fail if port is already in use
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // Remove any web-specific optimization
      output: {
        manualChunks: undefined,
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: [...configDefaults.exclude],
  },
})

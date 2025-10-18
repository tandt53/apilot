import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // Use relative paths for Electron production builds
  plugins: [
    react(),
    electron([
      {
        // Main process
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            sourcemap: true,
            rollupOptions: {
              external: ['electron', 'path', 'fs', 'fs/promises'],
              output: {
                format: 'es',
                entryFileNames: 'main.js'
              }
            }
          }
        }
      },
      {
        // Preload script
        entry: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            sourcemap: true,
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'preload.js'
              }
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
    }
  },
  build: {
    rollupOptions: {
      external: ['openai', '@anthropic-ai/sdk', '@google/generative-ai', 'ollama']
    },
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: false,
    sourcemap: false
  },
  server: {
    port: 5173
  },
  optimizeDeps: {
    exclude: ['openai', '@anthropic-ai/sdk', '@google/generative-ai', 'ollama']
  }
})

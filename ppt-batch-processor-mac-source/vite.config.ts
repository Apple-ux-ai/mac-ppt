import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'
import fs from 'fs'

function copyPreloadFile() {
  const src = path.join(__dirname, 'src/main/preload.cjs')
  const destDir = path.join(__dirname, 'dist-electron')
  const dest = path.join(destDir, 'preload.cjs')

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest)
    console.log('✓ Copied preload.cjs')
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        // Main process entry file
        entry: 'src/main/index.ts',
        vite: {
          resolve: {
            // Prefer TypeScript sources when both .ts and .js exist under src/main
            extensions: ['.ts', '.mts', '.js', '.mjs', '.json'],
          },
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: [
                'electron',
                'sharp',
                'xml2js',
                'pizzip',
                'xlsx',
                'csv-parser',
                'officecrypto-tool',
                'pptxgenjs',
                'p-limit',
                'canvas',
              ],
            },
          },
        },
        onstart(options) {
          copyPreloadFile()
          options.startup()
        },
      },
    ]),
    {
      name: 'copy-preload-cjs-build',
      writeBundle() {
        copyPreloadFile()
      },
    },
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    port: 10037,
  },
})

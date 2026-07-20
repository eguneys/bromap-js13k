import { defineConfig } from 'vite'

let reserved = ['mid', 'bass', 'treble', 'black', 'white']


export default defineConfig({
  base: './',
  build: {
    assetsInlineLimit: 0,
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      mangle: {
        module: true,
        properties: {
          keep_quoted: 'strict',
          reserved,
          //debug: true
        },
      },
    },
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].min.js',
      }
    }
  }
})
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5180, open: false },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        art: resolve(__dirname, 'art.html'),
        classic: resolve(__dirname, 'classic.html'),
      },
    },
  },
});

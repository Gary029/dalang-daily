import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { resolve } from 'node:path';

/**
 * Plays the game in a normal browser with the server logic running in the
 * page (src/client/local.ts). Not used for the Reddit build.
 *   npm run local   ->  http://localhost:5173/splash.html
 */
export default defineConfig({
  root: 'src/client',
  publicDir: resolve(import.meta.dirname, 'public'),
  plugins: [react(), tailwind()],
  define: { 'import.meta.env.VITE_LOCAL': JSON.stringify('1') },
  build: {
    outDir: resolve(import.meta.dirname, 'dist/local'),
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        splash: resolve(import.meta.dirname, 'src/client/splash.html'),
        game: resolve(import.meta.dirname, 'src/client/game.html'),
        index: resolve(import.meta.dirname, 'src/client/index.html'),
      },
    },
  },
  server: { port: 5173 },
});

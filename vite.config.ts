import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig({
  // The app version shown in the UI comes from package.json (see src/lib/version.ts).
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      workbox: {
        // Firebase Auth's sign-in handler lives under /__/ on Firebase Hosting; the SPA fallback
        // must not swallow it, or Google sign-in by redirect breaks.
        navigateFallbackDenylist: [/^\/__\//],
      },
      manifest: {
        id: '/',
        name: 'PartyGames',
        short_name: 'PartyGames',
        description: 'Play Gomoku and run a Monopoly bank with your friends.',
        theme_color: '#5b36c8',
        background_color: '#140b28',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      // Split big libraries into their own long-cached chunks.
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

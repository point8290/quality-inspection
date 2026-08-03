import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The app shell updates itself; a supervisor should never have to think about it.
      registerType: 'autoUpdate',
      // Lets the service worker be exercised with `npm run dev`, not only in a build —
      // otherwise offline behaviour is untestable until the very end.
      devOptions: { enabled: true },
      manifest: {
        name: 'Quality Inspection Tracker',
        short_name: 'Inspections',
        description: 'Log, track and resolve fabric quality defects from the shop floor',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
      },
      workbox: {
        // Precaching the shell is what makes the app open with no network at all.
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
        runtimeCaching: [
          {
            // Reference data changes rarely and every screen needs it, so serve it from
            // cache immediately and refresh in the background.
            urlPattern: /\/api\/(severities|defect-types)$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'reference-data' },
          },
        ],
        // Inspections are deliberately NOT runtime-cached: the Dexie mirror is the offline
        // read path, and a second cache would be a second source of truth to reconcile.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    // Proxy /api to the Express server so the browser sees one origin in dev — no CORS
    // preflights, and the app uses relative /api paths that also work in production.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Proxy /api to the Express server so the browser sees one origin in dev — no CORS
    // preflights, and the app uses relative /api paths that also work in production.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});

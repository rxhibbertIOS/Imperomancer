// vite.config.js
/** Build configuration for the static multi-page application. @module vite.config */
import { defineConfig } from 'vite';
import htmlInclude from 'vite-plugin-html-include';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: 'index.html',
        landing: 'landing.html',
        feature: 'feature.html',
      },
    },
  },
  plugins: [
    htmlInclude(),
  ],
});

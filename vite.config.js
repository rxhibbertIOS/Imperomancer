// vite.config.js
import { defineConfig } from 'vite';
import htmlInclude from 'vite-plugin-html-include';

export default defineConfig({
  plugins: [
    htmlInclude(),
  ],
});
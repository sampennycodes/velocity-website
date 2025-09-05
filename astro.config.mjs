// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://velocitymarketing.com.au',
  output: 'static',
  integrations: [sitemap()],
  server: {
    port: 4321,
    host: true
  }
});

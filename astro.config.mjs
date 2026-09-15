// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://velocitymarketing.com.au',
  output: 'static',
  redirects: {
    '/google-ads-traralgon': { status: 301, destination: '/paid-ads-traralgon' },
    '/traralgon': { status: 301, destination: '/paid-ads-traralgon' },
  },
  // Keep the pre-upgrade HTML whitespace treatment.
  compressHTML: true,
  integrations: [
    {
      name: 'velocity-local-contact',
      hooks: {
        'astro:config:setup': ({ command, injectRoute }) => {
          if (command === 'dev') {
            injectRoute({ pattern: '/api/editor', entrypoint: './src/endpoints/editor.ts', prerender: false });
            injectRoute({ pattern: '/api/contact', entrypoint: './src/endpoints/contact.ts', prerender: false });
          }
        }
      }
    },
    sitemap({
      filter: (page) => !['/traralgon', '/google-ads-traralgon'].includes(new URL(page).pathname.replace(/\/$/, '')) && !new URL(page).pathname.startsWith('/admin')
    })
  ],
  server: {
    port: 4321,
    host: '127.0.0.1'
  }
});

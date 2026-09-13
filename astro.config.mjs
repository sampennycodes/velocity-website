// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://velocitymarketing.com.au',
  output: 'static',
  integrations: [
    {
      name: 'velocity-local-contact',
      hooks: {
        'astro:config:setup': ({ command, injectRoute }) => {
          if (command === 'dev') {
            injectRoute({ pattern: '/api/contact', entrypoint: './src/endpoints/contact.ts', prerender: false });
          }
        }
      }
    },
    sitemap({
      filter: (page) => !page.includes('/traralgon')
    })
  ],
  server: {
    port: 4321,
    host: '127.0.0.1'
  }
});

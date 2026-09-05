// @ts-check
import { defineConfig, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  // Replace with the real domain once it is bought and pointed to Vercel.
  site: 'https://lemariagedeslulu.fr',

  // Astro >= 5 merged the old `hybrid` mode into `static`: every page is
  // prerendered unless it opts out with `export const prerender = false`.
  output: 'static',
  adapter: vercel(),

  // Typed, validated environment variables (see .env.example).
  // Server secrets are never exposed to the client bundle.
  env: {
    schema: {
      SITE_PASSWORD: envField.string({ context: 'server', access: 'secret' }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      NOTIFY_EMAIL: envField.string({ context: 'server', access: 'secret' }),
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },
});

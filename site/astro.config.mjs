import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://raidosdimitris.github.io',
  base: '/openclaw-raspberrypi5',
  markdown: {
    shikiConfig: { theme: 'github-dark' },
  },
});

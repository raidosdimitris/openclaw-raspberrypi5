# Contributing

## Project Structure

```
docs/guide.md          ← Single source of truth for the installation guide
site/                  ← Astro static site (renders guide.md)
  src/pages/index.astro
  src/layouts/Base.astro
  astro.config.mjs
assets/banner.svg      ← README banner image
README.md              ← Repository description (not site content)
```

## Editing the Guide

**`docs/guide.md` is the single source of truth.** The website is built directly from this file. To update the guide content, edit only `docs/guide.md` — the site will reflect changes automatically on the next build.

## Local Preview

```bash
cd site
npm install
npm run dev
```

This copies `docs/guide.md` into the site source and starts a local dev server (usually at `http://localhost:4321`).

## Building for Production

```bash
cd site
npm install
npm run build
```

The built site will be in `site/dist/`.

## How Deployment Works

The site is deployed to GitHub Pages via a GitHub Actions workflow (`.github/workflows/deploy.yml`). On every push to `main`:

1. The workflow checks out the repo
2. Installs Node.js 22 and npm dependencies
3. Runs `npm run build` (which copies `docs/guide.md` then runs Astro build)
4. Uploads the `site/dist/` directory as a GitHub Pages artifact
5. Deploys to https://raidosdimitris.github.io/openclaw-raspberrypi5/

No API keys or secrets are required — the workflow uses GitHub's built-in Pages deployment.

## Tech Stack

- **[Astro](https://astro.build/)** — Static site generator (chosen for design flexibility over VitePress)
- **[marked](https://marked.js.org/)** — Markdown parser for rendering guide.md
- **Vanilla CSS** — Custom dark/light theme with security-oriented colour palette

## Design Decisions

- **Dark mode by default** with light mode toggle (localStorage persisted)
- **Sticky sidebar** navigation generated from guide.md headings
- **Copy-to-clipboard** buttons on all code blocks
- **Mobile responsive** with hamburger menu for sidebar
- **guide.md as source of truth** — imported via Vite's `?raw` query at build time

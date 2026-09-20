// Lightweight static-site generation for Linklet's public marketing/legal
// pages — landing, about, contact, privacy, terms.
//
// Why not the usual vite-plugin-prerender? That runs headless Chrome via
// Puppeteer during the build. On Vercel's serverless build sandbox that's a
// ~300MB dependency and a real, untested failure mode — too risky to add
// while the account is already having infra trouble. This script does the
// same job with plain React SSR (react-dom/server) and no browser at all:
// it renders each static page's markup + <Helmet> tags to a string and
// splices them into a copy of the already-built dist/index.html.
//
// The app itself is client-rendered only (main.jsx uses createRoot, not
// hydrateRoot) — so this prerendered HTML is never "hydrated"; the browser's
// JS simply replaces it on mount, same as it always did. The only audience
// that ever sees the prerendered markup as final output is something that
// doesn't run JS: search crawlers and social-preview bots (WhatsApp,
// iMessage, Slack, LinkedIn) reading <title>/<meta property="og:*">.
//
// Routes NOT in this list (chat, dashboard, posts/:id, profile/:username,
// ...) still work exactly as before — they fall through to app-shell.html,
// an untouched copy of the plain SPA shell, and render entirely client-side.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeIntoShell } from './mergeHtml.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const run = async () => {
  const { renderPage, STATIC_ROUTES } = await import(
    path.join(__dirname, '..', 'dist-ssr', 'entry-server.js')
  );

  const shellPath = path.join(distDir, 'index.html');
  const shellHtml = await readFile(shellPath, 'utf-8');

  // Pristine fallback for every route this script doesn't prerender —
  // captured BEFORE any route's content overwrites dist/index.html below.
  await copyFile(shellPath, path.join(distDir, 'app-shell.html'));

  for (const route of STATIC_ROUTES) {
    const { html, helmet } = renderPage(route);
    const merged = mergeIntoShell(shellHtml, {
      titleTag: helmet.title.toString(),
      metaTags: helmet.meta.toString(),
      linkTags: helmet.link.toString(),
      scriptTags: helmet.script.toString(),
      bodyHtml: html,
    });

    const outPath =
      route === '/'
        ? shellPath
        : path.join(distDir, route.replace(/^\//, ''), 'index.html');

    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, merged, 'utf-8');
    console.log(`[prerender] wrote ${path.relative(distDir, outPath) || 'index.html'} for ${route}`);
  }

  console.log(`[prerender] done — ${STATIC_ROUTES.length} static routes prerendered.`);
};

run().catch((err) => {
  console.error('[prerender] failed:', err);
  process.exit(1);
});

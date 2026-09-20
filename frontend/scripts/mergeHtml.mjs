// Pure string-merge logic for scripts/prerender.mjs, split out so it's
// unit-testable without needing a real Vite/SSR build in the test run.

const TITLE_RE = /<title>[\s\S]*?<\/title>/;
// Matches the specific default <meta> tags seeded in index.html (description,
// og:*, twitter:*) so they can be swapped for the page's own Helmet-collected
// set instead of ending up duplicated alongside it.
const REPLACEABLE_META_RE =
  /<meta[^>]*?(?:name="description"|property="og:[^"]*"|name="twitter:[^"]*")[^>]*?\/>/g;
const ROOT_DIV_RE = /<div id="root"><\/div>/;

/**
 * Merge a prerendered page's title/meta/body into a copy of the built
 * Vite shell (dist/index.html), producing the static HTML served to crawlers
 * for that specific route. `titleTag` and `metaTags` are the exact strings
 * react-helmet-async's `helmet.title.toString()` / `helmet.meta.toString()`
 * return for that page.
 */
export const mergeIntoShell = (
  shellHtml,
  { titleTag, metaTags, linkTags = "", scriptTags = "", bodyHtml }
) => {
  if (!shellHtml.includes('<div id="root"></div>')) {
    throw new Error('Shell HTML is missing the expected <div id="root"></div> mount point');
  }

  let merged = shellHtml
    .replace(TITLE_RE, '')
    .replace(REPLACEABLE_META_RE, '');

  // `linkTags` carries <link rel="canonical">, `scriptTags` the JSON-LD blocks.
  merged = merged.replace(
    '</head>',
    () => [titleTag, metaTags, linkTags, scriptTags].filter(Boolean).join('\n') + '\n</head>'
  );
  merged = merged.replace(ROOT_DIV_RE, () => `<div id="root">${bodyHtml}</div>`);

  return merged;
};

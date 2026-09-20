import React from "react";
import { Helmet } from "react-helmet-async";
import { SITE_URL, DEFAULT_OG_IMAGE } from "../config";

// Dimensions of public/og-image.jpg — declared so social crawlers can lay out
// the preview card without downloading the image first.
const OG_IMAGE_WIDTH = "1200";
const OG_IMAGE_HEIGHT = "630";

/**
 * One place for a page's <head> metadata: title, description, canonical URL,
 * robots directive, Open Graph / Twitter cards and optional JSON-LD.
 *
 *  - `path` builds the absolute canonical + og:url, so every URL has exactly one
 *    canonical form (no `?utm=` / trailing-slash duplicates competing in search).
 *  - `noindex` is for pages that must not appear in search results (auth
 *    screens, 404). It also sets `nofollow` so crawlers don't walk from them.
 *  - `jsonLd` is an object (or array of objects) of schema.org structured data.
 *
 * Also used by the build-time prerender (ssr/entry-server.jsx), which collects the
 * tags through react-helmet-async and writes them into each page's static HTML.
 */
const SEO = ({
  title,
  description,
  path = "/",
  image = DEFAULT_OG_IMAGE,
  type = "website",
  noindex = false,
  jsonLd = null,
  ogTitle,
}) => {
  const url = `${SITE_URL}${path === "/" ? "/" : path}`;
  const socialTitle = ogTitle || title;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />

      <meta property="og:site_name" content="Linklet" />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={socialTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content={OG_IMAGE_WIDTH} />
      <meta property="og:image:height" content={OG_IMAGE_HEIGHT} />
      <meta property="og:image:alt" content="Linklet — your campus, organized" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={socialTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
};

export default SEO;

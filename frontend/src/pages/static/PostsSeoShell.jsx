import React from "react";
import { Link } from "react-router-dom";
import SEO from "../../components/SEO";

export const POSTS_TITLE = "Campus Feed | Linklet";
export const POSTS_DESCRIPTION =
  "The MNNIT campus feed on Linklet — announcements, questions and updates shared by students, in one place.";

/**
 * Build-time-only page for /posts (see ssr/entry-server.jsx).
 *
 * The live feed is per-visitor and client-rendered, so it can't be prerendered.
 * But without this, /posts was served the generic app shell: the same title and
 * description as every other route, and an empty <div id="root"> to any crawler
 * that doesn't run JavaScript. This gives /posts its own title, description,
 * canonical URL and a real heading + intro. The browser replaces it with the
 * actual feed the moment the app boots.
 */
const PostsSeoShell = () => (
  <main className="min-h-screen bg-canvas text-fg px-4 pt-24 pb-16">
    <SEO title={POSTS_TITLE} description={POSTS_DESCRIPTION} path="/posts" />
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight text-fg mb-3">Campus Feed</h1>
      <p className="text-zinc-400 leading-relaxed mb-6">{POSTS_DESCRIPTION}</p>
      <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium">
        Log in to join the conversation
      </Link>
    </div>
  </main>
);

export default PostsSeoShell;

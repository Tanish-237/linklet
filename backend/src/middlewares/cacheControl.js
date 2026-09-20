/**
 * HTTP caching policy for API responses.
 *
 * Every API response is user-scoped (auth cookie / bearer token), so nothing may
 * ever land in a shared cache: all directives here are `private`.
 *
 *  - apiDefaultCacheControl: GETs default to `private, no-cache` — the browser may
 *    store the response but must revalidate every time (Express's ETag turns an
 *    unchanged response into a tiny 304). Without any header, browsers apply
 *    their own heuristics and can serve stale API data.
 *  - browserCache(seconds): opt-in for near-static reference data (branches, tag
 *    cloud, category list) so repeat visits skip the network entirely, with
 *    stale-while-revalidate so refreshes stay invisible.
 */
export const apiDefaultCacheControl = (req, res, next) => {
  if (req.method === "GET") res.set("Cache-Control", "private, no-cache");
  next();
};

export const browserCache =
  (maxAgeSeconds, staleWhileRevalidateSeconds = maxAgeSeconds * 5) =>
  (req, res, next) => {
    if (req.method === "GET") {
      res.set(
        "Cache-Control",
        `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`
      );
    }
    next();
  };

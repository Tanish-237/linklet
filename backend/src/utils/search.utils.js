/**
 * Escape special regex characters in raw user input before it's interpolated
 * into a `new RegExp(...)` / `$regex` query. Without this, a search term like
 * `.*` or `(a+)+$` is passed straight to MongoDB as a regex — at best matching
 * far more than intended, at worst a catastrophic-backtracking pattern that
 * can hang the query (ReDoS).
 */
export const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Utility for building fuzzy regex search queries across multiple document fields and matched author User IDs.
 * Escapes special regex characters and splits search text into individual tokens.
 *
 * @param {string} searchTerm      - Raw user search input
 * @param {string[]} fields        - Document field names to search across
 * @param {Array} matchedUserIds   - Optional array of User ObjectIds matching author username lookup
 * @returns {object|null}          - Mongoose query object with $or conditions or null if search term is empty
 */
export const buildFuzzySearchQuery = (
  searchTerm = "",
  fields = ["title", "body", "tags", "category"],
  matchedUserIds = []
) => {
  if (!searchTerm || !searchTerm.trim()) return null;

  const rawTerm = searchTerm.trim().replace(/^@/, ""); // Strip optional @ prefix
  if (!rawTerm) return null;

  const escapedTerm = rawTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const tokens = rawTerm
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const conditions = [];

  // If author usernames matched search term, include userId match condition
  if (matchedUserIds && matchedUserIds.length > 0) {
    conditions.push({ userId: { $in: matchedUserIds } });
  }

  // Match full escaped phrase anywhere across target fields
  fields.forEach((field) => {
    conditions.push({ [field]: { $regex: escapedTerm, $options: "i" } });
  });

  // Match individual word tokens across target fields
  tokens.forEach((token) => {
    fields.forEach((field) => {
      conditions.push({ [field]: { $regex: token, $options: "i" } });
    });
  });

  return conditions.length > 0 ? { $or: conditions } : null;
};

/**
 * Ranks and scores array of documents based on search term relevance.
 * Author Username match = 9x, Title match = 10x, Tag match = 7x, Category match = 8x, Body match = 1x.
 *
 * @param {Array} docs
 * @param {string} searchTerm
 * @returns {Array} sorted docs with relevanceScore property attached
 */
export const scoreSearchRelevance = (docs = [], searchTerm = "") => {
  if (!searchTerm || !searchTerm.trim() || !docs.length) return docs;

  const lowerTerm = searchTerm.trim().replace(/^@/, "").toLowerCase();
  const tokens = lowerTerm.split(/\s+/).filter(Boolean);

  return docs
    .map((doc) => {
      let score = 0;
      const title = (doc.title || "").toLowerCase();
      const body = (doc.body || "").toLowerCase();
      const category = (doc.category || "").toLowerCase();
      const tags = (doc.tags || []).map((t) => (t || "").toLowerCase());

      // Author username matching
      const authorUsername = (
        doc.userId?.username ||
        (typeof doc.userId === "string" ? doc.userId : "")
      ).toLowerCase();

      if (authorUsername && authorUsername.includes(lowerTerm)) score += 9;

      // Exact title match bonus
      if (title.includes(lowerTerm)) score += 10;
      // Exact category match bonus
      if (category.includes(lowerTerm)) score += 8;
      // Tag match bonus
      if (tags.some((t) => t.includes(lowerTerm))) score += 7;

      // Token level scoring
      tokens.forEach((token) => {
        if (authorUsername && authorUsername.includes(token)) score += 4;
        if (title.includes(token)) score += 3;
        if (tags.some((t) => t.includes(token))) score += 2.5;
        if (category.includes(token)) score += 2;
        if (body.includes(token)) score += 1;
      });

      return { ...doc, relevanceScore: score };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
};

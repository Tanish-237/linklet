/**
 * Opaque pagination cursors shared by the forum feed.
 *
 * Two flavours, because two different orderings need two different strategies:
 *
 *  - DATE cursor (`2025-01-30T10:00:00.000Z`): the feed is ordered purely by
 *    `createdAt`, so "everything older than the last item I saw" is an exact,
 *    index-friendly keyset query.
 *
 *  - OFFSET cursor (`o:30`): the feed is ordered by something else (vote count,
 *    view count, search relevance). Then the last item's `createdAt` says
 *    NOTHING about where the next page starts — using it (as the old code did)
 *    silently duplicates and skips questions. An offset into a stably-ordered
 *    list is the correct cursor for those orderings.
 *
 * Clients treat the cursor as an opaque string and just send back whatever the
 * API gave them as `nextCursor`.
 */
const OFFSET_PREFIX = "o:";

// Deep offsets get expensive (skip/sort work grows with the offset), and nobody
// scrolls a forum search 1000 results deep.
export const MAX_OFFSET = 1000;

export const makeOffsetCursor = (offset) => `${OFFSET_PREFIX}${offset}`;

/** @returns {{ offset: number, date: Date | null }} */
export const parseFeedCursor = (cursor) => {
  if (!cursor) return { offset: 0, date: null };

  const raw = String(cursor);
  if (raw.startsWith(OFFSET_PREFIX)) {
    const parsed = parseInt(raw.slice(OFFSET_PREFIX.length), 10);
    const offset = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_OFFSET) : 0;
    return { offset, date: null };
  }

  const date = new Date(raw);
  return { offset: 0, date: Number.isNaN(date.getTime()) ? null : date };
};

/** Slice `limit` items from a fully ranked list and report exact paging info. */
export const paginateList = (items, offset, limit) => {
  const page = items.slice(offset, offset + limit);
  const hasMore = items.length > offset + limit;
  return {
    items: page,
    hasMore,
    nextCursor: hasMore ? makeOffsetCursor(offset + limit) : null,
  };
};

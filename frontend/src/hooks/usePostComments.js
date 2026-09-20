import { useCallback, useEffect, useRef, useState } from "react";
import * as postApi from "../api/post.api";

const idOf = (value) => (value?._id || value)?.toString();

/**
 * Merge `incoming` into `list`: skip items already present and keep the result
 * in creation order. Mongo ObjectIds are fixed-length hex strings that lead with
 * a timestamp, so comparing them as strings is a chronological sort. Sorting
 * (rather than just appending) matters when a comment the user just posted
 * locally sits in the list before older, not-yet-loaded ones arrive.
 */
const mergeById = (list, incoming) => {
  const seen = new Set(list.map((item) => idOf(item)));
  const merged = [...list, ...incoming.filter((item) => !seen.has(idOf(item)))];
  return merged.sort((a, b) => idOf(a).localeCompare(idOf(b)));
};

const lastId = (items) => (items?.length ? idOf(items[items.length - 1]) : null);

/**
 * Paginated comment thread for one post.
 *
 * Comments are fetched a page at a time (each with its first few replies
 * inline); the remaining replies of a comment are fetched on demand. Every
 * mutation patches local state from the (small) API response instead of
 * re-downloading the whole thread. Mutating functions throw on failure so the
 * caller decides how to surface the error (toast, inline message, ...).
 *
 * `onCountChange(n)` is called whenever the server reports a new total
 * `commentsCount`, so the surrounding post card / modal can stay in sync.
 */
const usePostComments = (postId, { onCountChange } = {}) => {
  const [comments, setComments] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [loadingReplies, setLoadingReplies] = useState({});

  // Every request is stamped; a response whose stamp is no longer current
  // (user switched posts, or retried) is dropped instead of overwriting newer state.
  const requestRef = useRef(0);
  // Server-side reply cursor per comment: the id of the last reply the SERVER
  // has sent us. Kept apart from the local list because a reply the user just
  // posted lands at the end of that list — using it as the cursor would skip
  // every older reply that hasn't been fetched yet.
  const replyCursorsRef = useRef({});
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const reportCount = (count) => {
    if (typeof count === "number") onCountChangeRef.current?.(count);
  };

  const loadFirstPage = useCallback(async () => {
    if (!postId) return;
    const stamp = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await postApi.getPostComments(postId);
      if (stamp !== requestRef.current) return;
      replyCursorsRef.current = {};
      (res.data || []).forEach((c) => {
        replyCursorsRef.current[idOf(c)] = lastId(c.replies);
      });
      setComments(res.data || []);
      setHasMore(Boolean(res.hasMore));
      setNextCursor(res.nextCursor || null);
    } catch (err) {
      if (stamp !== requestRef.current) return;
      setError(err);
    } finally {
      if (stamp === requestRef.current) setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    setComments([]);
    setHasMore(false);
    setNextCursor(null);
    loadFirstPage();
    return () => {
      requestRef.current += 1; // invalidate any in-flight request for the old post
    };
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    const stamp = requestRef.current;
    setLoadingMore(true);
    try {
      const res = await postApi.getPostComments(postId, { cursor: nextCursor });
      if (stamp !== requestRef.current) return;
      (res.data || []).forEach((c) => {
        replyCursorsRef.current[idOf(c)] = lastId(c.replies);
      });
      setComments((prev) => mergeById(prev, res.data || []));
      setHasMore(Boolean(res.hasMore));
      setNextCursor(res.nextCursor || null);
    } catch (err) {
      if (stamp === requestRef.current) setError(err);
    } finally {
      setLoadingMore(false);
    }
  }, [postId, hasMore, nextCursor, loadingMore]);

  const loadMoreReplies = useCallback(
    async (commentId) => {
      if (loadingReplies[commentId]) return;
      const stamp = requestRef.current;

      setLoadingReplies((prev) => ({ ...prev, [commentId]: true }));
      try {
        const res = await postApi.getCommentReplies(postId, commentId, {
          cursor: replyCursorsRef.current[commentId] || null,
        });
        if (stamp !== requestRef.current) return;
        if (res.data?.length) replyCursorsRef.current[commentId] = lastId(res.data);
        setComments((prev) =>
          prev.map((c) =>
            idOf(c) === commentId ? { ...c, replies: mergeById(c.replies || [], res.data || []) } : c
          )
        );
      } finally {
        setLoadingReplies((prev) => ({ ...prev, [commentId]: false }));
      }
    },
    [postId, loadingReplies]
  );

  const addComment = useCallback(
    async (text) => {
      const { comment, commentsCount } = await postApi.addComment(postId, text);
      setComments((prev) => mergeById(prev, [{ ...comment, replies: comment.replies || [] }]));
      reportCount(commentsCount);
      return comment;
    },
    [postId]
  );

  const addReply = useCallback(
    async (commentId, text, replyToUsername) => {
      const { reply, repliesCount, commentsCount } = await postApi.addReply(
        postId,
        commentId,
        text,
        replyToUsername
      );
      setComments((prev) =>
        prev.map((c) =>
          idOf(c) === commentId
            ? { ...c, replies: mergeById(c.replies || [], [reply]), repliesCount }
            : c
        )
      );
      reportCount(commentsCount);
      return reply;
    },
    [postId]
  );

  const toggleUpvote = useCallback(
    async (commentId) => {
      const updated = await postApi.toggleCommentUpvote(postId, commentId);
      const upvotes = updated?.upvotes || [];
      setComments((prev) =>
        prev.map((c) => {
          if (idOf(c) === commentId) return { ...c, upvotes };
          if (c.replies?.some((r) => idOf(r) === commentId)) {
            return { ...c, replies: c.replies.map((r) => (idOf(r) === commentId ? { ...r, upvotes } : r)) };
          }
          return c;
        })
      );
    },
    [postId]
  );

  const deleteComment = useCallback(
    async (commentId) => {
      const { deletedIds = [], commentsCount } = await postApi.deletePostComment(postId, commentId);
      const removed = new Set(deletedIds.map(String));
      setComments((prev) =>
        prev
          .filter((c) => !removed.has(idOf(c)))
          .map((c) => {
            const remaining = (c.replies || []).filter((r) => !removed.has(idOf(r)));
            if (remaining.length === (c.replies || []).length) return c;
            return {
              ...c,
              replies: remaining,
              repliesCount: Math.max(0, (c.repliesCount || 0) - ((c.replies || []).length - remaining.length)),
            };
          })
      );
      reportCount(commentsCount);
    },
    [postId]
  );

  return {
    comments,
    hasMore,
    loading,
    loadingMore,
    loadingReplies,
    error,
    reload: loadFirstPage,
    loadMore,
    loadMoreReplies,
    addComment,
    addReply,
    toggleUpvote,
    deleteComment,
  };
};

export default usePostComments;

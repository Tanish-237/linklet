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
 * Replies nest to arbitrary depth (see MAX_INDENT_DEPTH in
 * PostCommentsPanel.jsx for the visual cap), so the comment thread is a tree,
 * not a fixed two-level list. These two helpers apply an update to whichever
 * node matches `id` anywhere in that tree, immutably, without the caller
 * needing to know how deep it is.
 */
const updateNodeById = (nodes, id, updater) =>
  nodes.map((n) => {
    if (idOf(n) === id) return updater(n);
    if (n.replies?.length) {
      const updatedReplies = updateNodeById(n.replies, id, updater);
      if (updatedReplies !== n.replies) return { ...n, replies: updatedReplies };
    }
    return n;
  });

/** Recursively drop every id in `removedIds` and fix up each direct parent's repliesCount. */
const removeNodesById = (nodes, removedIds) =>
  nodes
    .filter((n) => !removedIds.has(idOf(n)))
    .map((n) => {
      const children = n.replies || [];
      const directRemoved = children.filter((c) => removedIds.has(idOf(c))).length;
      const newChildren = removeNodesById(children, removedIds);
      if (directRemoved === 0 && newChildren === children) return n;
      return {
        ...n,
        replies: newChildren,
        repliesCount: directRemoved > 0 ? Math.max(0, (n.repliesCount || 0) - directRemoved) : n.repliesCount,
      };
    });

/**
 * Paginated comment thread for one post.
 *
 * Comments are fetched a page at a time (each with its first few replies
 * inline); deeper replies — at any nesting depth — are fetched on demand via
 * the same generic "load more replies" call, since the backend allows
 * fetching/attaching replies of a reply just like replies of a top-level
 * comment. Every mutation patches local state from the (small) API response
 * instead of re-downloading the whole thread. Mutating functions throw on
 * failure so the caller decides how to surface the error (toast, inline
 * message, ...).
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
  // Server-side reply cursor per comment id (any depth): the id of the last
  // reply the SERVER has sent us for that node. Kept apart from the local
  // list because a reply the user just posted lands at the end of that list —
  // using it as the cursor would skip every older reply that hasn't loaded yet.
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
          updateNodeById(prev, commentId, (node) => ({
            ...node,
            replies: mergeById(node.replies || [], res.data || []),
          }))
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

  /** `parentId` is whichever node (top-level comment or a reply at any depth) is being replied to. */
  const addReply = useCallback(
    async (parentId, text, replyToUsername) => {
      const { reply, repliesCount, commentsCount } = await postApi.addReply(
        postId,
        parentId,
        text,
        replyToUsername
      );
      setComments((prev) =>
        updateNodeById(prev, parentId, (node) => ({
          ...node,
          replies: mergeById(node.replies || [], [{ ...reply, replies: reply.replies || [] }]),
          repliesCount,
        }))
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
      setComments((prev) => updateNodeById(prev, commentId, (node) => ({ ...node, upvotes })));
    },
    [postId]
  );

  const deleteComment = useCallback(
    async (commentId) => {
      const { deletedIds = [], commentsCount } = await postApi.deletePostComment(postId, commentId);
      const removed = new Set(deletedIds.map(String));
      setComments((prev) => removeNodesById(prev, removed));
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

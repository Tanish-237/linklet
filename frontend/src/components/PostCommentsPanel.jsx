import React, { useRef, useState, useEffect, lazy, Suspense } from "react";
import { toast } from "sonner";
import defaultAvatar from "../assets/default-avatar.webp";
import usePostComments from "../hooks/usePostComments";
import useThemeStore from "../theme/useThemeStore";
import { formatTime } from "../utlis/formatTime";
import { optimizeAvatar } from "../utlis/cloudinary";
import "../pages/Posts.css";

// The emoji picker is ~360 KB; it's only fetched the first time someone opens it.
const EmojiPicker = lazy(() => import("emoji-picker-react"));

// Replies nest to arbitrary depth (any reply can itself be replied to). Each
// level adds its own margin-left/padding-left (see .feed-detail__reply-thread
// in Posts.css) — with no cap, a long thread pushes content further right
// every level, eating most of a phone's width by 4-5 levels deep. Beyond this
// depth, replies still nest logically but stop indenting further.
const MAX_INDENT_DEPTH = 4;

const idOf = (value) => (value?._id || value)?.toString();

const Avatar = ({ src, className }) => (
  <img
    src={optimizeAvatar(src, 32) || defaultAvatar}
    alt=""
    className={className}
    loading="lazy"
    decoding="async"
    onError={(e) => {
      e.currentTarget.onerror = null;
      e.currentTarget.src = defaultAvatar;
    }}
  />
);

/**
 * The right-hand "Comments" column shared by the post page and the feed modal:
 * a paginated thread (comments + inline reply previews), plus the composer.
 */
const PostCommentsPanel = ({ postId, commentsCount = 0, onCountChange, user, onNavigateToProfile }) => {
  const thread = usePostComments(postId, { onCountChange });

  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [replyTextMap, setReplyTextMap] = useState({});
  const [replyingToKey, setReplyingToKey] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiRef = useRef(null);
  const commentInputRef = useRef(null);

  const currentUserId = (user?._id || user?.id)?.toString();
  const isAdmin = user?.role === "admin";
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const handleClick = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmojiPicker(false);
    };
    if (showEmojiPicker) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojiPicker]);

  const handleEmojiClick = (emojiData) => {
    const emoji = emojiData.emoji;
    const input = commentInputRef.current;
    if (input) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      setCommentText(commentText.slice(0, start) + emoji + commentText.slice(end));
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setCommentText((prev) => prev + emoji);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;
    try {
      setCommentLoading(true);
      await thread.addComment(commentText.trim());
      setCommentText("");
      toast.success("Comment added");
    } catch (error) {
      toast.error(error.response?.data?.message || "Error adding comment");
    } finally {
      setCommentLoading(false);
    }
  };

  // `parentId` is whichever node — a top-level comment or a reply at any
  // depth — the user hit "Reply" on; the new reply nests directly under it.
  const handleReplySubmit = async (parentId, replyToUser) => {
    const text = replyTextMap[replyingToKey];
    if (!text || !text.trim() || !user) return;
    try {
      await thread.addReply(parentId, text.trim(), replyToUser);
      setReplyTextMap((prev) => ({ ...prev, [replyingToKey]: "" }));
      setReplyingToKey(null);
      toast.success("Reply added");
    } catch (error) {
      toast.error(error.response?.data?.message || "Error adding reply");
    }
  };

  const handleLike = async (commentId) => {
    if (!user) {
      toast.info("Please log in to vote");
      return;
    }
    try {
      await thread.toggleUpvote(commentId);
    } catch {
      toast.error("Error voting on comment");
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    try {
      await thread.deleteComment(commentId);
      toast.success("Comment deleted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete comment");
    }
  };

  const handleLoadReplies = async (commentId) => {
    try {
      await thread.loadMoreReplies(commentId);
    } catch {
      toast.error("Couldn't load more replies");
    }
  };

  const renderReplyBox = (key, placeholder, onSubmit) => (
    <div className="feed-detail__reply-box">
      <input
        type="text"
        placeholder={placeholder}
        value={replyTextMap[key] || ""}
        onChange={(e) => setReplyTextMap({ ...replyTextMap, [key]: e.target.value })}
        className="feed-detail__reply-input"
        autoFocus
      />
      <div className="feed-detail__reply-actions">
        <button onClick={() => setReplyingToKey(null)} className="feed-detail__reply-cancel">Cancel</button>
        <button onClick={onSubmit} className="feed-detail__reply-submit">Reply</button>
      </div>
    </div>
  );

  const renderDeleteButton = (item, authorName) => {
    const authorId = idOf(item.userId);
    const canDelete = currentUserId && (authorId === currentUserId || isAdmin);
    if (!canDelete) return null;
    return (
      <button
        onClick={() => handleDelete(item._id)}
        className="feed-detail__comment-action hover:text-red-400"
        title={isAdmin && authorId !== currentUserId ? "Delete Comment (Admin Moderation)" : "Delete Comment"}
        aria-label={`Delete comment by ${authorName}`}
      >
        <span className="material-icons" style={{ fontSize: "0.85rem", color: "rgb(var(--danger-fg))" }}>delete_outline</span>
        Delete
      </button>
    );
  };

  // A single recursive node renderer covers a top-level comment and a reply
  // at any depth — the only difference between them is styling (depth 0 gets
  // the plain card + a Like button; deeper nodes get the "--reply" card
  // variant) and how far right the thread indents.
  const renderCommentNode = (node, depth = 0) => {
    const nodeUser = node.userId || {};
    const authorName = nodeUser.username || "User";
    const upvotes = node.upvotes || [];
    const isLiked = upvotes.some((id) => idOf(id) === currentUserId);
    const replies = node.replies || [];
    const hiddenReplies = Math.max(0, (node.repliesCount || 0) - replies.length);
    const threadClass =
      depth + 1 > MAX_INDENT_DEPTH ? "feed-detail__reply-thread feed-detail__reply-thread--flat" : "feed-detail__reply-thread";

    return (
      <div
        key={node._id}
        className={depth === 0 ? "feed-detail__comment-node" : "feed-detail__reply-node"}
      >
        <div className={`feed-detail__comment-card ${depth > 0 ? "feed-detail__comment-card--reply" : ""}`}>
          <div className="feed-detail__comment-header">
            <Avatar src={nodeUser.avatar} className="feed-detail__comment-avatar" />
            <span
              className="feed-detail__comment-author"
              onClick={() => onNavigateToProfile?.(authorName)}
            >
              {authorName}
            </span>
            <span className="feed-detail__comment-time">· {formatTime(node.createdAt)}</span>
          </div>
          <p className="feed-detail__comment-body">
            {depth > 0 && node.replyToUsername && (
              <span className="feed-detail__mention">@{node.replyToUsername} </span>
            )}
            {node.text}
          </p>
          <div className="feed-detail__comment-footer">
            {depth === 0 && (
              <button
                onClick={() => handleLike(node._id)}
                className={`feed-detail__comment-action ${isLiked ? "liked" : ""}`}
              >
                <span
                  className="material-icons"
                  style={{ fontSize: "0.85rem", color: isLiked ? "rgb(var(--accent-fg))" : "inherit" }}
                >
                  {isLiked ? "thumb_up" : "thumb_up_off_alt"}
                </span>
                {upvotes.length > 0 ? upvotes.length : "Like"}
              </button>
            )}
            <button
              onClick={() => setReplyingToKey(replyingToKey === node._id ? null : node._id)}
              className="feed-detail__comment-action"
            >
              <span className="material-icons" style={{ fontSize: "0.85rem" }}>reply</span>
              Reply
            </button>
            {renderDeleteButton(node, authorName)}
          </div>

          {replyingToKey === node._id &&
            renderReplyBox(node._id, `Replying to @${authorName}...`, () =>
              handleReplySubmit(node._id, authorName)
            )}

          {(replies.length > 0 || hiddenReplies > 0) && (
            <div className={threadClass}>
              {replies.map((reply) => renderCommentNode(reply, depth + 1))}
              {hiddenReplies > 0 && (
                <button
                  className="feed-detail__load-more feed-detail__load-more--replies"
                  onClick={() => handleLoadReplies(node._id)}
                  disabled={thread.loadingReplies[node._id]}
                >
                  {thread.loadingReplies[node._id]
                    ? "Loading replies..."
                    : `View ${hiddenReplies} more ${hiddenReplies === 1 ? "reply" : "replies"}`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderList = () => {
    if (thread.loading) {
      return (
        <div className="feed-detail__no-comments">
          <span className="material-icons feed-spin" style={{ fontSize: "1.6rem", color: "rgb(var(--accent-fg))" }}>refresh</span>
          <span>Loading comments...</span>
        </div>
      );
    }
    if (thread.error && thread.comments.length === 0) {
      return (
        <div className="feed-detail__no-comments">
          <span className="material-icons" style={{ fontSize: "2.5rem", color: "rgb(var(--fg-subtle))" }}>error_outline</span>
          <p>Couldn&apos;t load comments</p>
          <button className="feed-detail__load-more" onClick={thread.reload}>Try again</button>
        </div>
      );
    }
    if (thread.comments.length === 0) {
      return (
        <div className="feed-detail__no-comments">
          <span className="material-icons" style={{ fontSize: "2.5rem", color: "rgb(var(--fg-subtle))" }}>chat_bubble_outline</span>
          <p>No comments yet</p>
          <span>Be the first to share your thoughts!</span>
        </div>
      );
    }
    return (
      <>
        {thread.comments.map((c) => renderCommentNode(c, 0))}
        {thread.hasMore && (
          <button className="feed-detail__load-more" onClick={thread.loadMore} disabled={thread.loadingMore}>
            {thread.loadingMore ? "Loading..." : "Load more comments"}
          </button>
        )}
      </>
    );
  };

  return (
    <div className="feed-detail__right">
      <div className="feed-detail__comments-header">
        <span className="material-icons" style={{ color: "rgb(var(--accent-fg))", fontSize: "1.2rem" }}>forum</span>
        <h3>Comments</h3>
        <span className="feed-detail__comments-count">{commentsCount}</span>
      </div>

      <div className="feed-detail__comments-list custom-scrollbar">{renderList()}</div>

      <div className="feed-detail__comment-input-area">
        <form onSubmit={handleCommentSubmit} className="feed-detail__comment-form">
          <Avatar src={user?.avatar} className="feed-detail__comment-input-avatar" />

          <div className="feed-detail__emoji-wrap" ref={emojiRef}>
            <button
              type="button"
              className="feed-detail__emoji-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              aria-label="Pick emoji"
              disabled={!user}
            >
              <span className="material-icons">sentiment_satisfied_alt</span>
            </button>
            {showEmojiPicker && (
              <div className="feed-detail__emoji-picker-wrap">
                <Suspense fallback={null}>
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    theme={theme}
                    skinTonesDisabled
                    searchDisabled={false}
                    height={380}
                    width={300}
                    lazyLoadEmojis
                  />
                </Suspense>
              </div>
            )}
          </div>

          <input
            ref={commentInputRef}
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={user ? "Add a comment..." : "Log in to comment"}
            className="feed-detail__comment-input"
            disabled={!user}
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={commentLoading || !user || !commentText.trim()}
            className="feed-detail__comment-send"
            aria-label="Send comment"
          >
            {commentLoading ? (
              <span className="material-icons feed-spin">refresh</span>
            ) : (
              <span className="material-icons">send</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PostCommentsPanel;

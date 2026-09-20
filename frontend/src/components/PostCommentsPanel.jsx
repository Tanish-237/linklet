import React, { useRef, useState, useEffect, lazy, Suspense } from "react";
import { toast } from "react-toastify";
import defaultAvatar from "../assets/default-avatar.webp";
import usePostComments from "../hooks/usePostComments";
import { formatTime } from "../utlis/formatTime";
import { optimizeAvatar } from "../utlis/cloudinary";
import "../pages/Posts.css";

// The emoji picker is ~360 KB; it's only fetched the first time someone opens it.
const EmojiPicker = lazy(() => import("emoji-picker-react"));

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

  const handleReplySubmit = async (commentId, replyToUser) => {
    const text = replyTextMap[replyingToKey];
    if (!text || !text.trim() || !user) return;
    try {
      await thread.addReply(commentId, text.trim(), replyToUser);
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
        <span className="material-icons" style={{ fontSize: "0.85rem", color: "#f87171" }}>delete_outline</span>
        Delete
      </button>
    );
  };

  const renderReply = (comment, reply) => {
    const replyUser = reply.userId || {};
    const replyAuthorName = replyUser.username || "User";
    const replyKey = `${comment._id}-${reply._id}`;

    return (
      <div key={reply._id} className="feed-detail__reply-node">
        <div className="feed-detail__comment-card feed-detail__comment-card--reply">
          <div className="feed-detail__comment-header">
            <Avatar src={replyUser.avatar} className="feed-detail__comment-avatar" />
            <span
              className="feed-detail__comment-author"
              onClick={() => onNavigateToProfile?.(replyAuthorName)}
            >
              {replyAuthorName}
            </span>
            <span className="feed-detail__comment-time">· {formatTime(reply.createdAt)}</span>
          </div>
          <p className="feed-detail__comment-body">
            {reply.replyToUsername && <span className="feed-detail__mention">@{reply.replyToUsername} </span>}
            {reply.text}
          </p>
          <div className="feed-detail__comment-footer">
            <button
              onClick={() => setReplyingToKey(replyingToKey === replyKey ? null : replyKey)}
              className="feed-detail__comment-action"
            >
              <span className="material-icons" style={{ fontSize: "0.85rem" }}>reply</span>
              Reply
            </button>
            {renderDeleteButton(reply, replyAuthorName)}
          </div>
          {replyingToKey === replyKey &&
            renderReplyBox(replyKey, `Replying to @${replyAuthorName}...`, () =>
              handleReplySubmit(comment._id, replyAuthorName)
            )}
        </div>
      </div>
    );
  };

  const renderComment = (comment) => {
    const commentUser = comment.userId || {};
    const commentAuthorName = commentUser.username || "User";
    const commentUpvotes = comment.upvotes || [];
    const isCommentLiked = commentUpvotes.some((id) => idOf(id) === currentUserId);
    const replies = comment.replies || [];
    const hiddenReplies = Math.max(0, (comment.repliesCount || 0) - replies.length);

    return (
      <div key={comment._id} className="feed-detail__comment-node">
        <div className="feed-detail__comment-card">
          <div className="feed-detail__comment-header">
            <Avatar src={commentUser.avatar} className="feed-detail__comment-avatar" />
            <span
              className="feed-detail__comment-author"
              onClick={() => onNavigateToProfile?.(commentAuthorName)}
            >
              {commentAuthorName}
            </span>
            <span className="feed-detail__comment-time">· {formatTime(comment.createdAt)}</span>
          </div>
          <p className="feed-detail__comment-body">{comment.text}</p>
          <div className="feed-detail__comment-footer">
            <button
              onClick={() => handleLike(comment._id)}
              className={`feed-detail__comment-action ${isCommentLiked ? "liked" : ""}`}
            >
              <span
                className="material-icons"
                style={{ fontSize: "0.85rem", color: isCommentLiked ? "#a78bfa" : "inherit" }}
              >
                {isCommentLiked ? "thumb_up" : "thumb_up_off_alt"}
              </span>
              {commentUpvotes.length > 0 ? commentUpvotes.length : "Like"}
            </button>
            <button
              onClick={() => setReplyingToKey(replyingToKey === comment._id ? null : comment._id)}
              className="feed-detail__comment-action"
            >
              <span className="material-icons" style={{ fontSize: "0.85rem" }}>reply</span>
              Reply
            </button>
            {renderDeleteButton(comment, commentAuthorName)}
          </div>

          {replyingToKey === comment._id &&
            renderReplyBox(comment._id, `Replying to @${commentAuthorName}...`, () =>
              handleReplySubmit(comment._id, commentAuthorName)
            )}

          {(replies.length > 0 || hiddenReplies > 0) && (
            <div className="feed-detail__reply-thread">
              {replies.map((reply) => renderReply(comment, reply))}
              {hiddenReplies > 0 && (
                <button
                  className="feed-detail__load-more feed-detail__load-more--replies"
                  onClick={() => handleLoadReplies(comment._id)}
                  disabled={thread.loadingReplies[comment._id]}
                >
                  {thread.loadingReplies[comment._id]
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
          <span className="material-icons feed-spin" style={{ fontSize: "1.6rem", color: "#a78bfa" }}>refresh</span>
          <span>Loading comments...</span>
        </div>
      );
    }
    if (thread.error && thread.comments.length === 0) {
      return (
        <div className="feed-detail__no-comments">
          <span className="material-icons" style={{ fontSize: "2.5rem", color: "#374151" }}>error_outline</span>
          <p>Couldn&apos;t load comments</p>
          <button className="feed-detail__load-more" onClick={thread.reload}>Try again</button>
        </div>
      );
    }
    if (thread.comments.length === 0) {
      return (
        <div className="feed-detail__no-comments">
          <span className="material-icons" style={{ fontSize: "2.5rem", color: "#374151" }}>chat_bubble_outline</span>
          <p>No comments yet</p>
          <span>Be the first to share your thoughts!</span>
        </div>
      );
    }
    return (
      <>
        {thread.comments.map(renderComment)}
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
        <span className="material-icons" style={{ color: "#a78bfa", fontSize: "1.2rem" }}>forum</span>
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
                    theme="dark"
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

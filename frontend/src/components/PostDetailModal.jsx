import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import EmojiPicker from "emoji-picker-react";
import { apiClient } from "../api/apiClient";
import defaultAvatar from "../assets/default-avatar.png";

// Time Helper
export const formatTime = (dateString) => {
  if (!dateString) return "just now";
  const now = Date.now();
  const created = new Date(dateString).getTime();
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const PostDetailModal = ({ isOpen, onClose, post, user, onPostUpdated = () => {} }) => {
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [replyTextMap, setReplyTextMap] = useState({});
  const [replyingToKey, setReplyingToKey] = useState(null);
  const [localPost, setLocalPost] = useState(post);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const modalRef = useRef(null);
  const shareRef = useRef(null);
  const emojiRef = useRef(null);
  const commentInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLocalPost(post);
  }, [post]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !localPost || !user) return;
    try {
      setCommentLoading(true);
      const res = await apiClient.post(`/posts/${localPost._id}/comment`, { text: commentText });
      const updatedPost = res.data.data;
      setLocalPost(updatedPost);
      onPostUpdated(updatedPost);
      setCommentText("");
      toast.success("Comment added");
    } catch (error) {
      console.error("Comment error:", error);
      toast.error("Error adding comment");
    } finally {
      setCommentLoading(false);
    }
  };

  const handleReplySubmit = async (commentId, replyToUser) => {
    const text = replyTextMap[replyingToKey];
    if (!text || !text.trim() || !user) return;
    try {
      const res = await apiClient.post(`/posts/${localPost._id}/comments/${commentId}/reply`, {
        text: text.trim(),
        replyToUsername: replyToUser,
      });
      const updatedPost = res.data.data;
      setLocalPost(updatedPost);
      onPostUpdated(updatedPost);
      setReplyTextMap((prev) => ({ ...prev, [replyingToKey]: "" }));
      setReplyingToKey(null);
      toast.success("Reply added");
    } catch {
      toast.error("Error adding reply");
    }
  };

  const handleToggleCommentUpvote = async (commentId) => {
    if (!user) {
      toast.info("Please log in to vote");
      return;
    }
    try {
      const res = await apiClient.post(`/posts/${localPost._id}/comments/${commentId}/upvote`);
      const updatedPost = res.data.data;
      setLocalPost(updatedPost);
      onPostUpdated(updatedPost);
    } catch {
      toast.error("Error voting on comment");
    }
  };

  const handleUpvote = async () => {
    if (!user) {
      toast.info("Please log in to vote");
      return;
    }
    try {
      const res = await apiClient.post(`/posts/${localPost._id}/upvote`);
      const updated = res.data.data;
      setLocalPost(updated);
      onPostUpdated(updated);
    } catch {
      toast.error("Error voting");
    }
  };

  const handleDownvote = async () => {
    if (!user) {
      toast.info("Please log in to vote");
      return;
    }
    try {
      const res = await apiClient.post(`/posts/${localPost._id}/downvote`);
      const updated = res.data.data;
      setLocalPost(updated);
      onPostUpdated(updated);
    } catch {
      toast.error("Error voting");
    }
  };

  const handleShare = async (platform) => {
    if (!localPost) return;
    const url = `${window.location.origin}/posts/${localPost._id}`;
    const text = `Check out this post on Linklet: ${localPost.caption || ""}`;
    switch (platform) {
      case "copy":
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard!");
        break;
      case "twitter":
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
        break;
      case "linkedin":
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`);
        break;
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`);
        break;
    }
    setShowShareMenu(false);
  };

  const handleEmojiClick = (emojiData) => {
    const emoji = emojiData.emoji;
    const input = commentInputRef.current;
    if (input) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const newText = commentText.slice(0, start) + emoji + commentText.slice(end);
      setCommentText(newText);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setCommentText((prev) => prev + emoji);
    }
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) setShowShareMenu(false);
    };
    if (showShareMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showShareMenu]);

  useEffect(() => {
    const handleClick = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmojiPicker(false);
    };
    if (showEmojiPicker) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojiPicker]);

  if (!isOpen || !localPost) return null;

  const currentUserId = user?._id || user?.id;
  const isUpvoted = localPost.upvotes?.some((id) => (id._id || id)?.toString() === currentUserId?.toString());
  const isDownvoted = localPost.downvotes?.some((id) => (id._id || id)?.toString() === currentUserId?.toString());
  const netVotes = (localPost.upvotes?.length || 0) - (localPost.downvotes?.length || 0);

  const postAuthor = localPost.userId || localPost.user || {};
  const postUsername = postAuthor.username || "User";
  const postAvatar = postAuthor.avatar || defaultAvatar;

  return (
    <div className="feed-detail-backdrop" onClick={handleBackdropClick}>
      <div ref={modalRef} className="feed-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button onClick={onClose} className="feed-detail__close-btn" aria-label="Close">
          <span className="material-icons">close</span>
        </button>

        {/* Left Side: Post Content */}
        <div className="feed-detail__left">
          {/* Post Header */}
          <div className="feed-detail__header">
            <img src={postAvatar} alt="" className="feed-detail__avatar" />
            <div className="feed-detail__user-info">
              <span
                className="feed-detail__username"
                onClick={() => {
                  onClose();
                  navigate(`/dashboard/profile/${postUsername}`);
                }}
              >
                {postUsername}
              </span>
              <span className="feed-detail__time">{formatTime(localPost.createdAt)}</span>
            </div>
          </div>

          {/* Caption */}
          {localPost.caption && (
            <div className="feed-detail__caption">
              <p>{localPost.caption}</p>
            </div>
          )}

          {/* Image */}
          {localPost.image && (
            <div className="feed-detail__media">
              <img src={localPost.image} alt="" className="feed-detail__image" />
            </div>
          )}

          {/* Actions bar in modal */}
          <div className="feed-detail__actions">
            <div className="feed-card__vote-pill">
              <button
                onClick={handleUpvote}
                className={`feed-card__vote-btn feed-card__vote-btn--up ${isUpvoted ? "feed-card__vote-btn--active-up" : ""}`}
              >
                <span className="material-icons">north</span>
              </button>
              <span className={`feed-card__vote-count ${netVotes > 0 ? "feed-card__vote-count--positive" : netVotes < 0 ? "feed-card__vote-count--negative" : ""}`}>
                {netVotes}
              </span>
              <button
                onClick={handleDownvote}
                className={`feed-card__vote-btn feed-card__vote-btn--down ${isDownvoted ? "feed-card__vote-btn--active-down" : ""}`}
              >
                <span className="material-icons">south</span>
              </button>
            </div>
            <span className="feed-detail__comment-count">
              <span className="material-icons" style={{ fontSize: "1.1rem" }}>chat_bubble_outline</span>
              {localPost.comments?.length || 0} comments
            </span>

            {/* Share button with dropdown */}
            <div className="feed-card__share-wrap" ref={shareRef} style={{ marginLeft: "auto" }}>
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="feed-card__share-btn"
                aria-label="Share post"
              >
                <span className="material-icons">share</span>
              </button>
              {showShareMenu && (
                <div className="feed-card__share-menu">
                  <button onClick={() => handleShare("copy")} className="feed-card__share-option">
                    <span className="material-icons">link</span>
                    Copy Link
                  </button>
                  <button onClick={() => handleShare("twitter")} className="feed-card__share-option">
                    <span className="material-icons">tag</span>
                    Twitter / X
                  </button>
                  <button onClick={() => handleShare("linkedin")} className="feed-card__share-option">
                    <span className="material-icons">work</span>
                    LinkedIn
                  </button>
                  <button onClick={() => handleShare("whatsapp")} className="feed-card__share-option">
                    <span className="material-icons">chat</span>
                    WhatsApp
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Comments */}
        <div className="feed-detail__right">
          <div className="feed-detail__comments-header">
            <span className="material-icons" style={{ color: "#a78bfa", fontSize: "1.2rem" }}>forum</span>
            <h3>Comments</h3>
            <span className="feed-detail__comments-count">{localPost.comments?.length || 0}</span>
          </div>

          {/* Comments List */}
          <div className="feed-detail__comments-list custom-scrollbar">
            {(!localPost.comments || localPost.comments.length === 0) ? (
              <div className="feed-detail__no-comments">
                <span className="material-icons" style={{ fontSize: "2.5rem", color: "#374151" }}>chat_bubble_outline</span>
                <p>No comments yet</p>
                <span>Be the first to share your thoughts!</span>
              </div>
            ) : (
              localPost.comments.map((comment) => {
                const commentUser = comment.userId || comment.user || {};
                const commentAuthorName = commentUser.username || "User";
                const commentAvatar = commentUser.avatar || defaultAvatar;
                const commentUpvotes = comment.upvotes || [];
                const isCommentLiked = commentUpvotes.some((id) => (id._id || id)?.toString() === currentUserId?.toString());

                return (
                  <div key={comment._id} className="feed-detail__comment-node">
                    <div className="feed-detail__comment-card">
                      <div className="feed-detail__comment-header">
                        <img src={commentAvatar} alt="" className="feed-detail__comment-avatar" />
                        <span
                          className="feed-detail__comment-author"
                          onClick={() => {
                            onClose();
                            navigate(`/dashboard/profile/${commentAuthorName}`);
                          }}
                        >
                          {commentAuthorName}
                        </span>
                        <span className="feed-detail__comment-time">· {formatTime(comment.createdAt)}</span>
                      </div>
                      <p className="feed-detail__comment-body">{comment.text}</p>
                      <div className="feed-detail__comment-footer">
                        <button
                          onClick={() => handleToggleCommentUpvote(comment._id)}
                          className={`feed-detail__comment-action ${isCommentLiked ? "liked" : ""}`}
                        >
                          <span className="material-icons" style={{ fontSize: "0.85rem", color: isCommentLiked ? "#a78bfa" : "inherit" }}>
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
                      </div>

                      {/* Reply Input Box for Top-level Comment */}
                      {replyingToKey === comment._id && (
                        <div className="feed-detail__reply-box">
                          <input
                            type="text"
                            placeholder={`Replying to @${commentAuthorName}...`}
                            value={replyTextMap[comment._id] || ""}
                            onChange={(e) => setReplyTextMap({ ...replyTextMap, [comment._id]: e.target.value })}
                            className="feed-detail__reply-input"
                            autoFocus
                          />
                          <div className="feed-detail__reply-actions">
                            <button onClick={() => setReplyingToKey(null)} className="feed-detail__reply-cancel">Cancel</button>
                            <button onClick={() => handleReplySubmit(comment._id, commentAuthorName)} className="feed-detail__reply-submit">Reply</button>
                          </div>
                        </div>
                      )}

                      {/* Nested Replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="feed-detail__reply-thread">
                          {comment.replies.map((reply) => {
                            const replyUser = reply.userId || reply.user || {};
                            const replyAuthorName = replyUser.username || "User";
                            const replyAvatar = replyUser.avatar || defaultAvatar;
                            const replyKey = `${comment._id}-${reply._id}`;

                            return (
                              <div key={reply._id} className="feed-detail__reply-node">
                                <div className="feed-detail__comment-card feed-detail__comment-card--reply">
                                  <div className="feed-detail__comment-header">
                                    <img src={replyAvatar} alt="" className="feed-detail__comment-avatar" />
                                    <span
                                      className="feed-detail__comment-author"
                                      onClick={() => {
                                        onClose();
                                        navigate(`/dashboard/profile/${replyAuthorName}`);
                                      }}
                                    >
                                      {replyAuthorName}
                                    </span>
                                    <span className="feed-detail__comment-time">· {formatTime(reply.createdAt)}</span>
                                  </div>
                                  <p className="feed-detail__comment-body">
                                    {reply.replyToUsername && (
                                      <span className="feed-detail__mention">@{reply.replyToUsername} </span>
                                    )}
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
                                  </div>

                                  {/* Inline Reply Input for a Reply */}
                                  {replyingToKey === replyKey && (
                                    <div className="feed-detail__reply-box">
                                      <input
                                        type="text"
                                        placeholder={`Replying to @${replyAuthorName}...`}
                                        value={replyTextMap[replyKey] || ""}
                                        onChange={(e) => setReplyTextMap({ ...replyTextMap, [replyKey]: e.target.value })}
                                        className="feed-detail__reply-input"
                                        autoFocus
                                      />
                                      <div className="feed-detail__reply-actions">
                                        <button onClick={() => setReplyingToKey(null)} className="feed-detail__reply-cancel">Cancel</button>
                                        <button onClick={() => handleReplySubmit(comment._id, replyAuthorName)} className="feed-detail__reply-submit">Reply</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Comment Input */}
          <div className="feed-detail__comment-input-area">
            <form onSubmit={handleCommentSubmit} className="feed-detail__comment-form">
              <img src={user?.avatar || defaultAvatar} alt="" className="feed-detail__comment-input-avatar" />

              {/* Emoji Picker Trigger */}
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
                    <EmojiPicker
                      onEmojiClick={handleEmojiClick}
                      theme="dark"
                      skinTonesDisabled
                      searchDisabled={false}
                      height={380}
                      width={300}
                      lazyLoadEmojis
                    />
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
              />
              <button type="submit" disabled={commentLoading || !user || !commentText.trim()} className="feed-detail__comment-send">
                {commentLoading ? (
                  <span className="material-icons feed-spin">refresh</span>
                ) : (
                  <span className="material-icons">send</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostDetailModal;

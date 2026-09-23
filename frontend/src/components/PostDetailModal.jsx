import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "../api/apiClient";
import defaultAvatar from "../assets/default-avatar.webp";
import PostCommentsPanel from "./PostCommentsPanel";
import SharePostMenu from "./SharePostMenu";
import PostActionsMenu from "./PostActionsMenu";
import { formatTime } from "../utlis/formatTime";
import { optimizeAvatar, optimizeImage, buildSrcSet } from "../utlis/cloudinary";
import "../pages/Posts.css";

const PostDetailModal = ({
  isOpen,
  onClose,
  post,
  user,
  onPostUpdated = () => {},
  onDeletePost = () => {},
  onEditPost = () => {},
  onReportPost = () => {},
}) => {
  const [localPost, setLocalPost] = useState(post);

  const modalRef = useRef(null);
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

  // Keep the post's comment total in sync with what the panel just did
  // (add / delete), for this modal AND the feed card behind it.
  const handleCommentsCountChange = (commentsCount) => {
    setLocalPost((prev) => (prev ? { ...prev, commentsCount } : prev));
    onPostUpdated({ ...localPost, commentsCount });
  };

  if (!isOpen || !localPost) return null;

  const currentUserId = user?._id || user?.id;
  const isUpvoted = localPost.upvotes?.some((id) => (id._id || id)?.toString() === currentUserId?.toString());
  const isDownvoted = localPost.downvotes?.some((id) => (id._id || id)?.toString() === currentUserId?.toString());
  const netVotes = (localPost.upvotes?.length || 0) - (localPost.downvotes?.length || 0);

  const postAuthor = localPost.userId || localPost.user || {};
  const postAuthorId = (postAuthor._id || postAuthor.id || postAuthor)?.toString();
  const canDeletePost = currentUserId && (postAuthorId === currentUserId?.toString() || user?.role === "admin");
  const postUsername = postAuthor.username || "User";
  const postAvatar = optimizeAvatar(postAuthor.avatar, 40) || defaultAvatar;

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
                  navigate(`/profile/${postUsername}`);
                }}
              >
                {postUsername}
              </span>
              <span className="feed-detail__time">
                {formatTime(localPost.createdAt)}
                {localPost.isEdited && <span className="feed-detail__edited-tag"> · edited</span>}
              </span>
            </div>

            <PostActionsMenu
              className="ml-auto"
              canManage={canDeletePost}
              onEdit={() => onEditPost(localPost)}
              onDelete={() => onDeletePost(localPost._id)}
              onReport={user ? () => onReportPost(localPost._id) : undefined}
              deleteTitle={user?.role === "admin" && postAuthorId !== currentUserId?.toString() ? "Delete Post (Admin Moderation)" : "Delete Post"}
            />
          </div>

          {/* Caption */}
          {localPost.caption && (
            <div className="feed-detail__caption">
              <p>{localPost.caption}</p>
            </div>
          )}

          {/* Image / Video */}
          {localPost.image && (
            <div className="feed-detail__media">
              {localPost.mediaType === "video" ? (
                <video src={localPost.image} controls className="feed-detail__image" preload="metadata" />
              ) : (
                <img
                  src={optimizeImage(localPost.image, { width: 1200 })}
                  srcSet={buildSrcSet(localPost.image)}
                  sizes="(max-width: 900px) 100vw, 60vw"
                  alt=""
                  className="feed-detail__image"
                  decoding="async"
                />
              )}
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
              {localPost.commentsCount || 0} comments
            </span>

            {/* Share button with dropdown */}
            <SharePostMenu
              className="ml-auto"
              getUrl={() => `${window.location.origin}/posts/${localPost._id}`}
              shareText={`Check out this post on Linklet: ${localPost.caption || ""}`}
            />
          </div>
        </div>

        {/* Right Side: Comments */}
        <PostCommentsPanel
          postId={localPost._id}
          commentsCount={localPost.commentsCount || 0}
          onCountChange={handleCommentsCountChange}
          user={user}
          onNavigateToProfile={(username) => {
            onClose();
            navigate(`/profile/${username}`);
          }}
        />
      </div>
    </div>
  );
};

export default PostDetailModal;

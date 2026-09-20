import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiClient } from "../api/apiClient";
import defaultAvatar from "../assets/default-avatar.webp";
import PostCommentsPanel from "./PostCommentsPanel";
import { formatTime } from "../utlis/formatTime";
import { optimizeAvatar, optimizeImage, buildSrcSet } from "../utlis/cloudinary";
import "../pages/Posts.css";

const PostDetailModal = ({ isOpen, onClose, post, user, onPostUpdated = () => {}, onDeletePost = () => {} }) => {
  const [localPost, setLocalPost] = useState(post);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const modalRef = useRef(null);
  const shareRef = useRef(null);
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

  useEffect(() => {
    const handleClick = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) setShowShareMenu(false);
    };
    if (showShareMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showShareMenu]);


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
                  navigate(`/dashboard/profile/${postUsername}`);
                }}
              >
                {postUsername}
              </span>
              <span className="feed-detail__time">{formatTime(localPost.createdAt)}</span>
            </div>

            {canDeletePost && (
              <button
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto cursor-pointer flex items-center gap-1"
                onClick={() => onDeletePost(localPost._id)}
                title={user?.role === "admin" && postAuthorId !== currentUserId?.toString() ? "Delete Post (Admin Moderation)" : "Delete Post"}
                aria-label="Delete post"
              >
                <span className="material-icons text-base">delete_outline</span>
              </button>
            )}
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
              <img
                src={optimizeImage(localPost.image, { width: 1200 })}
                srcSet={buildSrcSet(localPost.image)}
                sizes="(max-width: 900px) 100vw, 60vw"
                alt=""
                className="feed-detail__image"
                decoding="async"
              />
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
        <PostCommentsPanel
          postId={localPost._id}
          commentsCount={localPost.commentsCount || 0}
          onCountChange={handleCommentsCountChange}
          user={user}
          onNavigateToProfile={(username) => {
            onClose();
            navigate(`/dashboard/profile/${username}`);
          }}
        />
      </div>
    </div>
  );
};

export default PostDetailModal;

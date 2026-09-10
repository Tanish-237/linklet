// src/pages/Posts.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/apiClient";
import { deletePost } from "../api/post.api";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import defaultAvatar from "../assets/default-avatar.png";
import PostDetailModal, { formatTime } from "../components/PostDetailModal";
import "./Posts.css";



// ─── Create Post Modal ──────────────────────────────────────────────────────
const CreatePostModal = ({ isOpen, onClose, user, onPostCreated }) => {
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const modalRef = useRef(null);
  const MAX_CAPTION_LENGTH = 2000;

  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
  };

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose]);

  const handleImageChange = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image size should be less than 5MB"); return; }
    const validTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif"];
    if (!validTypes.includes(file.type)) { toast.error("Please upload an image file (JPEG, PNG, GIF)"); return; }
    setImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleImageChange(e.dataTransfer.files[0]);
  };

  const handleRemoveImage = () => {
    setImage(null); setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!caption.trim() && !image) { toast.error("Please add a caption or image"); return; }
    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append("caption", caption);
      if (image) formData.append("image", image);
      const response = await apiClient.post(`/posts`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (response.data.success) {
        toast.success("Post created successfully!");
        setCaption(""); setImage(null); setImagePreview(null);
        onPostCreated(); onClose();
      }
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error(error.response?.data?.message || "Failed to create post.");
    } finally { setIsSubmitting(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="feed-modal-backdrop" onClick={handleBackdropClick}>
      <div ref={modalRef} className="feed-create-modal" onClick={(e) => e.stopPropagation()}>
        <div className="feed-create-modal__header">
          <h2 className="feed-create-modal__title">Create Post</h2>
          <button onClick={onClose} className="feed-create-modal__close" aria-label="Close">
            <span className="material-icons">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="feed-create-modal__body">
          <div className="feed-create-modal__user">
            <img src={user?.avatar || defaultAvatar} alt={user?.username} className="feed-create-modal__avatar" />
            <div>
              <span className="feed-create-modal__username">{user?.username || "You"}</span>
              <span className="feed-create-modal__badge">Creating Post</span>
            </div>
          </div>
          <textarea
            value={caption}
            onChange={(e) => { if (e.target.value.length <= MAX_CAPTION_LENGTH) setCaption(e.target.value); }}
            placeholder="What's on your mind? Share your thoughts..."
            className="feed-create-modal__textarea"
            rows={5}
          />
          <div className="feed-create-modal__char-count">
            <span>{caption.length}/{MAX_CAPTION_LENGTH}</span>
          </div>
          {imagePreview && (
            <div className="feed-create-modal__preview">
              <img src={imagePreview} alt="Preview" />
              <button type="button" onClick={handleRemoveImage} className="feed-create-modal__preview-remove">
                <span className="material-icons">close</span>
              </button>
            </div>
          )}
          {!imagePreview && (
            <div
              className={`feed-create-modal__dropzone ${dragActive ? "feed-create-modal__dropzone--active" : ""}`}
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="material-icons feed-create-modal__dropzone-icon">cloud_upload</span>
              <p className="feed-create-modal__dropzone-text">Drag & drop an image or <span>click to browse</span></p>
              <p className="feed-create-modal__dropzone-hint">JPEG, PNG, GIF • Max 5MB</p>
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={(e) => handleImageChange(e.target.files[0])} style={{ display: "none" }} accept="image/*" />
          <div className="feed-create-modal__footer">
            <div className="feed-create-modal__tools">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="feed-create-modal__tool-btn" title="Add Photo">
                <span className="material-icons" style={{ color: "#60a5fa" }}>image</span>
              </button>
              <button type="button" className="feed-create-modal__tool-btn" title="Tag People">
                <span className="material-icons" style={{ color: "#34d399" }}>tag</span>
              </button>
              <button type="button" className="feed-create-modal__tool-btn" title="Mood">
                <span className="material-icons" style={{ color: "#fbbf24" }}>mood</span>
              </button>
            </div>
            <div className="feed-create-modal__actions">
              <button type="button" onClick={onClose} className="feed-create-modal__cancel-btn">Cancel</button>
              <button type="submit" disabled={isSubmitting || (!caption.trim() && !image)} className="feed-create-modal__submit-btn">
                {isSubmitting ? (<><span className="material-icons feed-spin">refresh</span>Posting...</>) : (<><span className="material-icons">send</span>Post</>)}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Post Detail Modal is imported from components/PostDetailModal ───────────

// ─── Post Card ──────────────────────────────────────────────────────────────
const PostCard = ({ post, user, onUpvote, onDownvote, onOpenComments, onSaveToCollection, isSaved, onDeletePost }) => {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareRef = useRef(null);
  const navigate = useNavigate();

  const upvoteCount = post.upvotes?.length || 0;
  const downvoteCount = post.downvotes?.length || 0;
  const netVotes = upvoteCount - downvoteCount;
  const currentUserId = user?._id || user?.id;
  const isUpvoted = post.upvotes?.some((id) => (id._id || id)?.toString() === currentUserId?.toString());
  const isDownvoted = post.downvotes?.some((id) => (id._id || id)?.toString() === currentUserId?.toString());
  const commentCount = post.comments?.length || 0;

  useEffect(() => {
    const handleClick = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) setShowShareMenu(false);
    };
    if (showShareMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showShareMenu]);

  const handleShare = async (platform) => {
    const url = `${window.location.origin}/posts/${post._id}`;
    const text = `Check out this post on Linklet: ${post.caption || ""}`;
    switch (platform) {
      case "twitter":
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
        break;
      case "linkedin":
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`);
        break;
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`);
        break;
      case "copy":
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard!");
        break;
    }
    setShowShareMenu(false);
  };

  const author = post.userId || post.user || {};
  const authorId = (author._id || author.id || author)?.toString();
  const canDelete = currentUserId && (authorId === currentUserId?.toString() || user?.role === "admin");
  const username = author.username || "User";
  const avatar = author.avatar || defaultAvatar;

  return (
    <div className="feed-card">
      {/* Header: Avatar + Username + Bookmark toggle */}
      <div className="feed-card__header">
        <img src={avatar} alt="Profile" className="feed-card__avatar" />
        <div className="feed-card__user-info">
          <span
            className="feed-card__username"
            onClick={() => navigate(`/dashboard/profile/${username}`)}
          >
            {username}
          </span>
          <span className="feed-card__time">{formatTime(post.createdAt)}</span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {canDelete && (
            <button
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onDeletePost(post._id);
              }}
              title={user?.role === "admin" && authorId !== currentUserId?.toString() ? "Delete Post (Admin Moderation)" : "Delete Post"}
              aria-label="Delete post"
            >
              <span className="material-icons text-base">delete_outline</span>
            </button>
          )}

          {/* ONLY Single Bookmark Button (Triggers Save to Collection Modal like Global Search) */}
          <button
            className={`feed-card__save-btn ${isSaved ? "feed-card__save-btn--saved" : ""}`}
            onClick={(e) => { e.stopPropagation(); onSaveToCollection(post._id); }}
            title={isSaved ? "Remove / Manage Collections" : "Save to Collection"}
          >
            <span className="material-icons">{isSaved ? "bookmark" : "bookmark_border"}</span>
          </button>
        </div>
      </div>

      {/* Caption / Description */}
      {post.caption && (
        <div className="feed-card__caption">
          <p>{post.caption}</p>
        </div>
      )}

      {/* Media: Image / Video */}
      {post.image && (
        <div className="feed-card__media" onClick={() => onOpenComments(post)}>
          <img src={post.image} alt="" className="feed-card__image" />
        </div>
      )}

      {/* Actions Bar */}
      <div className="feed-card__actions">
        {/* Vote Pill Matching Screenshot */}
        <div className="feed-card__vote-pill">
          <button
            onClick={(e) => onUpvote(post._id, e)}
            className={`feed-card__vote-btn feed-card__vote-btn--up ${isUpvoted ? "feed-card__vote-btn--active-up" : ""}`}
            aria-label="Upvote"
          >
            <span className="material-icons">north</span>
          </button>
          <span className={`feed-card__vote-count ${netVotes > 0 ? "feed-card__vote-count--positive" : netVotes < 0 ? "feed-card__vote-count--negative" : ""}`}>
            {netVotes}
          </span>
          <button
            onClick={(e) => onDownvote(post._id, e)}
            className={`feed-card__vote-btn feed-card__vote-btn--down ${isDownvoted ? "feed-card__vote-btn--active-down" : ""}`}
            aria-label="Downvote"
          >
            <span className="material-icons">south</span>
          </button>
        </div>

        {/* Comment Button */}
        <button onClick={() => onOpenComments(post)} className="feed-card__comment-btn">
          <span className="material-icons">chat_bubble_outline</span>
          {commentCount > 0 && <span className="feed-card__comment-count">{commentCount}</span>}
        </button>

        {/* Share Button */}
        <div className="feed-card__share-wrap" ref={shareRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowShareMenu(!showShareMenu); }}
            className="feed-card__share-btn"
            aria-label="Share"
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
  );
};

// ─── Main Posts Component ───────────────────────────────────────────────────
const Posts = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  // In-memory cached feed query with 5-minute freshness (0ms instant render on tab switch)
  const {
    data: feedData = [],
    isLoading: isFeedLoading,
    refetch: fetchPosts,
  } = useQuery({
    queryKey: ["posts", "feed"],
    queryFn: async () => {
      const res = await apiClient.get(`/posts/feed?limit=50`);
      return res.data.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const [posts, setPosts] = useState(feedData);

  useEffect(() => {
    if (feedData) setPosts(feedData);
  }, [feedData]);

  const loading = isFeedLoading && posts.length === 0;

  // Bookmark state with in-memory caching
  const { data: bookmarkIds = [] } = useQuery({
    queryKey: ["bookmarks", user?._id],
    queryFn: async () => {
      const res = await apiClient.get("/profile/me/bookmarks");
      return (res.data.data || []).map((b) => (b._id || b).toString());
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const [savedPosts, setSavedPosts] = useState(new Set(bookmarkIds));

  useEffect(() => {
    if (bookmarkIds) setSavedPosts(new Set(bookmarkIds));
  }, [bookmarkIds]);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);


  const handleUpvote = async (postId, e) => {
    e.stopPropagation();
    if (!user) { toast.info("Please log in to vote"); return; }
    try {
      const res = await apiClient.post(`/posts/${postId}/upvote`);
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId ? res.data.data : p
        )
      );
      if (selectedPost && selectedPost._id === postId) {
        setSelectedPost(res.data.data);
      }
    } catch (error) {
      console.error("Upvote error:", error);
      toast.error("Error voting on post");
    }
  };

  const handleDownvote = async (postId, e) => {
    e.stopPropagation();
    if (!user) { toast.info("Please log in to vote"); return; }
    try {
      const res = await apiClient.post(`/posts/${postId}/downvote`);
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId ? res.data.data : p
        )
      );
      if (selectedPost && selectedPost._id === postId) {
        setSelectedPost(res.data.data);
      }
    } catch (error) {
      console.error("Downvote error:", error);
      toast.error("Error voting on post");
    }
  };

  const handleSaveToCollection = async (postId) => {
    if (!user) { toast.info("Please log in to save posts"); return; }
    try {
      const res = await apiClient.post(`/profile/bookmarks/${postId}`);
      if (res.data.bookmarked) {
        setSavedPosts((prev) => new Set([...prev, postId.toString()]));
        toast.success("Post saved to collection");
      } else {
        setSavedPosts((prev) => {
          const next = new Set(prev);
          next.delete(postId.toString());
          return next;
        });
        toast.info("Post removed from saved collection");
      }
    } catch {
      toast.error("Failed to update saved post");
    }
  };

  const handleOpenComments = (post) => {
    setSelectedPost(post);
    setShowDetailModal(true);
  };

  const handlePostUpdated = (updatedPost) => {
    setPosts((prev) =>
      prev.map((p) => (p._id === updatedPost._id ? updatedPost : p))
    );
    setSelectedPost(updatedPost);
  };

  const handleCreatePost = () => {
    if (!user) { toast.info("Please log in to create a post"); return; }
    setShowCreateModal(true);
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
      if (selectedPost && selectedPost._id === postId) {
        setShowDetailModal(false);
        setSelectedPost(null);
      }
      toast.success("Post deleted successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete post");
    }
  };

  return (
    <div className="feed-container">
      {/* Create Post Prompt */}
      <div className="feed-create-prompt" onClick={handleCreatePost}>
        <img src={user?.avatar || defaultAvatar} alt="Your profile" className="feed-create-prompt__avatar" />
        <div className="feed-create-prompt__input">
          <span>Start a post...</span>
        </div>
        <div className="feed-create-prompt__actions">
          <button className="feed-create-prompt__btn" title="Photo">
            <span className="material-icons" style={{ color: "#60a5fa" }}>image</span>
          </button>
          <button className="feed-create-prompt__btn" title="Video">
            <span className="material-icons" style={{ color: "#34d399" }}>videocam</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="feed-loading">
          <div className="feed-loading__spinner"></div>
          <p>Loading Feed...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="feed-empty">
          <div className="feed-empty__icon-wrap">
            <span className="material-icons">dynamic_feed</span>
          </div>
          <h3 className="feed-empty__title">Your Feed is Empty</h3>
          <p className="feed-empty__subtitle">
            Start by creating a post or following other users to see their content here.
          </p>
          <button onClick={handleCreatePost} className="feed-empty__cta">
            <span className="material-icons">add</span>
            Create Your First Post
          </button>
        </div>
      ) : (
        <div className="feed-list">
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              user={user}
              onUpvote={handleUpvote}
              onDownvote={handleDownvote}
              onOpenComments={handleOpenComments}
              onSaveToCollection={handleSaveToCollection}
              onDeletePost={handleDeletePost}
              isSaved={savedPosts.has(post._id?.toString())}
            />
          ))}
        </div>
      )}

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        user={user}
        onPostCreated={fetchPosts}
      />

      {/* Post Detail Modal (Large Side-by-Side) */}
      <PostDetailModal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedPost(null); }}
        post={selectedPost}
        user={user}
        onPostUpdated={handlePostUpdated}
        onDeletePost={handleDeletePost}
      />
    </div>
  );
};

export default Posts;
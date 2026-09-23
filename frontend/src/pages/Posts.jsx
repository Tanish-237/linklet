// src/pages/Posts.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useInView } from "react-intersection-observer";
import { apiClient } from "../api/apiClient";
import { deletePost, getFeed } from "../api/post.api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import defaultAvatar from "../assets/default-avatar.webp";
import PostDetailModal from "../components/PostDetailModal";
import SharePostMenu from "../components/SharePostMenu";
import PostActionsMenu from "../components/PostActionsMenu";
import EditPostModal from "../components/EditPostModal";
import ReportPostModal from "../components/ReportPostModal";
import SEO from "../components/SEO";
import { POSTS_TITLE, POSTS_DESCRIPTION } from "./static/PostsSeoShell";
import { formatTime } from "../utlis/formatTime";
import { optimizeAvatar, optimizeImage, buildSrcSet, getVideoThumbnail } from "../utlis/cloudinary";
import "./Posts.css";



// ─── Create Post Modal ──────────────────────────────────────────────────────
const CreatePostModal = ({ isOpen, onClose, user, onPostCreated, initialMediaFilter = null }) => {
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [mediaKind, setMediaKind] = useState(null); // "image" | "video" | null
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const modalRef = useRef(null);
  // "Photo"/"Video" in the "Start a post" prompt open this same modal but
  // jump straight to the file picker, pre-filtered to that type — that's
  // what actually makes them two distinct buttons rather than two ways to
  // do the exact same thing.
  const acceptAttr =
    initialMediaFilter === "video" ? "video/*" : initialMediaFilter === "image" ? "image/*" : "image/*,video/*";
  useEffect(() => {
    if (isOpen && initialMediaFilter) {
      fileInputRef.current?.click();
    }
    // Only fire on the transition into "open" — not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  const MAX_CAPTION_LENGTH = 2000;
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const MAX_VIDEO_SIZE = 25 * 1024 * 1024;
  const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/gif", "image/webp"];
  const VALID_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

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
    const isVideo = VALID_VIDEO_TYPES.includes(file.type);
    const isImage = VALID_IMAGE_TYPES.includes(file.type);
    if (!isVideo && !isImage) {
      toast.error("Please upload an image (JPEG, PNG, GIF, WEBP) or a video (MP4, WEBM, MOV)");
      return;
    }
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      toast.error(`${isVideo ? "Video" : "Image"} size should be less than ${maxSize / (1024 * 1024)}MB`);
      return;
    }
    setImage(file);
    setMediaKind(isVideo ? "video" : "image");
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
    setImage(null); setImagePreview(null); setMediaKind(null);
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
        setCaption(""); setImage(null); setImagePreview(null); setMediaKind(null);
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
              {mediaKind === "video" ? (
                <video src={imagePreview} controls />
              ) : (
                <img src={imagePreview} alt="Preview" />
              )}
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
              <p className="feed-create-modal__dropzone-text">Drag & drop a photo or video, or <span>click to browse</span></p>
              <p className="feed-create-modal__dropzone-hint">
                <span>JPEG, PNG, GIF, WEBP (max 5MB)</span>
                <span>MP4, WEBM, MOV (max 25MB)</span>
              </p>
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={(e) => handleImageChange(e.target.files[0])} style={{ display: "none" }} accept={acceptAttr} />
          <div className="feed-create-modal__footer">
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
const PostCard = ({ post, user, onUpvote, onDownvote, onOpenComments, onSaveToCollection, isSaved, onDeletePost, onEditPost, onReportPost }) => {
  const navigate = useNavigate();
  const [thumbFailed, setThumbFailed] = useState(false);

  const upvoteCount = post.upvotes?.length || 0;
  const downvoteCount = post.downvotes?.length || 0;
  const netVotes = upvoteCount - downvoteCount;
  const currentUserId = user?._id || user?.id;
  const isUpvoted = post.upvotes?.some((id) => (id._id || id)?.toString() === currentUserId?.toString());
  const isDownvoted = post.downvotes?.some((id) => (id._id || id)?.toString() === currentUserId?.toString());
  const commentCount = post.commentsCount || 0;

  const author = post.userId || post.user || {};
  const authorId = (author._id || author.id || author)?.toString();
  const canDelete = currentUserId && (authorId === currentUserId?.toString() || user?.role === "admin");
  const username = author.username || "User";
  const avatar = optimizeAvatar(author.avatar, 40) || defaultAvatar;
  const videoThumb = post.mediaType === "video" ? getVideoThumbnail(post.image) : undefined;

  return (
    <div className="feed-card">
      {/* Header: Avatar + Username + Bookmark toggle */}
      <div className="feed-card__header">
        <img src={avatar} alt="Profile" className="feed-card__avatar" loading="lazy" decoding="async" />
        <div className="feed-card__user-info">
          <span
            className="feed-card__username"
            onClick={() => navigate(`/profile/${username}`)}
          >
            {username}
          </span>
          <span className="feed-card__time">
            {formatTime(post.createdAt)}
            {post.isEdited && <span className="feed-detail__edited-tag"> · edited</span>}
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <PostActionsMenu
            canManage={canDelete}
            onEdit={() => onEditPost(post)}
            onDelete={() => onDeletePost(post._id)}
            onReport={user ? () => onReportPost(post._id) : undefined}
            deleteTitle={user?.role === "admin" && authorId !== currentUserId?.toString() ? "Delete Post (Admin Moderation)" : "Delete Post"}
          />

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

      {/* Media: Image / Video — the card only ever shows a static thumbnail
          for video; it never plays here. A <video controls> on the card
          would fight with this div's own onClick (opening the detail
          modal), so tapping the native play button both started inline
          playback AND opened a second, separately-playable video in the
          modal. Playback only ever happens in the modal now. */}
      {post.image && (
        <div className="feed-card__media" onClick={() => onOpenComments(post)}>
          {post.mediaType === "video" ? (
            <div className="feed-card__video-thumb">
              {videoThumb && !thumbFailed ? (
                <img
                  src={videoThumb}
                  alt=""
                  className="feed-card__image"
                  loading="lazy"
                  decoding="async"
                  onError={() => setThumbFailed(true)}
                />
              ) : (
                // Default preview when there's no Cloudinary-derived thumbnail
                // (a non-Cloudinary URL) or it failed to load — a plain
                // <video preload="metadata"> here is unreliable (some
                // browsers paint nothing at all until interacted with), so
                // this is deterministic instead of hoping a frame renders.
                <div className="feed-card__video-placeholder">
                  <span className="material-icons">movie</span>
                </div>
              )}
              <span className="feed-card__video-play-overlay">
                <span className="material-icons">play_arrow</span>
              </span>
            </div>
          ) : (
            <img
              src={optimizeImage(post.image, { width: 800 })}
              srcSet={buildSrcSet(post.image, [480, 800, 1200])}
              sizes="(max-width: 640px) 100vw, 640px"
              alt=""
              className="feed-card__image"
              loading="lazy"
              decoding="async"
            />
          )}
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
        <SharePostMenu
          getUrl={() => `${window.location.origin}/posts/${post._id}`}
          shareText={`Check out this post on Linklet: ${post.caption || ""}`}
        />
      </div>
    </div>
  );
};

// ─── Main Posts Component ───────────────────────────────────────────────────
const Posts = () => {
  const { user } = useAuth();

  const queryClient = useQueryClient();

  // Infinite feed: 15 posts per page, cursor-paginated by the API. The query
  // cache keeps already-loaded pages so switching tabs and coming back is instant.
  const {
    data: feedPages,
    isLoading: isFeedLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["posts", "feed"],
    queryFn: getFeed,
    initialPageParam: null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    staleTime: 60 * 1000,
  });

  const feedData = useMemo(() => {
    const seen = new Set();
    return (feedPages?.pages || [])
      .flatMap((page) => page.data || [])
      .filter((post) => (seen.has(post._id) ? false : (seen.add(post._id), true)));
  }, [feedPages]);

  // Local copy so votes / comment-count changes can update a card instantly
  // without waiting for the next refetch.
  const [posts, setPosts] = useState(feedData);

  useEffect(() => {
    setPosts(feedData);
  }, [feedData]);

  // Load the next page shortly before the sentinel scrolls into view.
  const { ref: loadMoreRef, inView } = useInView({ rootMargin: "400px 0px" });
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // A long feed session (hundreds of posts loaded via infinite scroll) would
  // otherwise keep every card mounted forever — growing DOM/memory
  // unboundedly. Only nearby cards actually render; the rest are just
  // reserved space, same as Twitter/Instagram's own timelines. It shares the
  // app shell's own scroll container (Layout.jsx's <main>, #app-main-scroll)
  // rather than owning a separate nested scrollable div, since that's the
  // single surface every page already scrolls in.
  const rowVirtualizer = useVirtualizer({
    count: posts.length,
    getScrollElement: () => document.getElementById("app-main-scroll"),
    estimateSize: () => 480,
    overscan: 3,
    // Keyed by post id rather than array index — deleting a post shifts
    // every later index by one, and an index-keyed cache would otherwise
    // hand each shifted post the wrong neighbor's cached (measured) height
    // until it happened to get remeasured.
    getItemKey: (index) => posts[index]._id,
  });

  const loading = isFeedLoading && posts.length === 0;

  // Bookmark state with in-memory caching
  // No `= []` default on purpose: a fresh array every render while the query is
  // loading would re-trigger the effect below on every render (a render loop).
  const { data: bookmarkIds } = useQuery({
    queryKey: ["bookmarks", user?._id],
    queryFn: async () => {
      const res = await apiClient.get("/profile/me/bookmark-ids");
      return (res.data.data || []).map((id) => id.toString());
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
  const [editingPost, setEditingPost] = useState(null);
  const [reportingPostId, setReportingPostId] = useState(null);
  const [createModalMediaFilter, setCreateModalMediaFilter] = useState(null);


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
    setCreateModalMediaFilter(null);
    setShowCreateModal(true);
  };

  const openCreateModal = (mediaFilter) => {
    if (!user) { toast.info("Please log in to create a post"); return; }
    setCreateModalMediaFilter(mediaFilter);
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
      <SEO title={POSTS_TITLE} description={POSTS_DESCRIPTION} path="/posts" />
      {/* Create Post Prompt */}
      <div className="feed-create-prompt" onClick={handleCreatePost}>
        <img src={user?.avatar || defaultAvatar} alt="Your profile" className="feed-create-prompt__avatar" />
        <div className="feed-create-prompt__input">
          <span>Start a post...</span>
        </div>
        <div className="feed-create-prompt__actions">
          {/* Each jumps straight into the create-post modal's file picker,
              pre-filtered to that media type — not just two ways to open
              the same empty modal. */}
          <button
            className="feed-create-prompt__btn feed-create-prompt__btn--photo"
            title="Photo"
            onClick={(e) => { e.stopPropagation(); openCreateModal("image"); }}
          >
            <span className="material-icons">image</span>
          </button>
          <button
            className="feed-create-prompt__btn feed-create-prompt__btn--video"
            title="Video"
            onClick={(e) => { e.stopPropagation(); openCreateModal("video"); }}
          >
            <span className="material-icons">videocam</span>
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
        <>
        <div className="feed-list" style={{ height: rowVirtualizer.getTotalSize() }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const post = posts[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                className="feed-list__row"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <PostCard
                  post={post}
                  user={user}
                  onUpvote={handleUpvote}
                  onDownvote={handleDownvote}
                  onOpenComments={handleOpenComments}
                  onSaveToCollection={handleSaveToCollection}
                  onDeletePost={handleDeletePost}
                  onEditPost={setEditingPost}
                  onReportPost={setReportingPostId}
                  isSaved={savedPosts.has(post._id?.toString())}
                />
              </div>
            );
          })}
        </div>
        {/* Infinite-scroll sentinel — a normal-flow sibling below the
            fixed-height virtualized container (rather than a child of it,
            where the container's absolutely-positioned rows would leave it
            pinned at the top instead of the bottom). */}
        <div ref={loadMoreRef} className="feed-load-more" aria-live="polite">
          {isFetchingNextPage && (
            <>
              <div className="feed-loading__spinner"></div>
              <p>Loading more posts...</p>
            </>
          )}
          {!hasNextPage && posts.length > 0 && <p className="feed-load-more__end">You&apos;re all caught up</p>}
        </div>
        </>
      )}

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        user={user}
        onPostCreated={() => queryClient.resetQueries({ queryKey: ["posts", "feed"] })}
        initialMediaFilter={createModalMediaFilter}
      />

      {/* Post Detail Modal (Large Side-by-Side) */}
      <PostDetailModal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedPost(null); }}
        post={selectedPost}
        user={user}
        onPostUpdated={handlePostUpdated}
        onDeletePost={handleDeletePost}
        onEditPost={setEditingPost}
        onReportPost={setReportingPostId}
      />

      {editingPost && (
        <EditPostModal post={editingPost} onClose={() => setEditingPost(null)} onSaved={handlePostUpdated} />
      )}

      {reportingPostId && (
        <ReportPostModal postId={reportingPostId} onClose={() => setReportingPostId(null)} />
      )}
    </div>
  );
};

export default Posts;
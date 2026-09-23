import React, { useState, useEffect } from "react";
import useConfirm from "../hooks/useConfirm";
import { apiClient } from "../api/apiClient";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import defaultAvatar from "../assets/default-avatar.webp";
import SaveToCollectionModal from "../components/SaveToCollectionModal";
import PostCommentsPanel from "../components/PostCommentsPanel";
import SharePostMenu from "../components/SharePostMenu";
import PostActionsMenu from "../components/PostActionsMenu";
import EditPostModal from "../components/EditPostModal";
import ReportPostModal from "../components/ReportPostModal";
import { deletePost as apiDeletePost } from "../api/post.api";
import { formatTime } from "../utlis/formatTime";
import { optimizeAvatar, optimizeImage, buildSrcSet } from "../utlis/cloudinary";
import "./Posts.css";

const PostDetail = () => {
  const [confirm, confirmDialog] = useConfirm();
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedPosts, setSavedPosts] = useState(new Set());
  const [collectionPostId, setCollectionPostId] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [reportingPostId, setReportingPostId] = useState(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  // Load the post itself (comments are paginated separately by PostCommentsPanel).
  // `cancelled` drops the response if the user navigated to another post meanwhile.
  useEffect(() => {
    let cancelled = false;
    const fetchPostDetail = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`/posts/${postId}`);
        if (cancelled) return;
        if (!res.data || !res.data.data) {
          throw new Error("Post not found");
        }
        setPost(res.data.data);
      } catch (error) {
        if (cancelled) return;
        setPost(null);
        toast.error("Post not found or failed to load");
        console.error("Error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPostDetail();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  useEffect(() => {
    const fetchBookmarks = async () => {
      if (!user) return;
      try {
        const res = await apiClient.get("/profile/me/bookmark-ids");
        setSavedPosts(new Set((res.data.data || []).map((id) => id.toString())));
      } catch {
        // silently fail
      }
    };
    fetchBookmarks();
  }, [user]);

  const closeModal = () => {
    if (window.history.length > 2 && document.referrer.includes(window.location.host)) {
      navigate(-1);
    } else {
      navigate("/home");
    }
  };

  const handleUpvote = async () => {
    if (!user) { toast.info("Please log in to vote"); return; }
    try {
      const res = await apiClient.post(`/posts/${postId}/upvote`);
      setPost(res.data.data);
    } catch { toast.error("Error voting"); }
  };

  const handleDownvote = async () => {
    if (!user) { toast.info("Please log in to vote"); return; }
    try {
      const res = await apiClient.post(`/posts/${postId}/downvote`);
      setPost(res.data.data);
    } catch { toast.error("Error voting"); }
  };

  const handleDeletePost = async () => {
    if (!(await confirm({ title: "Delete post?", message: "This post and its comments will be permanently removed." }))) return;
    try {
      await apiDeletePost(postId);
      toast.success("Post deleted successfully");
      navigate("/home");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete post");
    }
  };

  if (loading) {
    return (
      <div className="feed-loading">
        <div className="feed-loading__spinner"></div>
        <p>Loading Post Details...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="feed-empty">
        <div className="feed-empty__icon-wrap">
          <span className="material-icons">error_outline</span>
        </div>
        <h3 className="feed-empty__title">Post Not Found</h3>
        <p className="feed-empty__subtitle">The post you are looking for does not exist or was removed.</p>
        <button onClick={() => navigate("/home")} className="feed-empty__cta">
          Back to Feed
        </button>
      </div>
    );
  }

  const currentUserId = user?._id || user?.id;
  const isUpvoted = post.upvotes?.some((id) => (id._id || id)?.toString() === currentUserId?.toString());
  const isDownvoted = post.downvotes?.some((id) => (id._id || id)?.toString() === currentUserId?.toString());
  const netVotes = (post.upvotes?.length || 0) - (post.downvotes?.length || 0);

  const postAuthor = post.userId || post.user || {};
  const postAuthorId = (postAuthor._id || postAuthor.id || postAuthor)?.toString();
  const canDeletePost = currentUserId && (postAuthorId === currentUserId?.toString() || user?.role === "admin");
  const postUsername = postAuthor.username || "User";
  const postAvatar = optimizeAvatar(postAuthor.avatar, 40) || defaultAvatar;
  const isSaved = savedPosts.has(post._id?.toString());

  return (
    <>
    <div style={{ minHeight: "100%", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem" }}>
      <div className="feed-detail-modal" style={{ margin: "0 auto", position: "relative" }}>
        {/* Close Button */}
        <button onClick={closeModal} className="feed-detail__close-btn" aria-label="Close">
          <span className="material-icons">close</span>
        </button>

        {/* Left Side: Post Content */}
        <div className="feed-detail__left">
          {/* Post Header */}
          <div className="feed-detail__header">
            <img src={postAvatar} alt="" className="feed-detail__avatar" />
            <div className="feed-detail__user-info" style={{ flex: 1 }}>
              <span
                className="feed-detail__username"
                onClick={() => navigate(`/profile/${postUsername}`)}
              >
                {postUsername}
              </span>
              <span className="feed-detail__time">
                {formatTime(post.createdAt)}
                {post.isEdited && <span className="feed-detail__edited-tag"> · edited</span>}
              </span>
            </div>

            <div className="flex items-center gap-1.5" style={{ marginRight: "2.5rem" }}>
              <PostActionsMenu
                canManage={canDeletePost}
                onEdit={() => setEditingPost(post)}
                onDelete={handleDeletePost}
                onReport={user ? () => setReportingPostId(post._id) : undefined}
                deleteTitle={user?.role === "admin" && postAuthorId !== currentUserId?.toString() ? "Delete Post (Admin Moderation)" : "Delete Post"}
              />

              {/* Bookmark / Save Button */}
              <button
                className={`feed-card__save-btn ${isSaved ? "feed-card__save-btn--saved" : ""}`}
                onClick={() => setCollectionPostId(post._id)}
                title="Save to Collection"
              >
                <span className={`material-icons ${isSaved ? "icon-filled" : ""}`}>bookmark</span>
              </button>
            </div>
          </div>

          {/* Caption */}
          {post.caption && (
            <div className="feed-detail__caption">
              <p>{post.caption}</p>
            </div>
          )}

          {/* Image / Video */}
          {post.image && (
            <div className="feed-detail__media">
              {post.mediaType === "video" ? (
                <video src={post.image} controls className="feed-detail__image" preload="metadata" />
              ) : (
                <img
                  src={optimizeImage(post.image, { width: 1200 })}
                  srcSet={buildSrcSet(post.image)}
                  sizes="(max-width: 900px) 100vw, 60vw"
                  alt=""
                  className="feed-detail__image"
                  decoding="async"
                />
              )}
            </div>
          )}

          {/* Actions Bar */}
          <div className="feed-detail__actions">
            {/* Vote Pill */}
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
              {post.commentsCount || 0} comments
            </span>

            {/* Share button */}
            <SharePostMenu
              className="ml-auto"
              getUrl={() => window.location.href}
              shareText={`Check out this post on Linklet: ${post?.caption || ""}`}
            />
          </div>
        </div>

        {/* Right Side: Comments */}
        <PostCommentsPanel
          postId={post._id}
          commentsCount={post.commentsCount || 0}
          onCountChange={(commentsCount) => setPost((prev) => (prev ? { ...prev, commentsCount } : prev))}
          user={user}
          onNavigateToProfile={(username) => navigate(`/profile/${username}`)}
        />
      </div>

      {/* Save to Collection Modal */}
      {collectionPostId && (
        <SaveToCollectionModal
          resourceId={collectionPostId}
          onClose={() => setCollectionPostId(null)}
          onSuccess={() => {
            setSavedPosts((prev) => new Set([...prev, collectionPostId.toString()]));
            setCollectionPostId(null);
          }}
        />
      )}

      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={(updated) => setPost(updated)}
        />
      )}

      {reportingPostId && (
        <ReportPostModal postId={reportingPostId} onClose={() => setReportingPostId(null)} />
      )}
    </div>
    {confirmDialog}
    </>
  );
};

export default PostDetail;

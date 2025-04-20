import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { handleApiError } from "../utlis/ErrorHandler";
import defaultAvatar from "../assets/default-avatar.png";

const PostDetail = () => {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const modalRef = useRef(null);

  // Add animation controls
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const fetchPostDetail = async () => {
      try {
        setLoading(true);

        const postResponse = await axios.get(
          `http://localhost:5000/api/posts/${postId}`
        );

        if (!postResponse.data) {
          throw new Error("Post not found");
        }

        setPost(postResponse.data.post);
        
        // Check if post is bookmarked by user
        if (user) {
          const bookmarkCheck = user.bookmarks?.includes(postId);
          setIsBookmarked(bookmarkCheck || false);
        }
      } catch (error) {
        if (error.message === "Post not found") {
          toast.error("Post not found");
        } else {
          toast.error("Failed to load post details");
          console.error("Error:", error);
        }
      } finally {
        setLoading(false);
      }
    };

    // Add body class to prevent scrolling
    document.body.classList.add("overflow-hidden");
    
    fetchPostDetail();
    
    // Cleanup function
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [postId, user]);

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown date";
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime())
        ? "Invalid date"
        : date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
    } catch {
      return "Invalid date";
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (!user) {
      toast.error("Please log in to comment");
      return;
    }

    try {
      setCommentLoading(true);

      const response = await axios.post(
        `http://localhost:5000/api/posts/${postId}/comments`,
        { text: commentText },
        { withCredentials: true }
      );

      if (response.data.success) {
        setPost(response.data.post);
        setCommentText("");
        toast.success("Comment added successfully");
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setCommentLoading(false);
    }
  };

  const closeModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      navigate(-1);
    }, 300); // Match animation duration
  };

  const handleShare = async (platform) => {
    const url = window.location.href;
    const text = `Check out this post on Linklet: ${post.caption}`;

    switch (platform) {
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(
            text
          )}&url=${encodeURIComponent(url)}`
        );
        break;
      case "linkedin":
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
            url
          )}`
        );
        break;
      case "copy":
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard!");
        break;
    }
    setShowShareMenu(false);
  };

  const handleBookmark = async () => {
    if (!user) {
      toast.error("Please log in to bookmark");
      return;
    }
    
    try {
      const response = await axios.post(
        `http://localhost:5000/api/posts/${postId}/bookmark`,
        {},
        { withCredentials: true }
      );
      
      setIsBookmarked(!isBookmarked);
      toast.success(
        isBookmarked
          ? "Post removed from bookmarks"
          : "Post saved to bookmarks"
      );
    } catch (error) {
      handleApiError(error);
    }
  };

  const handleUpvote = async () => {
    if (!user) {
      toast.error("Please log in to upvote");
      return;
    }

    try {
      const res = await axios.post(
        `http://localhost:5000/api/posts/${postId}/upvote`,
        {},
        { withCredentials: true }
      );

      setPost((prev) => ({
        ...prev,
        upvotes: res.data.upvoted
          ? [...prev.upvotes, user.id]
          : prev.upvotes.filter((id) => id !== user.id),
      }));
    } catch (error) {
      handleApiError(error);
    }
  };

  // Handle click outside to close modal
  const handleOutsideClick = (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      closeModal();
    }
  };

  // Handle escape key press
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };

    window.addEventListener("keydown", handleEscKey);
    return () => {
      window.removeEventListener("keydown", handleEscKey);
    };
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-violet-600/30 p-4 rounded-full animate-pulse">
          <div className="w-12 h-12 rounded-full border-4 border-t-transparent border-violet-300 animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-gray-400">
        <span className="material-icons text-6xl mb-4">error_outline</span>
        <p className="text-xl">Post not found</p>
        <button 
          onClick={closeModal}
          className="mt-6 px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
      onClick={handleOutsideClick}
    >
      {/* Semi-transparent backdrop that keeps home page visible */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300" />

      {/* Compact Modal Container */}
      <div 
        ref={modalRef}
        className={`
          w-full max-w-4xl max-h-[80vh] mx-4
          bg-gradient-to-br from-gray-900/95 via-gray-900/98 to-black/95
          backdrop-blur-xl
          rounded-2xl
          border border-violet-500/20
          shadow-[0_0_50px_-12px] shadow-violet-500/20
          overflow-hidden
          transition-all duration-300 transform
          ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}
        `}
        onClick={e => e.stopPropagation()}
      >
        {/* Enhanced Header */}
        <div className="relative px-6 py-4 border-b border-violet-500/20 bg-black/40 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <img
                  src={post.userId?.avatar || defaultAvatar}
                  alt={post.userId?.username}
                  className="w-12 h-12 rounded-full border-2 border-violet-500/30 object-cover group-hover:border-violet-500/60 transition-all duration-300"
                />
                <div className="absolute inset-0 rounded-full bg-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div>
                <h3 className="font-semibold text-violet-300 hover:text-violet-200 transition-colors cursor-pointer">
                  {post.userId?.username || "Anonymous"}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="material-icons text-base">schedule</span>
                  {formatDate(post.createdAt)}
                </div>
              </div>
            </div>

            {/* Enhanced Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleBookmark}
                className="p-2 hover:bg-violet-500/20 rounded-full transition-all duration-300 group tooltip-wrapper"
              >
                <span className={`material-icons ${isBookmarked ? 'text-violet-400' : 'text-gray-400 group-hover:text-violet-400'}`}>
                  {isBookmarked ? 'bookmark' : 'bookmark_border'}
                </span>
                <span className="tooltip">
                  {isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
                </span>
              </button>
              
              {/* Share Menu with Enhanced UI */}
              <div className="relative">
                <button
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="p-2 hover:bg-violet-500/20 rounded-full transition-all duration-300 group"
                >
                  <span className="material-icons text-gray-400 group-hover:text-violet-400">
                    share
                  </span>
                </button>
                
                {/* Share menu with glass effect */}
                {showShareMenu && (
                  <div className="absolute right-0 mt-2 w-56 py-2 bg-gray-900/95 backdrop-blur-xl rounded-xl border border-violet-500/30 shadow-xl z-10 transform origin-top-right transition-all duration-300">
                    <div className="p-2">
                      <button
                        onClick={() => handleShare("twitter")}
                        className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-violet-500/20 rounded-lg transition-colors"
                      >
                        <span className="material-icons">twitter</span>
                        Share on Twitter
                      </button>
                      <button
                        onClick={() => handleShare("linkedin")}
                        className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-violet-500/20 rounded-lg transition-colors"
                      >
                        <span className="material-icons">linkedin</span>
                        Share on LinkedIn
                      </button>
                      <button
                        onClick={() => handleShare("copy")}
                        className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-violet-500/20 rounded-lg transition-colors"
                      >
                        <span className="material-icons">content_copy</span>
                        Copy Link
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={closeModal}
                className="p-2 hover:bg-red-500/20 rounded-full transition-all duration-300 group tooltip-wrapper"
              >
                <span className="material-icons text-gray-400 group-hover:text-red-400">
                  close
                </span>
                <span className="tooltip">Close</span>
              </button>
            </div>
          </div>
        </div>

        {/* Refined Content Layout */}
        <div className="flex flex-col md:flex-row h-[calc(80vh-80px)]">
          {post.image && (
            <div className="md:w-3/5 bg-black/50 flex items-center justify-center border-r border-violet-500/10 relative group">
              <img
                src={post.image}
                alt={post.caption}
                className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
              />
              {/* Image overlay with actions */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-4">
                <button className="px-4 py-2 bg-violet-600/80 hover:bg-violet-600 text-white rounded-lg backdrop-blur-sm transition-all duration-300">
                  View Full Image
                </button>
              </div>
            </div>
          )}

          <div className={`${post.image ? 'md:w-2/5' : 'w-full'} flex flex-col bg-gray-900/50`}>
            {/* Enhanced Post Content */}
            <div className="p-6 border-b border-violet-500/10">
              <p className="text-gray-200 text-lg leading-relaxed whitespace-pre-wrap">
                {post.caption}
              </p>
              
              {/* Enhanced Interaction Buttons */}
              <div className="flex items-center gap-6 mt-6 pt-4 border-t border-violet-500/10">
                <button
                  onClick={handleUpvote}
                  className={`flex items-center gap-2 transition-all duration-300 ${
                    post.upvotes?.includes(user?.id)
                      ? "text-pink-500"
                      : "text-gray-400 hover:text-pink-400"
                  }`}
                >
                  <span className="material-icons text-xl transform hover:scale-110 transition-transform">
                    {post.upvotes?.includes(user?.id)
                      ? "favorite"
                      : "favorite_border"}
                  </span>
                  <span>{post.upvotes?.length || 0}</span>
                </button>
                <button className="flex items-center gap-2 text-gray-400">
                  <span className="material-icons">chat_bubble_outline</span>
                  <span>{post.comments?.length || 0}</span>
                </button>
              </div>
            </div>

            {/* Comments Section with Enhanced Scrollbar */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-violet-300 mb-4">Comments</h3>
                
                <div className="space-y-4 mb-6">
                  {!post.comments || post.comments.length === 0 ? (
                    <div className="text-center py-8 bg-black/20 rounded-lg border border-violet-500/10">
                      <span className="material-icons text-4xl text-gray-400 mb-2">
                        chat_bubble_outline
                      </span>
                      <p className="text-gray-400">No comments yet</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Be the first to share your thoughts!
                      </p>
                    </div>
                  ) : (
                    post.comments.map((comment) => (
                      <div
                        key={comment._id}
                        className="bg-black/30 rounded-lg p-4 border border-violet-500/10 hover:border-violet-500/30 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <img
                            src={comment.userId?.avatar || defaultAvatar}
                            alt={comment.userId?.username}
                            className="w-8 h-8 rounded-full border border-violet-500/30 object-cover"
                          />
                          <div>
                            <div className="font-medium text-violet-300">
                              {comment.userId?.username || "Anonymous"}
                            </div>
                            <div className="text-xs text-gray-400">
                              {formatDate(comment.createdAt)}
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-300">{comment.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Enhanced Comment Input */}
            <div className="p-4 border-t border-violet-500/10 bg-black/40 backdrop-blur-md">
              <form onSubmit={handleCommentSubmit} className="flex items-center gap-3">
                <div className="relative group">
                  <img
                    src={user?.avatar || defaultAvatar}
                    alt={user?.username || "Your avatar"}
                    className="w-8 h-8 rounded-full border border-violet-500/30 object-cover group-hover:border-violet-500/60 transition-all duration-300"
                  />
                  <div className="absolute inset-0 rounded-full bg-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <textarea
                  rows="1"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={user ? "Write a comment..." : "Log in to comment"}
                  className="flex-1 px-4 py-2 bg-black/30 text-white rounded-full border border-violet-500/30 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all resize-none placeholder-gray-500"
                  disabled={!user}
                />
                <button
                  type="submit"
                  disabled={commentLoading || !user || !commentText.trim()}
                  className="p-2 bg-violet-600 text-white rounded-full hover:bg-violet-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                >
                  {commentLoading ? (
                    <span className="material-icons animate-spin">refresh</span>
                  ) : (
                    <span className="material-icons">send</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add these styles to your global CSS
/*
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.3);
  border-radius: 3px;
  transition: all 0.3s ease;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 92, 246, 0.5);
}

@keyframes modalOpen {
  from { 
    opacity: 0;
    transform: scale(0.95);
  }
  to { 
    opacity: 1;
    transform: scale(1);
  }
}

.modal-open {
  animation: modalOpen 0.3s ease-out forwards;
}
*/

export default PostDetail;
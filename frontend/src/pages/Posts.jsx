// src/pages/Posts.js
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import defaultAvatar from "../assets/default-avatar.png";

const Posts = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Modal state
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const modalRef = useRef(null);

  const fetchPosts = async (page = 1) => {
    try {
      setLoading(true);
      const res = await axios.get(
        `http://localhost:5000/api/posts?page=${page}&limit=10`
      );
      setPosts(res.data.posts.docs || []);
      setTotalPages(res.data.posts.totalPages || 1);
    } catch (error) {
      toast.error("Error fetching posts");
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(currentPage);
  }, [currentPage]);

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleUpvote = async (postId, e) => {
    e.stopPropagation();
    if (!user) {
      toast.info("Please log in to upvote posts");
      return;
    }

    try {
      const res = await axios.post(
        `http://localhost:5000/api/posts/${postId}/upvote`,
        {},
        { withCredentials: true }
      );

      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === postId
            ? {
                ...post,
                upvotes: res.data.upvoted
                  ? [...(post.upvotes || []), user.id]
                  : (post.upvotes || []).filter((id) => id !== user.id),
              }
            : post
        )
      );

      if (selectedPost && selectedPost._id === postId) {
        setSelectedPost((prev) => ({
          ...prev,
          upvotes: res.data.upvoted
            ? [...(prev.upvotes || []), user.id]
            : (prev.upvotes || []).filter((id) => id !== user.id),
        }));
      }
    } catch (error) {
      console.error("Upvote error:", error);
      toast.error("Error upvoting post");
    }
  };

  const openPostDetail = (post) => {
    setSelectedPost(post);
    setShowPostModal(true);
    document.body.style.overflow = "hidden";
  };

  const closePostModal = () => {
    setShowPostModal(false);
    setSelectedPost(null);
    document.body.style.overflow = "auto";
  };

  const handleOutsideClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      closePostModal();
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedPost || !user) return;

    try {
      setCommentLoading(true);
      const res = await axios.post(
        `http://localhost:5000/api/posts/${selectedPost._id}/comments`,
        { text: commentText },
        { withCredentials: true }
      );

      setSelectedPost(res.data.post);

      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === selectedPost._id ? res.data.post : post
        )
      );

      setCommentText("");
      toast.success("Comment added");
    } catch (error) {
      toast.error("Error adding comment");
    } finally {
      setCommentLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleCreatePost = () => {
    navigate("/create-post");
  };

  return (
    <div className="w-full max-w-3xl mx-auto py-8 px-4">
      {/* Create Post Card */}
      <div className="mb-8 bg-gray-800/40 backdrop-blur-md rounded-xl border border-violet-500/20 shadow-lg shadow-violet-900/10 overflow-hidden">
        <div className="p-5 flex items-center gap-3">
          <img
            src={user?.avatar || defaultAvatar}
            alt={user?.username || "Your profile"}
            className="w-12 h-12 rounded-full border-2 border-violet-500/30 object-cover flex-shrink-0"
          />
          <div
            onClick={handleCreatePost}
            className="flex-1 px-4 py-3 bg-gray-900/50 text-gray-400 rounded-full border border-violet-500/20 hover:border-violet-500/40 cursor-pointer transition-all"
          >
            Start a post...
          </div>
        </div>
        <div className="px-5 py-3 border-t border-violet-500/10 bg-gray-900/20 flex items-center justify-around sm:justify-start sm:gap-6">
          <button className="flex items-center gap-2 text-gray-300 hover:text-violet-400 transition-colors p-2 rounded-lg hover:bg-violet-500/10">
            <span className="material-icons text-blue-400">image</span>
            <span className="hidden sm:inline">Photo</span>
          </button>
          <button className="flex items-center gap-2 text-gray-300 hover:text-violet-400 transition-colors p-2 rounded-lg hover:bg-violet-500/10">
            <span className="material-icons text-green-400">videocam</span>
            <span className="hidden sm:inline">Video</span>
          </button>
          <button className="flex items-center gap-2 text-gray-300 hover:text-violet-400 transition-colors p-2 rounded-lg hover:bg-violet-500/10">
            <span className="material-icons text-yellow-500">event</span>
            <span className="hidden sm:inline">Event</span>
          </button>
          <button className="flex items-center gap-2 text-gray-300 hover:text-violet-400 transition-colors p-2 rounded-lg hover:bg-violet-500/10 sm:ml-auto">
            <span className="material-icons text-red-400">article</span>
            <span className="hidden sm:inline">Write article</span>
          </button>
        </div>
      </div>

      {/* Content Feed */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 border-t-2 border-b-2 border-violet-500 rounded-full animate-spin mb-4"></div>
          <p className="text-violet-300 text-lg">Loading Feed...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 px-4 bg-gray-800/30 backdrop-blur-md rounded-xl border border-violet-500/20 shadow-inner">
          <div className="inline-flex justify-center items-center w-20 h-20 bg-violet-900/20 rounded-full mb-6 ring-4 ring-violet-500/10">
            <span className="material-icons text-4xl text-violet-400">
              dynamic_feed
            </span>
          </div>
          <h3 className="text-xl font-semibold text-violet-300 mb-2">
            Your Feed is Empty
          </h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            Start by creating a post or connecting with others.
          </p>
          <button
            onClick={handleCreatePost}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors inline-flex items-center gap-2 shadow-lg shadow-violet-900/20"
          >
            <span className="material-icons">add</span>
            Create First Post
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <div
              key={post._id}
              className="bg-gray-800/40 backdrop-blur-md rounded-xl border border-violet-500/20 shadow-lg overflow-hidden hover:shadow-violet-900/10 hover:border-violet-500/40 transition-all duration-300"
            >
              {/* Post Header - Styled like the provided image */}
              <div className="px-5 pt-5 pb-0 flex">
                {/* User Avatar */}
                <div className="flex-shrink-0 mr-4">
                  <img
                    src={post.user?.avatar || post.userId?.avatar || defaultAvatar}
                    alt="Profile"
                    className="w-14 h-14 rounded-full border-2 border-violet-500/30 object-cover flex-shrink-0"
                  />
                </div>
                
                <div className="flex-1">
                  {/* Username and Date (styled like the image) */}
                  <div className="flex flex-col">
                    <h3 className="font-semibold text-lg text-violet-300 leading-tight">
                      {post.user?.username || post.userId?.username || "User"}
                    </h3>
                    <p className="text-sm text-gray-400 mb-4">
                      {formatDate(post.createdAt)}
                    </p>
                  </div>
                  
                  {/* Caption styled with highlight/underline effect */}
                  <div className="pb-4 -mx-1">
                    <p className="text-gray-200 text-base font-medium bg-violet-500/10 border-b border-violet-500/50 inline-block px-3 py-1.5 rounded-md">
                      {post.caption}
                    </p>
                  </div>
                </div>
              </div>

              {/* Post Image */}
              {post.image && (
                <div
                  onClick={() => openPostDetail(post)}
                  className="cursor-pointer"
                >
                  <div className="bg-black/50 flex items-center justify-center">
                    <img
                      src={post.image}
                      alt=""
                      className="w-full object-contain max-h-[500px]"
                    />
                  </div>
                </div>
              )}

              {/* Post Actions */}
              <div className="py-2 border-t border-violet-500/10 bg-gray-900/30 backdrop-blur-sm">
                <div className="flex items-center justify-between px-5">
                  <span className="text-xs text-gray-400">{post.upvotes?.length || 0} upvotes • {post.comments?.length || 0} comments</span>
                </div>
                <div className="flex items-center px-2 mt-2">
                  {/* Upvote Button */}
                  <button
                    onClick={(e) => handleUpvote(post._id, e)}
                    className={`flex flex-1 items-center justify-center gap-1 p-2 rounded-md hover:bg-violet-500/10 transition-colors ${
                      post.upvotes?.includes(user?.id) ? 'text-violet-400' : 'text-gray-400 hover:text-violet-400'
                    }`}
                  >
                    <span className="material-icons text-xl">thumb_up</span>
                    <span className="font-semibold">Upvote</span>
                  </button>
                  
                  {/* Comment Button */}
                  <button
                    onClick={() => openPostDetail(post)}
                    className="flex flex-1 items-center justify-center gap-1 p-2 rounded-md text-gray-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                  >
                    <span className="material-icons text-xl">comment</span>
                    <span className="font-semibold">Comment</span>
                  </button>
                  
                  {/* Send Button */}
                  <button className="flex flex-1 items-center justify-center gap-1 p-2 rounded-md text-gray-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
                    <span className="material-icons text-xl">send</span>
                    <span className="font-semibold">Send</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post Detail Modal (Instagram-style) */}
      {showPostModal && selectedPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={handleOutsideClick}
        >
          <div
            ref={modalRef}
            className="relative w-full max-w-5xl max-h-[90vh] bg-gradient-to-b from-gray-900/95 to-black/95 backdrop-blur-xl rounded-xl border border-violet-500/20 shadow-2xl shadow-violet-900/20 overflow-hidden flex flex-col md:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closePostModal}
              className="absolute top-4 right-4 z-10 p-2 bg-black/40 hover:bg-red-500/20 rounded-full text-gray-400 hover:text-red-400 transition-colors"
            >
              <span className="material-icons">close</span>
            </button>

            {/* Left side - Image */}
            {selectedPost.image && (
              <div className="md:w-3/5 bg-black flex items-center justify-center max-h-[60vh] md:max-h-[90vh]">
                <img
                  src={selectedPost.image}
                  alt=""
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Right side - Content */}
            <div
              className={`${
                selectedPost.image ? "md:w-2/5" : "w-full"
              } flex flex-col max-h-[90vh] overflow-hidden`}
            >
              {/* Post Header - styled like the image */}
              <div className="p-4 border-b border-violet-500/20 bg-black/40 backdrop-blur-md">
                <div className="flex items-start">
                  <img
                    src={
                      selectedPost.user?.avatar ||
                      selectedPost.userId?.avatar ||
                      defaultAvatar
                    }
                    alt="Profile"
                    className="w-14 h-14 rounded-full border-2 border-violet-500/30 mr-4"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-violet-300">
                      {selectedPost.user?.username ||
                        selectedPost.userId?.username ||
                        "User"}
                    </h3>
                    <p className="text-sm text-gray-400 mb-3">
                      {formatDate(selectedPost.createdAt)}
                    </p>
                    
                    {/* Caption with styling */}
                    <div className="bg-violet-500/10 border-b border-violet-500/50 inline-block px-3 py-1.5 rounded-md">
                      <p className="text-gray-200 font-medium">
                        {selectedPost.caption}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comments Section */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-4 space-y-4">
                  {selectedPost.comments?.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400">
                        No comments yet. Be the first to comment!
                      </p>
                    </div>
                  ) : (
                    selectedPost.comments?.map((comment) => (
                      <div key={comment._id} className="flex items-start gap-3">
                        <img
                          src={comment.userId?.avatar || defaultAvatar}
                          alt=""
                          className="w-8 h-8 rounded-full border border-violet-500/30"
                        />
                        <div className="flex-1">
                          <div className="flex items-baseline">
                            <span className="font-medium text-violet-300 mr-2">
                              {comment.userId?.username || "User"}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(comment.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-gray-300 mt-1">{comment.text}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Post Actions */}
              <div className="border-t border-violet-500/10 bg-black/40 backdrop-blur-md p-4">
                <div className="flex items-center gap-4 mb-3">
                  <button
                    onClick={(e) => handleUpvote(selectedPost._id, e)}
                    className={`flex items-center gap-1.5 ${
                      selectedPost.upvotes?.includes(user?.id)
                        ? "text-violet-400"
                        : "text-gray-400 hover:text-violet-400"
                    } transition-colors`}
                  >
                    <span className="material-icons text-xl">thumb_up</span>
                    <span>{selectedPost.upvotes?.length || 0} Upvote</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-gray-400 hover:text-violet-400 transition-colors">
                    <span className="material-icons text-xl">comment</span>
                    <span>{selectedPost.comments?.length || 0} Comments</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-gray-400 hover:text-violet-400 transition-colors">
                    <span className="material-icons text-xl">send</span>
                    <span>Send</span>
                  </button>
                </div>

                {/* Comment Form */}
                <form
                  onSubmit={handleCommentSubmit}
                  className="flex items-center gap-3"
                >
                  <img
                    src={user?.avatar || defaultAvatar}
                    alt="Your avatar"
                    className="w-8 h-8 rounded-full border border-violet-500/30"
                  />
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={user ? "Add a comment..." : "Log in to comment"}
                    className="flex-1 px-4 py-2 bg-black/30 text-white rounded-full border border-violet-500/30 focus:border-violet-500 focus:outline-none transition-all placeholder-gray-500"
                    disabled={!user}
                  />
                  <button
                    type="submit"
                    disabled={commentLoading || !user || !commentText.trim()}
                    className="p-2 bg-violet-600 text-white rounded-full hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {commentLoading ? (
                      <span className="material-icons animate-spin">
                        refresh
                      </span>
                    ) : (
                      <span className="material-icons">send</span>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-lg bg-gray-900/50 border border-violet-500/20 p-1 shadow-md">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-md text-gray-400 hover:text-violet-400 enabled:hover:bg-violet-500/10 disabled:opacity-50 transition-colors"
              aria-label="Previous page"
            >
              <span className="material-icons">chevron_left</span>
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5) {
                if (currentPage > 3 && currentPage < totalPages - 2) {
                  pageNum = currentPage - 2 + i;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                }
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors mx-0.5 ${
                    currentPage === pageNum
                      ? "bg-violet-600 text-white font-medium shadow-sm"
                      : "text-gray-400 hover:text-violet-400 hover:bg-violet-500/10"
                  }`}
                  aria-current={currentPage === pageNum ? "page" : undefined}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-md text-gray-400 hover:text-violet-400 enabled:hover:bg-violet-500/10 disabled:opacity-50 transition-colors"
              aria-label="Next page"
            >
              <span className="material-icons">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Posts;
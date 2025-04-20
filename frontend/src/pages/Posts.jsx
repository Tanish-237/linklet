// src/pages/Posts.js
import React, { useEffect, useState } from "react";
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
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

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
    try {
      const res = await axios.post(
        `http://localhost:5000/api/posts/${postId}/upvote`,
        { withCredentials: true }
      );
      const updatedPosts = posts.map((post) =>
        post._id === postId
          ? {
              ...post,
              upvotes: res.data.upvoted
                ? [...post.upvotes, res.data.userId]
                : post.upvotes.filter((id) => id !== res.data.userId),
            }
          : post
      );
      setPosts(updatedPosts);
    } catch (error) {
      toast.error("Error upvoting post");
    }
  };

  const openPostDetail = (post) => {
    setSelectedPost(post);
    setShowPostModal(true);
    document.body.style.overflow = 'hidden';
  };

  const closePostDetail = () => {
    setShowPostModal(false);
    setSelectedPost(null);
    document.body.style.overflow = 'auto';
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4">
      {/* Create Post Card */}
      <div className="mb-8 bg-gray-800/40 backdrop-blur-md rounded-xl border border-violet-500/20 shadow-lg shadow-violet-900/10 overflow-hidden">
        <div className="p-5 flex items-center gap-3">
          <img
            src={user?.avatar || defaultAvatar}
            alt={user?.username || "Your profile"}
            className="w-12 h-12 rounded-full border border-violet-500/30"
          />
          <div 
            onClick={() => navigate('/create-post')}
            className="flex-1 px-4 py-3 bg-gray-900/50 text-gray-400 rounded-lg border border-violet-500/20 hover:border-violet-500/40 cursor-pointer transition-all"
          >
            Share something with the community...
          </div>
        </div>
        <div className="px-4 py-3 border-t border-violet-500/10 bg-gray-900/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 text-gray-300 hover:text-violet-400 transition-colors">
              <span className="material-icons">image</span>
              <span className="hidden sm:inline">Photos</span>
            </button>
            <button className="flex items-center gap-2 text-gray-300 hover:text-violet-400 transition-colors">
              <span className="material-icons">attachment</span>
              <span className="hidden sm:inline">Files</span>
            </button>
          </div>
          <button
            onClick={() => navigate('/create-post')}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-violet-900/20"
          >
            <span className="material-icons">edit</span>
            <span>Post</span>
          </button>
        </div>
      </div>

      {/* Content Feed */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 border-t-2 border-b-2 border-violet-500 rounded-full animate-spin mb-4"></div>
          <p className="text-violet-300">Loading posts...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 px-4 bg-gray-800/30 backdrop-blur-md rounded-xl border border-violet-500/20 shadow-inner">
          <div className="inline-flex justify-center items-center w-20 h-20 bg-violet-900/20 rounded-full mb-6">
            <span className="material-icons text-4xl text-violet-400">post_add</span>
          </div>
          <h3 className="text-xl font-semibold text-violet-300 mb-2">No posts yet</h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">Be the first to share something with the community!</p>
          <button
            onClick={() => navigate('/create-post')}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors inline-flex items-center gap-2"
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
              className="bg-gray-800/40 backdrop-blur-md rounded-xl border border-violet-500/20 shadow-lg overflow-hidden hover:shadow-violet-900/10 hover:border-violet-500/40 transition-all"
            >
              {/* Post Header */}
              <div className="p-5 flex items-center gap-3">
                <img
                  src={post.userId?.avatar || defaultAvatar}
                  alt={post.userId?.username}
                  className="w-12 h-12 rounded-full border border-violet-500/30 object-cover"
                />
                <div>
                  <h3 className="font-semibold text-lg text-violet-300">
                    {post.userId?.username || "Anonymous"}
                  </h3>
                  <div className="text-sm text-gray-400 flex items-center gap-1">
                    <span className="material-icons text-xs">schedule</span>
                    {new Date(post.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                
                {/* Post Menu */}
                <button className="ml-auto p-2 text-gray-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-full transition-all">
                  <span className="material-icons">more_horiz</span>
                </button>
              </div>

              {/* Post Caption */}
              <div className="px-5 pb-4">
                <p className="text-gray-200 whitespace-pre-line">{post.caption}</p>
              </div>

              {/* Post Image */}
              {post.image && (
                <div 
                  className="cursor-pointer relative group"
                  onClick={() => openPostDetail(post)}
                >
                  <div className="bg-black/40 overflow-hidden">
                    <img
                      src={post.image}
                      alt={post.caption}
                      className="w-full object-cover max-h-[500px] group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                    <div className="p-5 w-full">
                      <p className="text-white text-sm font-medium line-clamp-2">{post.caption}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Post Footer with interactions */}
              <div className="p-4 border-t border-violet-500/10 bg-gray-900/20">
                <div className="flex items-center gap-6 text-gray-300">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpvote(post._id, e);
                    }}
                    className="flex items-center gap-2 hover:text-violet-400 transition-colors group"
                  >
                    <span className={`material-icons text-xl ${post.upvotes?.includes(user?.id) ? 'text-pink-500' : ''} group-hover:scale-110 transition-transform`}>
                      {post.upvotes?.includes(user?.id) ? 'favorite' : 'favorite_border'}
                    </span>
                    <span>{post.upvotes?.length || 0}</span>
                  </button>
                  <button 
                    className="flex items-center gap-2 hover:text-violet-400 transition-colors group"
                    onClick={() => openPostDetail(post)}
                  >
                    <span className="material-icons text-xl group-hover:scale-110 transition-transform">chat_bubble_outline</span>
                    <span>{post.comments?.length || 0}</span>
                  </button>
                  <button className="flex items-center gap-2 hover:text-violet-400 transition-colors group">
                    <span className="material-icons text-xl group-hover:scale-110 transition-transform">share</span>
                  </button>
                  <button 
                    onClick={() => openPostDetail(post)}
                    className="ml-auto text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>

              {/* Achievement Section (for certain posts) */}
              {post.caption?.toLowerCase().includes("certificate") ||
               post.caption?.toLowerCase().includes("achievement") ||
               post.caption?.toLowerCase().includes("award") ? (
                <div className="p-4 bg-gradient-to-r from-violet-900/20 to-indigo-900/20 border-t border-violet-500/20">
                  <div className="flex items-center gap-2">
                    <span className="material-icons text-yellow-400">workspace_premium</span>
                    <span className="text-violet-300 font-medium">Achievement Unlocked</span>
                  </div>
                </div>
               ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-lg bg-gray-900/50 border border-violet-500/20 p-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg text-gray-400 hover:text-violet-400 hover:bg-violet-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    currentPage === pageNum
                      ? 'bg-violet-600 text-white font-medium'
                      : 'text-gray-400 hover:text-violet-400 hover:bg-violet-500/10'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg text-gray-400 hover:text-violet-400 hover:bg-violet-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-icons">chevron_right</span>
            </button>
          </div>
        </div>
      )}

      {/* Post Detail Modal */}
      {showPostModal && selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Modal Backdrop with blur */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={closePostDetail}
          ></div>
          
          {/* Modal Content */}
          <div className="relative w-full max-w-5xl max-h-[90vh] bg-gradient-to-b from-gray-900/95 to-black/95 backdrop-blur-xl rounded-xl border border-violet-500/20 shadow-2xl shadow-violet-900/20 overflow-hidden flex flex-col md:flex-row">
            {/* Close Button */}
            <button
              onClick={closePostDetail}
              className="absolute top-4 right-4 z-10 p-2 bg-black/40 hover:bg-red-500/20 rounded-full text-gray-400 hover:text-red-400 transition-colors"
            >
              <span className="material-icons">close</span>
            </button>
            
            {/* Image Section */}
            {selectedPost.image && (
              <div className="md:w-3/5 bg-black flex items-center justify-center max-h-[60vh] md:max-h-[90vh]">
                <img 
                  src={selectedPost.image} 
                  alt={selectedPost.caption}
                  className="w-full h-full object-contain" 
                />
              </div>
            )}
            
            {/* Content Section */}
            <div className={`${selectedPost.image ? 'md:w-2/5' : 'w-full'} flex flex-col max-h-[90vh] overflow-hidden`}>
              {/* Post Header */}
              <div className="p-5 border-b border-violet-500/20 bg-black/40 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedPost.userId?.avatar || defaultAvatar}
                    alt={selectedPost.userId?.username}
                    className="w-12 h-12 rounded-full border border-violet-500/30"
                  />
                  <div>
                    <h3 className="font-semibold text-lg text-violet-300">
                      {selectedPost.userId?.username || "Anonymous"}
                    </h3>
                    <div className="text-sm text-gray-400">
                      {new Date(selectedPost.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Post Content */}
              <div className="p-5 border-b border-violet-500/20">
                <p className="text-gray-200 whitespace-pre-line">{selectedPost.caption}</p>
                
                {/* Post Actions */}
                <div className="flex items-center gap-6 mt-6 pt-4 border-t border-violet-500/10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpvote(selectedPost._id, e);
                    }}
                    className={`flex items-center gap-2 ${
                      selectedPost.upvotes?.includes(user?.id)
                        ? "text-pink-500"
                        : "text-gray-400 hover:text-pink-400"
                    } transition-colors`}
                  >
                    <span className="material-icons">
                      {selectedPost.upvotes?.includes(user?.id) ? "favorite" : "favorite_border"}
                    </span>
                    <span>{selectedPost.upvotes?.length || 0}</span>
                  </button>
                  <button className="flex items-center gap-2 text-gray-400 hover:text-violet-400 transition-colors">
                    <span className="material-icons">chat_bubble_outline</span>
                    <span>{selectedPost.comments?.length || 0}</span>
                  </button>
                  <button className="flex items-center gap-2 text-gray-400 hover:text-violet-400 transition-colors">
                    <span className="material-icons">share</span>
                  </button>
                  <button className="flex items-center gap-2 text-gray-400 hover:text-violet-400 transition-colors ml-auto">
                    <span className="material-icons">bookmark_border</span>
                  </button>
                </div>
              </div>
              
              {/* Comments Section */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-5">
                  <h3 className="font-medium text-violet-300 mb-4">Comments</h3>
                  
                  {selectedPost.comments?.length === 0 ? (
                    <div className="text-center py-8 bg-black/20 rounded-lg">
                      <span className="material-icons text-3xl text-gray-500 mb-2">chat_bubble_outline</span>
                      <p className="text-gray-400">No comments yet</p>
                      <p className="text-sm text-gray-500 mt-1">Be the first to comment!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedPost.comments?.map((comment) => (
                        <div key={comment._id} className="bg-black/30 rounded-lg p-4 border border-violet-500/10">
                          <div className="flex items-center gap-3 mb-2">
                            <img
                              src={comment.userId?.avatar || defaultAvatar}
                              alt={comment.userId?.username}
                              className="w-8 h-8 rounded-full border border-violet-500/30"
                            />
                            <div>
                              <div className="font-medium text-violet-300">
                                {comment.userId?.username || "Anonymous"}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(comment.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <p className="text-gray-300">{comment.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Comment Form */}
              <div className="p-4 border-t border-violet-500/20 bg-black/40 backdrop-blur-md">
                <form className="flex items-center gap-3">
                  <img
                    src={user?.avatar || defaultAvatar}
                    alt={user?.username || "Your avatar"}
                    className="w-8 h-8 rounded-full border border-violet-500/30"
                  />
                  <input
                    type="text"
                    placeholder={user ? "Write a comment..." : "Log in to comment"}
                    className="flex-1 px-4 py-2 bg-black/30 text-white rounded-full border border-violet-500/30 focus:border-violet-500 focus:outline-none transition-all placeholder-gray-500"
                    disabled={!user}
                  />
                  <button
                    type="submit"
                    disabled={!user}
                    className="p-2 bg-violet-600 text-white rounded-full hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-icons">send</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Posts;
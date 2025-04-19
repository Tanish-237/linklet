// src/pages/Posts.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import styled from "styled-components";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const PostsContainer = styled.div`
  max-width: 800px;
  margin: 50px auto;
  padding: 0 20px;
`;

const PostCard = styled.div`
  background-color: #000;
  border: 1px solid #e1e1e1;
  padding: 20px;
  margin-bottom: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 15px;

  img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    margin-right: 10px;
    object-fit: cover;
  }

  span {
    font-weight: 600;
  }
`;

const PostImage = styled.img`
  width: 100%;
  max-height: 500px;
  object-fit: contain;
  border-radius: 4px;
  margin: 10px 0;
  cursor: pointer;
`;

const PostActions = styled.div`
  display: flex;
  align-items: center;
  margin-top: 15px;
  gap: 15px;

  button {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;

    &:hover {
      opacity: 0.8;
    }
  }
`;

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 30px;
  gap: 10px;

  button {
    padding: 8px 15px;
    border: 1px solid #ddd;
    background: #fff;
    cursor: pointer;
    border-radius: 4px;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &.active {
      background: #007bff;
      color: white;
      border-color: #007bff;
    }
  }
`;

const Loading = styled.div`
  text-align: center;
  padding: 40px;
  font-size: 18px;
  color: #666;
`;

const Posts = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();

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
      const res = await axios.put(
        `http://localhost:5000/api/posts/${postId}/upvote`
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

  if (loading && currentPage === 1) {
    return <Loading>Loading posts...</Loading>;
  }

  return (
    <PostsContainer>
      {posts.length === 0 && !loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          No posts found. Be the first to create one!
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard
              key={post._id}
              onClick={() => navigate(`/posts/${post._id}`)}
            >
              <UserInfo>
                {post.user?.avatar && (
                  <img src={post.user.avatar} alt={post.user.username} />
                )}
                <span>{post.user?.username || "Unknown User"}</span>
              </UserInfo>

              <p>{post.caption}</p>

              {post.image && (
                <PostImage
                  src={post.image}
                  alt={post.caption || "Post image"}
                />
              )}

              <PostActions>
                <button onClick={(e) => handleUpvote(post._id, e)}>
                  ▲ {post.upvotes?.length || 0} Upvotes
                </button>
                <button>💬 {post.comments?.length || 0} Comments</button>
              </PostActions>
            </PostCard>
          ))}

          {totalPages > 1 && (
            <Pagination>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={currentPage === pageNum ? "active" : ""}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </Pagination>
          )}
        </>
      )}
    </PostsContainer>
  );
};

export default Posts;

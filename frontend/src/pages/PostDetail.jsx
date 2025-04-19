import React, { useState, useEffect } from "react";
import axios from "axios";
import styled from "styled-components";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";

const PostDetailContainer = styled.div`
  max-width: 800px;
  margin: 50px auto;
  padding: 20px;
  background-color: #1a1a1a;
  border-radius: 8px;
  box-shadow: 0 2px 15px rgba(0, 0, 0, 0.1);
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 20px;

  img {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    margin-right: 15px;
    object-fit: cover;
  }

  span {
    font-weight: 600;
    font-size: 18px;
  }
`;

const PostContent = styled.div`
  margin-bottom: 30px;
`;

const PostImage = styled.img`
  width: 100%;
  max-height: 500px;
  object-fit: contain;
  border-radius: 5px;
  margin: 15px 0;
`;

const CommentForm = styled.form`
  margin-top: 30px;
  display: flex;
  flex-direction: column;
`;

const CommentInput = styled.textarea`
  padding: 12px;
  margin-bottom: 10px;
  background-color: #333;
  color: #f5f5f5;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  outline: none;
  resize: none;
`;

const CommentButton = styled.button`
  padding: 12px;
  background-color: #1db954;
  color: #fff;
  border: none;
  border-radius: 5px;
  font-size: 18px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: #1db954b3;
  }

  &:disabled {
    background-color: #666;
    cursor: not-allowed;
  }
`;

const CommentList = styled.div`
  margin-top: 30px;
`;

const CommentCard = styled.div`
  background-color: #333;
  padding: 15px;
  margin: 10px 0;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const CommentUser = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 10px;

  img {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    margin-right: 10px;
    object-fit: cover;
  }

  span {
    font-weight: 500;
    font-size: 14px;
  }
`;

const Loading = styled.div`
  text-align: center;
  padding: 50px;
  font-size: 18px;
`;

const AvatarPlaceholder = styled.div`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  margin-right: 15px;
  background-color: #333;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
`;

const PostDetail = () => {
  const { postId } = useParams();
  const [post, setPost] = useState({});
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);

  useEffect(() => {
    const fetchPostDetail = async () => {
      try {
        setLoading(true);

        // First fetch the post
        const postResponse = await axios.get(
          `http://localhost:5000/api/posts/${postId}`
        );

        if (!postResponse.data) {
          throw new Error("Post not found");
        }

        setPost(postResponse.data.post);
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

    fetchPostDetail();
    setComments(post.comments || []);
  }, [postId]);

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

    try {
      setCommentLoading(true);
      const res = await axios.post(
        `http://localhost:5000/api/posts/${postId}/comments`,
        { text: commentText }
      );

      setComments((prev) => [res.data, ...prev]);
      setCommentText("");
      toast.success("Comment added successfully");
    } catch (error) {
      toast.error("Failed to add comment");
      console.error("Error adding comment:", error);
    } finally {
      setCommentLoading(false);
    }
  };

  if (loading) {
    return <Loading>Loading post details...</Loading>;
  }

  if (!post) {
    return <Loading>Post not found</Loading>;
  }

  return (
    <PostDetailContainer>
      <UserInfo>
        {post.userId?.avatar && (
          <img src={post.userId.avatar} alt={post.userId.username} />
        )}
        <span>{post.userId?.username || "Unknown User"}</span>
      </UserInfo>

      <PostContent>
        <h2>{post.caption}</h2>
        {post.image && (
          <PostImage src={post.image} alt={post.caption || "Post image"} />
        )}
        <p>Upvotes: {post.upvotes?.length || 0}</p>
        <p>Posted on: {formatDate(post.createdAt)}</p>
      </PostContent>

      <CommentForm onSubmit={handleCommentSubmit}>
        <CommentInput
          rows="4"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write a comment..."
          required
        />
        <CommentButton type="submit" disabled={commentLoading}>
          {commentLoading ? "Posting..." : "Post Comment"}
        </CommentButton>
      </CommentForm>

      <CommentList>
        <h3>Comments ({comments.length})</h3>
        {comments.length === 0 ? (
          <p>No comments yet. Be the first to comment!</p>
        ) : (
          comments.map((comment) => (
            <CommentCard key={comment._id}>
              <CommentUser>
                {comment.userId?.avatar && (
                  <img
                    src={comment.userId.avatar}
                    alt={comment.userId.username}
                  />
                )}
                <span>{comment.userId?.username || "Anonymous"}</span>
              </CommentUser>
              <p>{comment.text}</p>
              <small>{new Date(comment.createdAt).toLocaleString()}</small>
            </CommentCard>
          ))
        )}
      </CommentList>
    </PostDetailContainer>
  );
};

export default PostDetail;

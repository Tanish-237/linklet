import React, { useState, useEffect } from "react";
import axios from "axios";
import styled from "styled-components";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { handleApiError } from "../utlis/ErrorHandler";

const PostDetailContainer = styled.div`
  max-width: 800px;
  margin: 50px auto;
  padding: 25px;
  background-color: #1a1a1a;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 20px;

  img {
    width: 55px;
    height: 55px;
    border-radius: 50%;
    margin-right: 15px;
    object-fit: cover;
    border: 2px solid #2d2d2d;
  }

  span {
    font-weight: 600;
    font-size: 18px;
    color: #f5f5f5;
  }
`;

const PostContent = styled.div`
  margin-bottom: 30px;
  
  h2 {
    font-size: 24px;
    margin-bottom: 15px;
    color: #1db954;
  }
`;

const PostImage = styled.img`
  width: 100%;
  max-height: 500px;
  object-fit: contain;
  border-radius: 8px;
  margin: 15px 0;
  background-color: #2d2d2d;
`;

const PostStats = styled.div`
  display: flex;
  gap: 15px;
  margin-top: 15px;
  color: #b3b3b3;
  font-size: 15px;
`;

const Divider = styled.div`
  height: 1px;
  background-color: #333;
  margin: 25px 0;
`;

const CommentForm = styled.form`
  margin-top: 30px;
  display: flex;
  flex-direction: column;
`;

const CommentInput = styled.textarea`
  padding: 15px;
  margin-bottom: 12px;
  background-color: #333;
  color: #f5f5f5;
  border: 1px solid #444;
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  resize: none;
  transition: border-color 0.3s;
  
  &:focus {
    border-color: #1db954;
  }
`;

const CommentButton = styled.button`
  padding: 12px;
  background-color: #1db954;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s, transform 0.2s;

  &:hover {
    background-color: #1ed760;
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    background-color: #666;
    cursor: not-allowed;
    transform: none;
  }
`;

const CommentList = styled.div`
  margin-top: 30px;
  
  h3 {
    font-size: 20px;
    margin-bottom: 15px;
    color: #1db954;
  }
`;

const CommentCard = styled.div`
  background-color: #2d2d2d;
  padding: 18px;
  margin: 12px 0;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
  
  &:hover {
    transform: translateY(-3px);
  }
`;

const CommentUser = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 10px;

  img {
    width: 35px;
    height: 35px;
    border-radius: 50%;
    margin-right: 10px;
    object-fit: cover;
    border: 1px solid #444;
  }

  span {
    font-weight: 500;
    font-size: 15px;
    color: #e1e1e1;
  }
`;

const CommentText = styled.p`
  color: #f5f5f5;
  margin-bottom: 8px;
  line-height: 1.4;
`;

const CommentTime = styled.small`
  color: #999;
  font-size: 12px;
`;

const Loading = styled.div`
  text-align: center;
  padding: 80px 0;
  font-size: 18px;
  color: #999;
`;

const AvatarPlaceholder = styled.div`
  width: ${props => props.size || "50px"};
  height: ${props => props.size || "50px"};
  border-radius: 50%;
  margin-right: 15px;
  background-color: #333;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: ${props => props.fontSize || "18px"};
`;

const NoCommentsMessage = styled.p`
  text-align: center;
  padding: 25px;
  background-color: #2d2d2d;
  border-radius: 8px;
  color: #b3b3b3;
  font-style: italic;
`;

const BackButton = styled.button`
  background-color: transparent;
  color: #1db954;
  border: none;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  
  &:hover {
    text-decoration: underline;
  }
  
  &::before {
    content: "←";
    margin-right: 5px;
  }
`;

const PostDetail = () => {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPostDetail = async () => {
      try {
        setLoading(true);

        // Fetch the post with its comments
        const postResponse = await axios.get(
          `http://localhost:5000/api/posts/${postId}`
        );

        if (!postResponse.data) {
          throw new Error("Post not found");
        }

        setPost(postResponse.data.post);
        // Initialize comments from post data
        setComments(postResponse.data.post.comments || []);
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
    if (!user) {
      toast.error("Please log in to comment");
      return;
    }

    try {
      setCommentLoading(true);
      
      // Get token from cookies (handled by withCredentials)
      const response = await axios.post(
        `http://localhost:5000/api/posts/${postId}/comments`,
        { text: commentText },
        { withCredentials: true }
      );

      if (response.data.success) {
        // Update post with the new comment data
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

  const goBack = () => {
    navigate(-1);
  };

  if (loading) {
    return <Loading>Loading post details...</Loading>;
  }

  if (!post) {
    return <Loading>Post not found</Loading>;
  }

  return (
    <PostDetailContainer>
      <BackButton onClick={goBack}>Back to posts</BackButton>
      
      <UserInfo>
        {post.userId?.avatar ? (
          <img src={post.userId.avatar} alt={post.userId.username} />
        ) : (
          <AvatarPlaceholder>
            {post.userId?.username?.charAt(0).toUpperCase() || "U"}
          </AvatarPlaceholder>
        )}
        <span>{post.userId?.username || "Unknown User"}</span>
      </UserInfo>

      <PostContent>
        <h2>{post.caption}</h2>
        {post.image && (
          <PostImage src={post.image} alt={post.caption || "Post image"} />
        )}
        <PostStats>
          <p>👍 {post.upvotes?.length || 0} upvotes</p>
          <p>💬 {post.comments?.length || 0} comments</p>
          <p>🕒 {formatDate(post.createdAt)}</p>
        </PostStats>
      </PostContent>

      <Divider />

      <CommentForm onSubmit={handleCommentSubmit}>
        <CommentInput
          rows="4"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={user ? "Write a comment..." : "Log in to comment"}
          required
          disabled={!user}
        />
        <CommentButton type="submit" disabled={commentLoading || !user}>
          {commentLoading ? "Posting..." : "Post Comment"}
        </CommentButton>
      </CommentForm>

      <CommentList>
        <h3>Comments ({post.comments?.length || 0})</h3>
        {!post.comments || post.comments.length === 0 ? (
          <NoCommentsMessage>No comments yet. Be the first to comment!</NoCommentsMessage>
        ) : (
          post.comments.map((comment) => (
            <CommentCard key={comment._id}>
              <CommentUser>
                {comment.userId?.avatar ? (
                  <img
                    src={comment.userId.avatar}
                    alt={comment.userId.username}
                  />
                ) : (
                  <AvatarPlaceholder size="35px" fontSize="14px">
                    {comment.userId?.username?.charAt(0).toUpperCase() || "U"}
                  </AvatarPlaceholder>
                )}
                <span>{comment.userId?.username || "Anonymous"}</span>
              </CommentUser>
              <CommentText>{comment.text}</CommentText>
              <CommentTime>{formatDate(comment.createdAt)}</CommentTime>
            </CommentCard>
          ))
        )}
      </CommentList>
    </PostDetailContainer>
  );
};

export default PostDetail;
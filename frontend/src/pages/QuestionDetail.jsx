import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import useAuthStore from '../store/useAuthStore';
import defaultAvatar from '../assets/default-avatar.png';
import './HelpForum.css';
import {
  getQuestion,
  voteQuestion as apiVoteQuestion,
  postAnswer as apiPostAnswer,
  voteAnswer as apiVoteAnswer,
  acceptAnswer as apiAcceptAnswer,
  deleteAnswer as apiDeleteAnswer,
  deleteQuestion as apiDeleteQuestion,
  addComment as apiAddComment,
  voteComment as apiVoteComment,
  deleteComment as apiDeleteComment,
} from '../api/question.api';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

/**
 * Helper function to parse plain text and render URLs as clickable links.
 */
const renderTextWithLinks = (text) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(/^https?:\/\//) || part.match(/^www\./)) {
      const href = part.startsWith('www.') ? `http://${part}` : part;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="hf-text-link"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

// ─── Reddit-Style Threaded Comment Single Node ─────────────────────────────────

const ThreadedCommentItem = ({
  comment,
  allComments,
  answerId,
  questionId,
  currentUserId,
  opUserId,
  onAddComment,
  onVoteComment,
  onDeleteComment,
  depth = 0,
}) => {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const curUserIdStr = (currentUserId?._id || currentUserId?.id || currentUserId)?.toString();
  const commentAuthorId = (comment.userId?._id || comment.userId?.id || comment.userId)?.toString();
  const opUserIdStr = (opUserId?._id || opUserId?.id || opUserId)?.toString();

  const isCommentOwner = Boolean(commentAuthorId && curUserIdStr && commentAuthorId === curUserIdStr);
  const isOP = Boolean(commentAuthorId && opUserIdStr && commentAuthorId === opUserIdStr);

  // Children matching parentId
  const childReplies = allComments.filter(
    (c) => (c.parentId?._id || c.parentId)?.toString() === (comment._id || comment.id)?.toString()
  );

  const upvotes = comment.upvotes || [];
  const downvotes = comment.downvotes || [];
  const netVotes = upvotes.length - downvotes.length;
  const userVote = upvotes.some((id) => (id._id || id)?.toString() === curUserIdStr)
    ? 'upvote'
    : downvotes.some((id) => (id._id || id)?.toString() === curUserIdStr)
    ? 'downvote'
    : null;

  const handlePostReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await onAddComment(questionId, answerId, replyText.trim(), comment._id || comment.id);
      setReplyText('');
      setIsReplying(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`qd-threaded-node ${depth > 0 ? 'qd-nested' : ''}`}>
      {/* Vertical Thread Line */}
      <div className="qd-comment-card">
        {/* Header */}
        <div className="qd-comment-header">
          <button
            className="qd-collapse-btn"
            onClick={() => setCollapsed((p) => !p)}
            title={collapsed ? 'Expand thread' : 'Collapse thread'}
          >
            {collapsed ? '+' : '−'}
          </button>

          <Link
            to={`/dashboard/profile/${comment.userId?.username}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
          >
            <img
              src={comment.userId?.avatar || defaultAvatar}
              alt={comment.userId?.username || 'user'}
              className="qd-comment-avatar"
            />
            <span className="qd-comment-author-name">{comment.userId?.username || 'Unknown'}</span>
          </Link>

          {isOP && <span className="qd-op-badge" title="Original Question Author">OP</span>}

          <span className="qd-comment-time">· {timeAgo(comment.createdAt)}</span>
        </div>

        {/* Body & Actions (Hidden if collapsed) */}
        {!collapsed && (
          <div className="qd-comment-content">
            <p className="qd-comment-text-body">{renderTextWithLinks(comment.text)}</p>

            {/* Comment Controls Footer */}
            <div className="qd-comment-footer">
              {/* Vote controls */}
              <div className="qd-comment-vote-box">
                <button
                  className={`qd-comment-vote-btn ${userVote === 'upvote' ? 'voted-up' : ''}`}
                  onClick={() => onVoteComment(answerId, (comment._id || comment.id)?.toString(), 'upvote')}
                  aria-label="Upvote comment"
                >
                  ▲
                </button>
                <span className="qd-comment-vote-count">{netVotes}</span>
                <button
                  className={`qd-comment-vote-btn ${userVote === 'downvote' ? 'voted-down' : ''}`}
                  onClick={() => onVoteComment(answerId, (comment._id || comment.id)?.toString(), 'downvote')}
                  aria-label="Downvote comment"
                >
                  ▼
                </button>
              </div>

              {/* Reply trigger */}
              <button
                className="qd-comment-action-btn"
                onClick={() => {
                  if (!curUserIdStr) {
                    toast.info('Please log in to reply');
                    return;
                  }
                  setIsReplying((p) => !p);
                }}
              >
                <span className="material-icons" style={{ fontSize: '0.85rem' }}>reply</span>
                Reply
              </button>

              {/* Delete trigger */}
              {isCommentOwner && (
                <button
                  className="qd-comment-action-btn delete"
                  onClick={() => onDeleteComment(questionId, answerId, comment._id || comment.id)}
                  title="Delete comment"
                >
                  <span className="material-icons" style={{ fontSize: '0.85rem' }}>delete_outline</span>
                  Delete
                </button>
              )}
            </div>

            {/* Inline Nested Reply Form */}
            {isReplying && (
              <div className="qd-nested-reply-box">
                <textarea
                  className="qd-nested-reply-input"
                  placeholder={`Replying to @${comment.userId?.username || 'user'}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                  <button
                    className="hf-btn-secondary"
                    style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}
                    onClick={() => setIsReplying(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="hf-btn-primary"
                    style={{ padding: '0.25rem 0.85rem', fontSize: '0.78rem' }}
                    onClick={handlePostReply}
                    disabled={!replyText.trim() || submitting}
                  >
                    {submitting ? '...' : 'Reply'}
                  </button>
                </div>
              </div>
            )}

            {/* Render Nested Children Replies */}
            {childReplies.length > 0 && (
              <div className="qd-thread-children">
                {childReplies.map((child) => (
                  <ThreadedCommentItem
                    key={child._id}
                    comment={child}
                    allComments={allComments}
                    answerId={answerId}
                    questionId={questionId}
                    currentUserId={currentUserId}
                    opUserId={opUserId}
                    onAddComment={onAddComment}
                    onVoteComment={onVoteComment}
                    onDeleteComment={onDeleteComment}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Reddit-Style Threaded Comment List Container ──────────────────────────────

const ThreadedCommentList = ({
  comments = [],
  answerId,
  questionId,
  currentUserId,
  opUserId,
  onAddComment,
  onVoteComment,
  onDeleteComment,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [topText, setTopText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Top-level comments have parentId === null or undefined
  const topLevelComments = comments.filter((c) => !c.parentId);

  const handlePostTopComment = async () => {
    if (!topText.trim()) return;
    setSubmitting(true);
    try {
      await onAddComment(questionId, answerId, topText.trim(), null);
      setTopText('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="qd-comments-section">
      <button
        className="qd-comments-toggle"
        onClick={() => setExpanded((p) => !p)}
      >
        <span className="material-icons" style={{ fontSize: '0.9rem' }}>
          {expanded ? 'expand_less' : 'chat_bubble_outline'}
        </span>
        {comments?.length > 0
          ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}`
          : 'Add a comment'}
      </button>

      {expanded && (
        <div className="qd-comments-container">
          {/* Top-Level Add Comment Form */}
          {currentUserId && (
            <div className="qd-add-comment-row" style={{ marginBottom: '1.25rem' }}>
              <input
                className="qd-comment-input"
                type="text"
                placeholder="Write a top-level comment..."
                value={topText}
                onChange={(e) => setTopText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePostTopComment()}
                maxLength={1000}
              />
              <button
                className="qd-comment-submit"
                onClick={handlePostTopComment}
                disabled={!topText.trim() || submitting}
              >
                {submitting ? '...' : 'Comment'}
              </button>
            </div>
          )}

          {/* Render Top-Level Threads */}
          {topLevelComments.length > 0 ? (
            <div className="qd-threaded-tree">
              {topLevelComments.map((c) => (
                <ThreadedCommentItem
                  key={c._id}
                  comment={c}
                  allComments={comments}
                  answerId={answerId}
                  questionId={questionId}
                  currentUserId={currentUserId}
                  opUserId={opUserId}
                  onAddComment={onAddComment}
                  onVoteComment={onVoteComment}
                  onDeleteComment={onDeleteComment}
                  depth={0}
                />
              ))}
            </div>
          ) : (
            <p className="qd-no-comments">No comments yet. Be the first to start a discussion!</p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Answer Card ───────────────────────────────────────────────────────────────

const AnswerCard = ({
  answer,
  questionId,
  questionAuthorId,
  currentUserId,
  onVote,
  onAccept,
  onDelete,
  onAddComment,
  onVoteComment,
  onDeleteComment,
}) => {
  const isAccepted = answer.isAccepted === true;
  const netVotes = (answer.upvotes?.length || 0) - (answer.downvotes?.length || 0);
  const userVote = answer.upvotes?.some((id) => (id._id || id)?.toString() === currentUserId)
    ? 'upvote'
    : answer.downvotes?.some((id) => (id._id || id)?.toString() === currentUserId)
    ? 'downvote'
    : null;

  const isAnswerOwner = answer.userId?._id?.toString() === currentUserId ||
    answer.userId?.toString() === currentUserId;

  return (
    <div className={`qd-answer-card ${isAccepted ? 'accepted' : ''}`}>
      {/* Accepted badge */}
      <div className="qd-accepted-badge">
        <span className="material-icons" style={{ fontSize: '0.85rem' }}>check_circle</span>
        Accepted Answer
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {/* Vote column */}
        <div className="hf-vote-col">
          {isAccepted && <div className="qd-checkmark">✓</div>}
          <button
            className={`hf-vote-btn ${userVote === 'upvote' ? 'voted-up' : ''}`}
            onClick={() => onVote(answer._id, 'upvote')}
            aria-label="Upvote answer"
          >
            <span className="material-icons" style={{ fontSize: '1rem' }}>arrow_upward</span>
          </button>
          <span className="hf-vote-count">{netVotes}</span>
          <button
            className={`hf-vote-btn ${userVote === 'downvote' ? 'voted-down' : ''}`}
            onClick={() => onVote(answer._id, 'downvote')}
            aria-label="Downvote answer"
          >
            <span className="material-icons" style={{ fontSize: '1rem' }}>arrow_downward</span>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="qd-answer-body">{renderTextWithLinks(answer.body)}</div>

          {/* Author footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="hf-author-row" style={{ marginTop: 0 }}>
              <Link
                to={`/dashboard/profile/${answer.userId?.username}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', textDecoration: 'none' }}
              >
                <img
                  src={answer.userId?.avatar || defaultAvatar}
                  alt={answer.userId?.username || 'user'}
                  className="hf-author-avatar"
                />
                <span className="hf-author-name">{answer.userId?.username || 'Unknown'}</span>
              </Link>
              <span>·</span>
              <span style={{ fontSize: '0.78rem', color: '#475569' }}>{timeAgo(answer.createdAt)}</span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {questionAuthorId && currentUserId && questionAuthorId.toString() === currentUserId.toString() && (
                <button
                  className={`qd-accept-btn ${isAccepted ? 'is-accepted' : ''}`}
                  onClick={() => onAccept(answer._id)}
                  title={isAccepted ? 'Unaccept answer' : 'Accept as answer'}
                >
                  <span className="material-icons" style={{ fontSize: '0.9rem' }}>
                    {isAccepted ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  {isAccepted ? 'Accepted' : 'Accept'}
                </button>
              )}
              {isAnswerOwner && (
                <button
                  className="qd-delete-btn"
                  onClick={() => onDelete(answer._id)}
                  title="Delete answer"
                >
                  <span className="material-icons" style={{ fontSize: '0.9rem' }}>delete_outline</span>
                </button>
              )}
            </div>
          </div>

          {/* Reddit-style Threaded Comments */}
          <ThreadedCommentList
            comments={answer.comments || []}
            answerId={answer._id}
            questionId={questionId}
            currentUserId={currentUserId}
            opUserId={questionAuthorId}
            onAddComment={onAddComment}
            onVoteComment={onVoteComment}
            onDeleteComment={onDeleteComment}
          />
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const QuestionDetail = ({ basePath = '' }) => {
  const { questionId } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Answer form
  const [answerBody, setAnswerBody] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchQuestion = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      console.log('[QuestionDetail] Fetching question:', questionId);
      const data = await getQuestion(questionId);
      setQuestion(data);

      // Sort answers: accepted first, then by votes, then by date
      const sorted = [...(data.answers || [])].sort((a, b) => {
        if (a.isAccepted !== b.isAccepted) return b.isAccepted ? 1 : -1;
        const aNet = (a.upvotes?.length || 0) - (a.downvotes?.length || 0);
        const bNet = (b.upvotes?.length || 0) - (b.downvotes?.length || 0);
        if (aNet !== bNet) return bNet - aNet;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
      setAnswers(sorted);
    } catch (err) {
      console.error('[QuestionDetail] Fetch failed:', err);
      toast.error('Failed to load question');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    fetchQuestion(true);
  }, [fetchQuestion]);

  // ─── Vote Question ───────────────────────────────────────────────────────────

  const handleVoteQuestion = async (voteType) => {
    if (!user) { toast.info('Please log in to vote'); return; }

    const isQuestionOwner = question?.userId?._id?.toString() === user?._id ||
      question?.userId?.toString() === user?._id;

    if (isQuestionOwner) {
      toast.error("You cannot vote on your own question");
      return;
    }

    const prevQuestion = question;

    // Optimistic
    setQuestion((prev) => {
      if (!prev) return prev;
      const userId = user._id;
      let upvotes = [...(prev.upvotes || [])];
      let downvotes = [...(prev.downvotes || [])];
      const alreadyUp = upvotes.some((id) => (id._id || id)?.toString() === userId);
      const alreadyDown = downvotes.some((id) => (id._id || id)?.toString() === userId);

      if (voteType === 'upvote') {
        if (alreadyUp) upvotes = upvotes.filter((id) => (id._id || id)?.toString() !== userId);
        else { upvotes.push({ _id: userId }); downvotes = downvotes.filter((id) => (id._id || id)?.toString() !== userId); }
      } else {
        if (alreadyDown) downvotes = downvotes.filter((id) => (id._id || id)?.toString() !== userId);
        else { downvotes.push({ _id: userId }); upvotes = upvotes.filter((id) => (id._id || id)?.toString() !== userId); }
      }
      return { ...prev, upvotes, downvotes };
    });

    try {
      await apiVoteQuestion(questionId, voteType);
    } catch (err) {
      setQuestion(prevQuestion); // Rollback cleanly without page refresh
      const msg = err?.response?.data?.message;
      if (msg) toast.error(msg);
    }
  };

  // ─── Submit Answer ───────────────────────────────────────────────────────────

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!user) { toast.error('Please log in to answer'); return; }
    if (!answerBody.trim() || answerBody.trim().length < 10) {
      toast.error('Answer must be at least 10 characters');
      return;
    }

    console.log('[QuestionDetail] Posting answer...');
    setSubmittingAnswer(true);
    try {
      const newAnswer = await apiPostAnswer(questionId, answerBody.trim());
      setAnswers((prev) => [...prev, newAnswer]);
      setQuestion((prev) => prev ? { ...prev, answers: [...(prev.answers || []), newAnswer] } : prev);
      setAnswerBody('');
      toast.success('Answer posted!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to post answer');
    } finally {
      setSubmittingAnswer(false);
    }
  };

  // ─── Vote Answer ─────────────────────────────────────────────────────────────

  const handleVoteAnswer = async (answerId, voteType) => {
    if (!user) { toast.info('Please log in to vote'); return; }

    const targetAnswer = answers.find((a) => a._id === answerId);
    const isAnswerOwner = targetAnswer?.userId?._id?.toString() === user?._id ||
      targetAnswer?.userId?.toString() === user?._id;

    if (isAnswerOwner) {
      toast.error("You cannot vote on your own answer");
      return;
    }

    const prevAnswers = answers;

    // Optimistic
    setAnswers((prev) =>
      prev.map((a) => {
        if (a._id !== answerId) return a;
        const userId = user._id;
        let upvotes = [...(a.upvotes || [])];
        let downvotes = [...(a.downvotes || [])];
        const alreadyUp = upvotes.some((id) => (id._id || id)?.toString() === userId);
        const alreadyDown = downvotes.some((id) => (id._id || id)?.toString() === userId);

        if (voteType === 'upvote') {
          if (alreadyUp) upvotes = upvotes.filter((id) => (id._id || id)?.toString() !== userId);
          else { upvotes.push({ _id: userId }); downvotes = downvotes.filter((id) => (id._id || id)?.toString() !== userId); }
        } else {
          if (alreadyDown) downvotes = downvotes.filter((id) => (id._id || id)?.toString() !== userId);
          else { downvotes.push({ _id: userId }); upvotes = upvotes.filter((id) => (id._id || id)?.toString() !== userId); }
        }
        return { ...a, upvotes, downvotes };
      })
    );

    try {
      await apiVoteAnswer(questionId, answerId, voteType);
    } catch (err) {
      setAnswers(prevAnswers); // Rollback cleanly without page refresh
      const msg = err?.response?.data?.message;
      if (msg) toast.error(msg);
    }
  };

  // ─── Accept Answer ───────────────────────────────────────────────────────────

  const handleAcceptAnswer = async (answerId) => {
    try {
      const result = await apiAcceptAnswer(questionId, answerId);

      setAnswers((prev) =>
        prev.map((a) => (a._id === answerId ? { ...a, isAccepted: result.accepted } : a))
      );
      toast.success(result.accepted ? 'Answer marked as accepted!' : 'Answer unmarked as accepted');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update accepted answer');
    }
  };

  // ─── Delete Answer ────────────────────────────────────────────────────────────

  // ─── Delete Confirmation Modal State ──────────────────────────
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  const promptDeleteAnswer = (answerId) => {
    setDeleteConfirmTarget({ type: 'answer', answerId, title: 'Delete Answer', message: 'Are you sure you want to delete this answer?' });
  };

  const promptDeleteQuestion = () => {
    setDeleteConfirmTarget({ type: 'question', title: 'Delete Question', message: 'Are you sure you want to delete this question and all its answers? This action cannot be undone.' });
  };

  // ─── Add & Vote Comments ──────────────────────────────────────────────────────

  const handleAddComment = async (qId, answerId, text, parentId = null) => {
    try {
      console.log('[QuestionDetail] Adding comment to answer:', answerId, 'parentId:', parentId);
      const updatedAnswer = await apiAddComment(qId, answerId, text, parentId);
      setAnswers((prev) =>
        prev.map((a) => (a._id === answerId ? { ...a, comments: updatedAnswer.comments } : a))
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add comment');
      throw err;
    }
  };

  const handleVoteComment = async (answerId, commentId, voteType) => {
    if (!user) {
      toast.info('Please log in to vote on comments');
      return;
    }

    const targetCommentId = commentId.toString();

    // Optimistic UI update
    setAnswers((prev) =>
      prev.map((a) => {
        if (a._id !== answerId) return a;
        const updatedComments = (a.comments || []).map((c) => {
          const cId = (c._id || c.id)?.toString();
          if (cId !== targetCommentId) return c;

          const userId = user._id.toString();
          let upvotes = [...(c.upvotes || [])];
          let downvotes = [...(c.downvotes || [])];

          const alreadyUp = upvotes.some((id) => (id._id || id)?.toString() === userId);
          const alreadyDown = downvotes.some((id) => (id._id || id)?.toString() === userId);

          if (voteType === 'upvote') {
            if (alreadyUp) {
              upvotes = upvotes.filter((id) => (id._id || id)?.toString() !== userId);
            } else {
              upvotes.push({ _id: userId });
              downvotes = downvotes.filter((id) => (id._id || id)?.toString() !== userId);
            }
          } else {
            if (alreadyDown) {
              downvotes = downvotes.filter((id) => (id._id || id)?.toString() !== userId);
            } else {
              downvotes.push({ _id: userId });
              upvotes = upvotes.filter((id) => (id._id || id)?.toString() !== userId);
            }
          }
          return { ...c, upvotes, downvotes };
        });
        return { ...a, comments: updatedComments };
      })
    );

    try {
      const updatedAnswer = await apiVoteComment(questionId, answerId, targetCommentId, voteType);
      setAnswers((prev) =>
        prev.map((a) => (a._id === answerId ? { ...a, comments: updatedAnswer.comments } : a))
      );
    } catch (err) {
      const msg = err?.response?.data?.message;
      if (msg) toast.error(msg);
      fetchQuestion();
    }
  };

  const promptDeleteComment = (qId, answerId, commentId) => {
    setDeleteConfirmTarget({ type: 'comment', qId, answerId, commentId, title: 'Delete Comment', message: 'Are you sure you want to delete this comment and its replies?' });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    const { type, answerId, qId, commentId } = deleteConfirmTarget;
    setDeleteConfirmTarget(null);

    if (type === 'answer') {
      try {
        await apiDeleteAnswer(questionId, answerId);
        setAnswers((prev) => prev.filter((a) => a._id !== answerId));
        setQuestion((prev) =>
          prev
            ? { ...prev, answers: prev.answers.filter((a) => (a._id || a) !== answerId) }
            : prev
        );
        toast.success('Answer deleted');
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to delete answer');
      }
    } else if (type === 'question') {
      try {
        await apiDeleteQuestion(questionId);
        toast.success('Question deleted');
        navigate(`${basePath}/dashboard/help`);
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to delete question');
      }
    } else if (type === 'comment') {
      try {
        const updatedAnswer = await apiDeleteComment(qId, answerId, commentId);
        setAnswers((prev) =>
          prev.map((a) => (a._id === answerId ? { ...a, comments: updatedAnswer.comments } : a))
        );
        toast.success('Comment deleted');
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to delete comment');
      }
    }
  };

  // ─── Loading / Not Found ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="qd-root">
        <div className="hf-loading-center">
          <div className="hf-spinner" />
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="qd-root">
        <div className="hf-empty" style={{ paddingTop: '5rem' }}>
          <span className="material-icons" style={{ fontSize: '4rem', opacity: 0.3 }}>help_off</span>
          <h3>Question not found</h3>
          <p>This question may have been deleted.</p>
          <Link to={`${basePath}/dashboard/help`} className="qd-back-link" style={{ marginTop: '1rem', display: 'inline-flex' }}>
            ← Back to Forum
          </Link>
        </div>
      </div>
    );
  }

  const netVotes = (question.upvotes?.length || 0) - (question.downvotes?.length || 0);
  const userVoteQ = question.upvotes?.some((id) => (id._id || id)?.toString() === user?._id)
    ? 'upvote'
    : question.downvotes?.some((id) => (id._id || id)?.toString() === user?._id)
    ? 'downvote'
    : null;
  const isQuestionOwner = question.userId?._id?.toString() === user?._id ||
    question.userId?.toString() === user?._id;

  const hasQuestionAccepted =
    (Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length > 0) ||
    (Array.isArray(answers) && answers.some((a) => a.isAccepted === true));

  return (
    <div className="qd-root">
      {/* Back Link */}
      <Link
        to={`${basePath}/dashboard/help`}
        className="qd-back-link"
        id="qd-back-link"
      >
        <span className="material-icons" style={{ fontSize: '1rem' }}>arrow_back</span>
        Back to Questions
      </Link>

      {/* Question Card */}
      <div className="qd-question-card">
        <h1 className="qd-question-title">{question.title}</h1>

        {/* Category + Tags + Solved */}
        <div className="hf-tags-row" style={{ marginBottom: '1rem' }}>
          {hasQuestionAccepted && (
            <span className="hf-solved-badge">
              <span className="material-icons" style={{ fontSize: '0.85rem' }}>check_circle</span>
              Solved
            </span>
          )}
          <span className="hf-category-badge">{question.category}</span>
          {question.tags?.map((tag) => (
            <span key={tag} className="hf-tag">#{tag}</span>
          ))}
        </div>

        <p className="qd-question-body">{renderTextWithLinks(question.body)}</p>

        {/* Meta row */}
        <div className="qd-meta-row">
          <Link
            to={`/dashboard/profile/${question.userId?.username}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', textDecoration: 'none' }}
          >
            <img
              src={question.userId?.avatar || defaultAvatar}
              alt={question.userId?.username}
              className="hf-author-avatar"
            />
            <span className="hf-author-name">{question.userId?.username}</span>
          </Link>
          <span className="qd-meta-item">
            <span className="material-icons">schedule</span>
            {timeAgo(question.createdAt)}
          </span>
          <span className="qd-meta-item">
            <span className="material-icons">visibility</span>
            {question.views} views
          </span>
          <span className="qd-meta-item">
            <span className="material-icons">question_answer</span>
            {answers.length} {answers.length === 1 ? 'answer' : 'answers'}
          </span>
        </div>

        {/* Question actions */}
        <div className="qd-question-actions">
          {/* Vote */}
          <button
            id="qd-upvote-btn"
            className={`hf-vote-btn ${userVoteQ === 'upvote' ? 'voted-up' : ''}`}
            onClick={() => handleVoteQuestion('upvote')}
            aria-label="Upvote question"
          >
            <span className="material-icons" style={{ fontSize: '1rem' }}>arrow_upward</span>
          </button>
          <span className="hf-vote-count" style={{ minWidth: 28, textAlign: 'center' }}>{netVotes}</span>
          <button
            id="qd-downvote-btn"
            className={`hf-vote-btn ${userVoteQ === 'downvote' ? 'voted-down' : ''}`}
            onClick={() => handleVoteQuestion('downvote')}
            aria-label="Downvote question"
          >
            <span className="material-icons" style={{ fontSize: '1rem' }}>arrow_downward</span>
          </button>

          <div style={{ flex: 1 }} />

          {isQuestionOwner && (
            <button
              id="qd-delete-question-btn"
              className="qd-delete-btn"
              onClick={promptDeleteQuestion}
              title="Delete question"
            >
              <span className="material-icons" style={{ fontSize: '0.9rem' }}>delete_outline</span>
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Answers Section */}
      <div>
        <div className="qd-answers-header">
          <h2 className="qd-answers-title">
            {answers.length} {answers.length === 1 ? 'Answer' : 'Answers'}
          </h2>
        </div>

        {answers.length === 0 ? (
          <div className="hf-empty" style={{ padding: '2rem' }}>
            <span className="material-icons" style={{ fontSize: '2.5rem', opacity: 0.3 }}>question_answer</span>
            <h3>No answers yet</h3>
            <p>Be the first to answer this question!</p>
          </div>
        ) : (
          answers.map((answer) => (
            <AnswerCard
              key={answer._id}
              answer={answer}
              questionId={questionId}
              questionAuthorId={question.userId?._id || question.userId}
              currentUserId={user?._id}
              onVote={handleVoteAnswer}
              onAccept={handleAcceptAnswer}
              onDelete={promptDeleteAnswer}
              onAddComment={handleAddComment}
              onVoteComment={handleVoteComment}
              onDeleteComment={promptDeleteComment}
            />
          ))
        )}
      </div>

      {/* Answer Form */}
      <div className="qd-answer-form-card" id="answer-form">
        <h2 className="qd-answer-form-title">Your Answer</h2>
        {user ? (
          <form onSubmit={handleSubmitAnswer}>
            <textarea
              id="qd-answer-textarea"
              className="qd-answer-textarea"
              value={answerBody}
              onChange={(e) => setAnswerBody(e.target.value)}
              placeholder="Write your answer here. Be detailed and include any relevant context..."
              rows={6}
              maxLength={10000}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#475569' }}>{answerBody.length}/10000</span>
              <button
                id="qd-post-answer-btn"
                type="submit"
                className="hf-btn-primary"
                disabled={submittingAnswer || answerBody.trim().length < 10}
              >
                {submittingAnswer ? (
                  <>
                    <span className="material-icons" style={{ animation: 'hf-spin 0.7s linear infinite', fontSize: '0.9rem' }}>refresh</span>
                    Posting...
                  </>
                ) : (
                  <>
                    <span className="material-icons" style={{ fontSize: '0.9rem' }}>send</span>
                    Post Answer
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ textAlign: 'left', padding: '1.5rem 0', color: '#64748b' }}>
            <p>
              <Link to="/login" style={{ color: '#7c3aed', fontWeight: 600 }}>Log in</Link>
              {' '}to post an answer
            </p>
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={deleteConfirmTarget != null}
        title={deleteConfirmTarget?.title || 'Confirm Delete'}
        message={deleteConfirmTarget?.message || 'Are you sure you want to delete this item?'}
        confirmText={deleteConfirmTarget?.title || 'Delete'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmTarget(null)}
      />
    </div>
  );
};

export default QuestionDetail;
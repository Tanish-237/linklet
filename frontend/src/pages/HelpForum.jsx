import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import useAuthStore from '../store/useAuthStore';
import defaultAvatar from '../assets/default-avatar.png';
import './HelpForum.css';
import {
  getQuestions,
  getQuestionMetadata,
  getTagCloud,
  getForumStats,
  createQuestion,
  voteQuestion as apiVoteQuestion,
  deleteQuestion as apiDeleteQuestion,
} from '../api/question.api';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Skeleton Card ─────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="hf-skeleton-card">
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 44 }}>
      <div className="hf-skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
      <div className="hf-skeleton" style={{ width: 32, height: 14, borderRadius: 4 }} />
      <div className="hf-skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
    </div>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div className="hf-skeleton" style={{ height: 20, width: '75%', borderRadius: 6 }} />
      <div className="hf-skeleton" style={{ height: 14, width: '100%', borderRadius: 4 }} />
      <div className="hf-skeleton" style={{ height: 14, width: '60%', borderRadius: 4 }} />
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
        <div className="hf-skeleton" style={{ height: 20, width: 60, borderRadius: 12 }} />
        <div className="hf-skeleton" style={{ height: 20, width: 70, borderRadius: 12 }} />
      </div>
    </div>
  </div>
);

// ─── Tag Input Component ───────────────────────────────────────────────────────

const TagInput = ({ tags, onChange, suggestions = [] }) => {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef(null);

  const addTag = (tag) => {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!clean || tags.includes(clean) || tags.length >= 10) return;
    onChange([...tags, clean]);
    setInputVal('');
  };

  const removeTag = (tag) => onChange(tags.filter((t) => t !== tag));

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputVal);
    } else if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const filteredSuggestions = suggestions
    .filter((s) => !tags.includes(s) && s.includes(inputVal.toLowerCase()))
    .slice(0, 12);

  return (
    <div>
      <div className="hf-tag-input-wrap" onClick={() => inputRef.current?.focus()}>
        {tags.map((t) => (
          <span key={t} className="hf-tag-input-chip">
            #{t}
            <button type="button" onClick={() => removeTag(t)}>×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="hf-tag-input-field"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length < 10 ? 'Type tag + Enter' : 'Max 10 tags'}
          disabled={tags.length >= 10}
        />
      </div>
      {filteredSuggestions.length > 0 && (
        <div className="hf-tag-suggestions">
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="hf-tag-suggestion"
              onClick={() => addTag(s)}
            >
              #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Ask Question Modal ────────────────────────────────────────────────────────

const AskQuestionModal = ({ onClose, onSuccess, categories, suggestedTags }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 10) {
      toast.error('Title must be at least 10 characters');
      return;
    }

    setSubmitting(true);
    try {
      await createQuestion({ title: title.trim(), body: body.trim(), category, tags });
      toast.success('Question posted successfully!');
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to post question');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hf-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="hf-modal" role="dialog" aria-modal="true" aria-labelledby="ask-modal-title">
        <div className="hf-modal-header">
          <h2 id="ask-modal-title" className="hf-modal-title">Ask a Question</h2>
          <button className="hf-modal-close" onClick={onClose} aria-label="Close">
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className="hf-modal-body">
          <form onSubmit={handleSubmit}>
            <div className="hf-form-group">
              <label className="hf-form-label" htmlFor="q-title">
                Title <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input
                id="q-title"
                className="hf-form-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's your question? Be specific and concise."
                maxLength={200}
              />
              <div className="hf-char-count">{title.length}/200</div>
            </div>

            <div className="hf-form-group">
              <label className="hf-form-label" htmlFor="q-category">Category</label>
              <select
                id="q-category"
                className="hf-form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="hf-form-group">
              <label className="hf-form-label" htmlFor="q-body">
                Description <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                id="q-body"
                className="hf-form-textarea"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Provide context or details (optional)..."
                rows={6}
                maxLength={5000}
              />
              <div className="hf-char-count">{body.length}/5000</div>
            </div>

            <div className="hf-form-group">
              <label className="hf-form-label">Tags (up to 10)</label>
              <TagInput tags={tags} onChange={setTags} suggestions={suggestedTags} />
            </div>

            <div className="hf-form-actions">
              <button type="button" className="hf-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="hf-btn-primary"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="material-icons" style={{ animation: 'hf-spin 0.7s linear infinite' }}>refresh</span>
                    Posting...
                  </>
                ) : (
                  <>
                    <span className="material-icons" style={{ fontSize: '1rem' }}>send</span>
                    Post Question
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
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

// ─── Question Card ─────────────────────────────────────────────────────────────

const QuestionCard = ({ question, currentUserId, userRole, onVote, onTagClick, onDelete }) => {
  const navigate = useNavigate();
  const netVotes = (question.upvotes?.length || 0) - (question.downvotes?.length || 0);
  const isOwner = currentUserId && (
    question.userId?._id?.toString() === currentUserId ||
    question.userId?.toString() === currentUserId
  );
  const canDelete = isOwner || userRole === 'admin';
  const userVote = question.upvotes?.some(
    (id) => (id._id || id)?.toString() === currentUserId
  )
    ? 'upvote'
    : question.downvotes?.some((id) => (id._id || id)?.toString() === currentUserId)
      ? 'downvote'
      : null;

  const hasAccepted =
    (Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length > 0) ||
    (Array.isArray(question.answers) && question.answers.some((a) => a && typeof a === 'object' && a.isAccepted === true));
  const answerCount = question.answers?.length || 0;

  return (
    <article
      className="hf-question-card"
      onClick={() => navigate(`/dashboard/question/${question._id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/dashboard/question/${question._id}`)}
    >
      {/* Body */}
      <div className="hf-card-body">
        <div className="hf-card-header">
          <h2 className="hf-card-title">{question.title}</h2>
          <div className="hf-badge-group">
            {hasAccepted && (
              <span className="hf-solved-badge">
                <span className="material-icons" style={{ fontSize: '0.85rem' }}>check_circle</span>
                Solved
              </span>
            )}
            <span className="hf-answer-pill">
              <span className="material-icons" style={{ fontSize: '0.85rem' }}>chat_bubble_outline</span>
              {answerCount} {answerCount === 1 ? 'answer' : 'answers'}
            </span>
          </div>
        </div>

        {question.body && <p className="hf-card-excerpt">{renderTextWithLinks(question.body)}</p>}

        {/* Tags & Category */}
        <div className="hf-tags-row" onClick={(e) => e.stopPropagation()}>
          <span className="hf-category-badge">{question.category}</span>
          {question.tags?.slice(0, 5).map((tag) => (
            <button
              key={tag}
              className="hf-tag"
              onClick={() => onTagClick(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="hf-card-footer">
          <div className="hf-author-row" onClick={(e) => e.stopPropagation()}>
            <Link
              to={`/dashboard/profile/${question.userId?.username}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', textDecoration: 'none' }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={question.userId?.avatar || defaultAvatar}
                alt={question.userId?.username || 'User'}
                className="hf-author-avatar"
              />
              <span className="hf-author-name">{question.userId?.username || 'Unknown'}</span>
            </Link>
            <span>·</span>
            <span>{timeAgo(question.createdAt)}</span>
          </div>

          <div className="hf-meta-pills">
            {canDelete && (
              <button
                className="bm-del-btn inline-del-btn"
                title="Delete Question"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(question._id);
                }}
              >
                <span className="material-icons">delete</span>
              </button>
            )}
            <span className="hf-meta-pill">
              <span className="material-icons" style={{ fontSize: '0.85rem' }}>visibility</span>
              {question.views || 0} views
            </span>
          </div>
        </div>
      </div>

      {/* Vote Column on Right */}
      <div className="hf-vote-col" onClick={(e) => e.stopPropagation()}>
        <button
          className={`hf-vote-btn ${userVote === 'upvote' ? 'voted-up' : ''}`}
          onClick={() => onVote(question._id, 'upvote')}
          aria-label="Upvote"
          title="Upvote"
        >
          <span className="material-icons" style={{ fontSize: '1rem' }}>arrow_upward</span>
        </button>
        <span className="hf-vote-count">{netVotes}</span>
        <button
          className={`hf-vote-btn ${userVote === 'downvote' ? 'voted-down' : ''}`}
          onClick={() => onVote(question._id, 'downvote')}
          aria-label="Downvote"
          title="Downvote"
        >
          <span className="material-icons" style={{ fontSize: '1rem' }}>arrow_downward</span>
        </button>
      </div>
    </article>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const FILTERS = [
  { id: 'all', label: 'Latest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'popular', label: 'Most Upvoted' },
  { id: 'views', label: 'Most Viewed' },
  { id: 'solved', label: 'Solved' },
  { id: 'unanswered', label: 'Unanswered' },
  { id: 'answered', label: 'Answered' },
  { id: 'mine', label: 'My Questions' },
];

const HelpForum = () => {
  const { user } = useAuthStore();

  // Data state
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // Filter / search state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  // Metadata
  const [categories, setCategories] = useState(['General']);
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [tagCloud, setTagCloud] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);

  // UI state
  const [showAskModal, setShowAskModal] = useState(false);
  const [deleteConfirmQuestionId, setDeleteConfirmQuestionId] = useState(null);

  const promptDeleteQuestion = (questionId) => {
    setDeleteConfirmQuestionId(questionId);
  };

  const handleConfirmDeleteQuestion = async () => {
    if (!deleteConfirmQuestionId) return;
    try {
      await apiDeleteQuestion(deleteConfirmQuestionId);
      setQuestions((prev) => prev.filter((q) => q._id !== deleteConfirmQuestionId));
      toast.success("Question deleted");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete question");
    } finally {
      setDeleteConfirmQuestionId(null);
    }
  };

  const searchDebounceRef = useRef(null);

  // ─── Load Metadata ───────────────────────────────────────────────────────────

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [meta, tags, stats] = await Promise.all([
          getQuestionMetadata(),
          getTagCloud(),
          getForumStats(),
        ]);
        setCategories(meta.categories || []);
        setSuggestedTags(meta.suggestedTags || []);
        setTagCloud(tags || []);
        setCategoryStats(stats || []);
      } catch (err) {
        console.error('[HelpForum] Failed to load metadata:', err);
      }
    };
    loadMeta();
  }, []);

  // ─── Debounce Search ─────────────────────────────────────────────────────────

  useEffect(() => {
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(searchDebounceRef.current);
  }, [search]);

  // ─── Fetch Questions ─────────────────────────────────────────────────────────

  const fetchQuestions = useCallback(
    async (cursor = null) => {
      if (cursor) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = {
          search: debouncedSearch,
          filter: filter === 'mine' ? 'all' : filter,
          category: selectedCategory,
          tag: selectedTag,
          limit: 15,
        };
        if (cursor) params.cursor = cursor;
        if (filter === 'mine' && user?._id) params.userId = user._id;

        const res = await getQuestions(params);
        const newQuestions = res.data || [];

        if (cursor) {
          setQuestions((prev) => [...prev, ...newQuestions]);
        } else {
          setQuestions(newQuestions);
        }
        setNextCursor(res.nextCursor || null);
        setHasMore(res.hasMore || false);
      } catch (err) {
        console.error('[HelpForum] Failed to load questions:', err);
        toast.error('Failed to load questions. Please try again.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedSearch, filter, selectedCategory, selectedTag, user?._id]
  );

  useEffect(() => {
    setNextCursor(null);
    fetchQuestions(null);
  }, [fetchQuestions]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleVote = async (questionId, voteType) => {
    if (!user) {
      toast.info('Please log in to vote');
      return;
    }

    const targetQ = questions.find((q) => q._id === questionId);
    const isQuestionOwner = targetQ?.userId?._id?.toString() === user._id ||
      targetQ?.userId?.toString() === user._id;

    if (isQuestionOwner) {
      toast.error("You cannot vote on your own question");
      return;
    }

    const prevQuestions = questions;

    // Optimistic update
    setQuestions((prev) =>
      prev.map((q) => {
        if (q._id !== questionId) return q;
        const userId = user._id;
        const alreadyUpvoted = q.upvotes?.some((id) => (id._id || id)?.toString() === userId);
        const alreadyDownvoted = q.downvotes?.some((id) => (id._id || id)?.toString() === userId);

        let upvotes = [...(q.upvotes || [])];
        let downvotes = [...(q.downvotes || [])];

        if (voteType === 'upvote') {
          if (alreadyUpvoted) {
            upvotes = upvotes.filter((id) => (id._id || id)?.toString() !== userId);
          } else {
            upvotes = [...upvotes, { _id: userId }];
            downvotes = downvotes.filter((id) => (id._id || id)?.toString() !== userId);
          }
        } else {
          if (alreadyDownvoted) {
            downvotes = downvotes.filter((id) => (id._id || id)?.toString() !== userId);
          } else {
            downvotes = [...downvotes, { _id: userId }];
            upvotes = upvotes.filter((id) => (id._id || id)?.toString() !== userId);
          }
        }
        return { ...q, upvotes, downvotes };
      })
    );

    try {
      await apiVoteQuestion(questionId, voteType);
    } catch (err) {
      setQuestions(prevQuestions); // Rollback cleanly without re-fetching feed
      const msg = err?.response?.data?.message;
      if (msg) toast.error(msg);
    }
  };

  const handleTagClick = (tag) => {
    setSelectedTag((prev) => (prev === tag ? '' : tag));
  };

  const handleCategoryClick = (cat) => {
    setSelectedCategory((prev) => (prev === cat ? '' : cat));
  };

  const handleAskSuccess = () => {
    setShowAskModal(false);
    // Refresh list
    setNextCursor(null);
    fetchQuestions(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="hf-root">
      <div className="hf-layout">

        {/* ── Sidebar ── */}
        <aside className="hf-sidebar">
          {/* Categories */}
          <div className="hf-sidebar-card">
            <h3>Categories</h3>
            <div>
              <div
                className={`hf-stat-row ${selectedCategory === '' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('')}
              >
                <span>All Categories</span>
              </div>
              {categories.map((cat) => {
                const stat = categoryStats.find((s) => s._id === cat);
                return (
                  <div
                    key={cat}
                    className={`hf-stat-row ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => handleCategoryClick(cat)}
                  >
                    <span>{cat}</span>
                    {stat && (
                      <span className="hf-stat-badge">{stat.count}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tag Cloud */}
          {tagCloud.length > 0 && (
            <div className="hf-sidebar-card">
              <h3>Popular Tags</h3>
              <div className="hf-tag-cloud">
                {tagCloud.slice(0, 30).map((tag) => (
                  <button
                    key={tag}
                    className={`hf-tag-chip ${selectedTag === tag ? 'active' : ''}`}
                    onClick={() => handleTagClick(tag)}
                    style={{ background: 'none', border: '1px solid rgba(139,92,246,0.25)', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── Main ── */}
        <main className="hf-main">
          {/* Header */}
          <div className="hf-header">
            <div>
              <h1 className="hf-header-title">Help Forum</h1>
              <p className="hf-header-sub">
                Ask questions, get answers from the Linklet community
              </p>
            </div>
            {user && (
              <button
                id="ask-question-btn"
                className="hf-ask-btn"
                onClick={() => setShowAskModal(true)}
              >
                <span className="material-icons" style={{ fontSize: '1rem' }}>add</span>
                Ask Question
              </button>
            )}
          </div>

          {/* Search */}
          <div className="hf-search-wrap">
            <span className="material-icons hf-search-icon">search</span>
            <input
              id="hf-search-input"
              type="text"
              className="hf-search-input"
              placeholder="Search questions, tags, or topics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search questions"
            />
          </div>

          {/* Active filters banner */}
          {(selectedTag || selectedCategory) && (
            <div className="hf-active-filter-banner">
              <span className="material-icons" style={{ fontSize: '1rem' }}>filter_alt</span>
              Filtering by:
              {selectedCategory && <strong>{selectedCategory}</strong>}
              {selectedTag && <strong>#{selectedTag}</strong>}
              <button
                className="hf-active-filter-clear"
                onClick={() => { setSelectedTag(''); setSelectedCategory(''); }}
              >
                Clear ×
              </button>
            </div>
          )}

          {/* Filter Pills */}
          <div className="hf-filter-bar">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                id={`hf-filter-${f.id}`}
                className={`hf-filter-btn ${filter === f.id ? 'active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Questions List */}
          <div className="hf-question-list">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            ) : questions.length === 0 ? (
              <div className="hf-empty">
                <div className="hf-empty-icon">
                  <span className="material-icons" style={{ fontSize: '4rem' }}>help_outline</span>
                </div>
                <h3>No questions found</h3>
                <p>
                  {debouncedSearch
                    ? 'Try adjusting your search terms or filters.'
                    : 'Be the first to ask a question!'}
                </p>
              </div>
            ) : (
              questions.map((q, i) => (
                <QuestionCard
                  key={q._id}
                  question={q}
                  onVote={handleVote}
                  onTagClick={handleTagClick}
                  onDelete={promptDeleteQuestion}
                  currentUserId={user?._id}
                  userRole={user?.role}
                  style={{ animationDelay: `${i * 0.04}s` }}
                />
              ))
            )}
          </div>

          {/* Load More */}
          {hasMore && !loading && (
            <div className="hf-load-more">
              <button
                id="hf-load-more-btn"
                className="hf-load-more-btn"
                onClick={() => fetchQuestions(nextCursor)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <><span className="material-icons" style={{ animation: 'hf-spin 0.7s linear infinite', fontSize: '0.9rem', verticalAlign: 'middle', marginRight: 4 }}>refresh</span>Loading...</>
                ) : (
                  'Load More Questions'
                )}
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Ask Question Modal */}
      {showAskModal && (
        <AskQuestionModal
          onClose={() => setShowAskModal(false)}
          onSuccess={handleAskSuccess}
          categories={categories}
          suggestedTags={suggestedTags}
        />
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={deleteConfirmQuestionId != null}
        title="Delete Question"
        message="Are you sure you want to delete this question and all its answers? This action cannot be undone."
        confirmText="Delete Question"
        onConfirm={handleConfirmDeleteQuestion}
        onCancel={() => setDeleteConfirmQuestionId(null)}
      />
    </div>
  );
};

export default HelpForum;
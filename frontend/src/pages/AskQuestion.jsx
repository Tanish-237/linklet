/**
 * AskQuestion — standalone page (for /ask-question route).
 * The modal version is embedded directly inside HelpForum.jsx.
 * This page is used for the public /ask-question route in App.jsx.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import useAuthStore from '../store/useAuthStore';
import { createQuestion, getQuestionMetadata } from '../api/question.api';
import './HelpForum.css';

const AskQuestion = ({ onCancel, onSuccess }) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('General');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [categories, setCategories] = useState(['General']);
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getQuestionMetadata()
      .then((meta) => {
        setCategories(meta.categories || []);
        setSuggestedTags(meta.suggestedTags || []);
      })
      .catch((err) => console.error('[AskQuestion] Failed to load metadata:', err));
  }, []);

  const addTag = (tag) => {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!clean || tags.includes(clean) || tags.length >= 10) return;
    setTags((prev) => [...prev, clean]);
    setTagInput('');
  };

  const removeTag = (tag) => setTags((prev) => prev.filter((t) => t !== tag));

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error('Please log in to ask a question');
      navigate('/login');
      return;
    }

    if (!title.trim() || title.trim().length < 10) {
      toast.error('Title must be at least 10 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const question = await createQuestion({
        title: title.trim(),
        body: body.trim(),
        category,
        tags,
      });

      toast.success('Question posted successfully!');

      if (onSuccess) {
        onSuccess(question);
      } else {
        navigate(`/dashboard/question/${question._id}`);
      }
    } catch (err) {
      console.error('[AskQuestion] Failed to submit:', err);
      toast.error(err?.response?.data?.message || 'Failed to post question');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Title */}
      <div className="hf-form-group">
        <label className="hf-form-label" htmlFor="aq-title">
          Title <span style={{ color: '#f87171' }}>*</span>
        </label>
        <input
          id="aq-title"
          className="hf-form-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's your question? Be specific and concise."
          maxLength={200}
          required
        />
        <div className="hf-char-count">{title.length}/200</div>
      </div>

      {/* Category */}
      <div className="hf-form-group">
        <label className="hf-form-label" htmlFor="aq-category">Category</label>
        <select
          id="aq-category"
          className="hf-form-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Body */}
      <div className="hf-form-group">
        <label className="hf-form-label" htmlFor="aq-body">
          Description <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          id="aq-body"
          className="hf-form-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Provide context or details (optional)..."
          rows={6}
          maxLength={5000}
        />
        <div className="hf-char-count">{body.length}/5000</div>
      </div>

      {/* Tags */}
      <div className="hf-form-group">
        <label className="hf-form-label">Tags (up to 10)</label>
        <div className="hf-tag-input-wrap">
          {tags.map((t) => (
            <span key={t} className="hf-tag-input-chip">
              #{t}
              <button type="button" onClick={() => removeTag(t)}>×</button>
            </span>
          ))}
          <input
            className="hf-tag-input-field"
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder={tags.length < 10 ? 'Type a tag + Enter' : 'Max 10 tags'}
            disabled={tags.length >= 10}
          />
        </div>
        {/* Suggestions */}
        {suggestedTags.length > 0 && (
          <div className="hf-tag-suggestions" style={{ marginTop: '0.5rem' }}>
            {suggestedTags
              .filter((s) => !tags.includes(s) && s.includes(tagInput.toLowerCase()))
              .slice(0, 12)
              .map((s) => (
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

      {/* Actions */}
      <div className="hf-form-actions">
        {onCancel && (
          <button
            type="button"
            className="hf-btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          id="aq-submit-btn"
          className="hf-btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="material-icons" style={{ animation: 'hf-spin 0.7s linear infinite', fontSize: '0.9rem' }}>refresh</span>
              Posting...
            </>
          ) : (
            'Post Question'
          )}
        </button>
      </div>
    </form>
  );
};

export default AskQuestion;
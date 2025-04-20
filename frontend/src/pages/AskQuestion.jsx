import React, { useState } from "react";
import { toast } from "react-toastify";
import { handleApiError } from "../utlis/ErrorHandler";

const AskQuestion = ({ onCancel, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim() || !body.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // For demo, we're just simulating the API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Question posted successfully!');
      setTitle('');
      setBody('');
      setTags('');
      onSuccess?.();
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-gray-300 mb-2" htmlFor="title">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's your question? Be specific."
          className="w-full px-4 py-3 bg-gray-800/50 border border-violet-500/30 rounded-lg focus:outline-none focus:border-violet-500 text-white placeholder-gray-500"
          required
        />
      </div>

      <div>
        <label className="block text-gray-300 mb-2" htmlFor="body">
          Body <span className="text-red-500">*</span>
        </label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Provide details about your question..."
          rows="6"
          className="w-full px-4 py-3 bg-gray-800/50 border border-violet-500/30 rounded-lg focus:outline-none focus:border-violet-500 text-white placeholder-gray-500 resize-none"
          required
        />
      </div>

      <div>
        <label className="block text-gray-300 mb-2" htmlFor="tags">
          Tags
        </label>
        <input
          id="tags"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Add tags (comma separated, e.g., react, javascript, nodejs)"
          className="w-full px-4 py-3 bg-gray-800/50 border border-violet-500/30 rounded-lg focus:outline-none focus:border-violet-500 text-white placeholder-gray-500"
        />
      </div>

      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 text-gray-400 hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="animate-spin">⟳</span>
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
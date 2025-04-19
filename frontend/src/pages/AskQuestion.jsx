import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { handleApiError } from '../utlis/ErrorHandler';

const AskQuestion = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Redirect if not logged in
  React.useEffect(() => {
    if (!user) {
      toast.error('You must be logged in to ask a question');
      navigate('/login');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    
    if (!body.trim()) {
      toast.error('Question details are required');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await axios.post(
        'http://localhost:5000/api/questions',
        { title, body, tags },
        { withCredentials: true }
      );
      
      if (response.data.success) {
        toast.success('Question posted successfully!');
        // navigate(`/question/${response.data.question._id}`);
        navigate(`/help-forum`);
      } else {
        toast.error('Failed to post question');
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 text-gray-200">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-violet-400 mb-8">Ask a Question</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Be specific and imagine you're asking a question to another person
            </p>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. How to implement authentication in React?"
              className="w-full bg-gray-700 border border-gray-600 text-gray-200 text-sm rounded-lg focus:ring-violet-500 focus:border-violet-500 p-2.5 placeholder-gray-400"
              required
            />
          </div>
          
          <div>
            <label htmlFor="body" className="block text-sm font-medium text-gray-300 mb-1">
              Body <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Include all the information someone would need to answer your question
            </p>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows="10"
              placeholder="Explain your question in detail..."
              className="w-full bg-gray-700 border border-gray-600 text-gray-200 text-sm rounded-lg focus:ring-violet-500 focus:border-violet-500 p-2.5 placeholder-gray-400"
              required
            />
          </div>
          
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-300 mb-1">
              Tags
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Add up to 5 tags to describe what your question is about (comma separated)
            </p>
            <input
              type="text"
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. react, javascript, authentication"
              className="w-full bg-gray-700 border border-gray-600 text-gray-200 text-sm rounded-lg focus:ring-violet-500 focus:border-violet-500 p-2.5 placeholder-gray-400"
            />
          </div>
          
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/help-forum')}
              className="py-2.5 px-5 text-sm font-medium text-gray-300 focus:outline-none bg-gray-700 rounded-lg border border-gray-600 hover:bg-gray-600 focus:z-10 focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2.5 px-5 text-sm font-medium text-white focus:outline-none bg-violet-600 rounded-lg border border-violet-700 hover:bg-violet-700 focus:ring-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </span>
              ) : 'Post Your Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AskQuestion;
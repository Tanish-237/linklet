import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import defaultAvatar from '../assets/default-avatar.png';
import { API_BASE_URL } from '../config';

const QuestionDetail = ({ basePath = '' }) => {
  const { questionId } = useParams();
  const { user } = useAuth();
  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [newAnswer, setNewAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  useEffect(() => {
    fetchQuestionDetails();
  }, [questionId]);

  const fetchQuestionDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/questions/${questionId}`);
      const data = await response.json();
      if (data.success) {
        setQuestion(data.question);
        setAnswers(data.question.answers || []);
      }
    } catch (error) {
      console.error('Error fetching question:', error);
      toast.error('Failed to load question');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in to answer');
      return;
    }
    if (!newAnswer.trim()) {
      toast.error('Answer cannot be empty');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/questions/${questionId}/answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: newAnswer }),
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setAnswers(prev => [...prev, data.answer]);
        setNewAnswer('');
        toast.success('Answer posted successfully');
      }
    } catch (error) {
      console.error('Error posting answer:', error);
      toast.error('Failed to post answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (type) => {
    if (!user) {
      toast.error('Please log in to vote');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/questions/${questionId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ voteType: type }),
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setQuestion(prev => ({
          ...prev,
          upvotes: Array(data.upvotes).fill(null),
          downvotes: Array(data.downvotes).fill(null)
        }));
      }
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Failed to vote');
    }
  };

  const handleSubmitComment = async () => {
    if (!user) {
      toast.error('Please log in to comment');
      return;
    }
    if (!newComment.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }
    if (!selectedAnswer) return;

    setIsSubmittingComment(true);
    try {
      // Here we'd make the API call to add a comment to the answer
      // Update once the backend endpoint is ready
      setNewComment('');
      toast.success('Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20 text-gray-400">
            <span className="material-icons text-6xl mb-4">help_off</span>
            <p className="text-xl">Question not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white px-4 py-6">
      <div className="max-w-6xl mx-auto">
        <div className={`grid transition-[grid-template-columns] duration-300 ease-in-out ${selectedAnswer ? 'grid-cols-[1fr_400px] gap-6' : 'grid-cols-1'}`}>
          {/* Left Column - Main Content */}
          <div className="space-y-6">
            {/* Back Button */}
            <Link 
              to={`${basePath}/help`}
              className="inline-flex items-center text-violet-400 hover:text-violet-300 transition-colors mb-4"
            >
              <span className="material-icons mr-2">arrow_back</span>
              Back to Questions
            </Link>

            {/* Question Card */}
            <div className="bg-gray-800/30 backdrop-blur border border-violet-500/20 rounded-lg p-6">
              <div className="flex items-start gap-6">
                {/* Voting Controls */}
                <div className="flex flex-col items-center gap-2">
                  <button 
                    onClick={() => handleVote('upvote')}
                    className="p-2 hover:bg-violet-500/20 text-gray-400 hover:text-violet-400 transition-colors rounded"
                  >
                    <span className="material-icons">arrow_upward</span>
                  </button>
                  <span className="text-violet-400 font-medium text-lg">
                    {question.upvotes.length - question.downvotes.length}
                  </span>
                  <button 
                    onClick={() => handleVote('downvote')}
                    className="p-2 hover:bg-violet-500/20 text-gray-400 hover:text-violet-400 transition-colors rounded"
                  >
                    <span className="material-icons">arrow_downward</span>
                  </button>
                </div>

                {/* Question Content */}
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-violet-300 mb-4">{question.title}</h1>
                  <p className="text-gray-300 mb-6 leading-relaxed">{question.body}</p>
                  
                  {/* Tags */}
                  {question.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {question.tags.map(tag => (
                        <span 
                          key={tag}
                          className="px-3 py-1 bg-violet-900/30 text-violet-400 rounded-full text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Question Author */}
                  <div className="flex items-center gap-3">
                    <img
                      src={question.userId.avatar || defaultAvatar}
                      alt={question.userId.username}
                      className="w-8 h-8 rounded-full border border-violet-500/30"
                    />
                    <div>
                      <div className="text-violet-400">{question.userId.username}</div>
                      <div className="text-sm text-gray-400">
                        asked {new Date(question.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Answer Count & Add Answer Button */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-violet-400">
                {answers.length} {answers.length === 1 ? 'Answer' : 'Answers'}
              </h2>
              <button
                onClick={() => document.getElementById('answer-form').scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <span className="material-icons">add</span>
                Answer
              </button>
            </div>

            {/* Answers List */}
            <div className="space-y-4">
              {answers.map(answer => (
                <div 
                  key={answer._id}
                  className={`bg-gray-800/30 backdrop-blur border border-violet-500/20 rounded-lg p-6 cursor-pointer transition-all hover:border-violet-500/40 ${
                    selectedAnswer?._id === answer._id ? 'border-violet-500 bg-violet-900/20' : ''
                  }`}
                  onClick={() => setSelectedAnswer(answer)}
                >
                  <div className="flex items-start gap-6">
                    {/* Answer Voting */}
                    <div className="flex flex-col items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle answer vote
                        }}
                        className="p-2 hover:bg-violet-500/20 text-gray-400 hover:text-violet-400 transition-colors rounded"
                      >
                        <span className="material-icons">arrow_upward</span>
                      </button>
                      <span className="text-violet-400 font-medium">
                        {(answer.upvotes?.length || 0) - (answer.downvotes?.length || 0)}
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle answer vote
                        }}
                        className="p-2 hover:bg-violet-500/20 text-gray-400 hover:text-violet-400 transition-colors rounded"
                      >
                        <span className="material-icons">arrow_downward</span>
                      </button>
                    </div>

                    {/* Answer Content */}
                    <div className="flex-1">
                      <p className="text-gray-300 mb-4 leading-relaxed">{answer.body}</p>
                      <div className="flex items-center gap-3">
                        <img
                          src={answer.userId.avatar || defaultAvatar}
                          alt={answer.userId.username}
                          className="w-6 h-6 rounded-full border border-violet-500/30"
                        />
                        <div className="text-sm">
                          <span className="text-violet-400">{answer.userId.username}</span>
                          <span className="text-gray-400 ml-2">
                            answered {new Date(answer.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Answer Form */}
            <div id="answer-form" className="bg-gray-800/30 backdrop-blur border border-violet-500/20 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-green-400 mb-4">Your Answer</h2>
              <form onSubmit={handleSubmitAnswer}>
                <textarea
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder={user ? "Write your answer here..." : "Please log in to answer"}
                  className="w-full h-40 bg-black/30 text-white rounded-lg border border-violet-500/30 p-4 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all resize-none placeholder-gray-500"
                  disabled={!user}
                />
                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !user}
                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="material-icons animate-spin">refresh</span>
                        Posting...
                      </>
                    ) : (
                      <>
                        <span className="material-icons">send</span>
                        Post Answer
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column - Answer Details Sidebar */}
          {selectedAnswer && (
            <div className="bg-gray-800/30 backdrop-blur border border-violet-500/20 rounded-lg p-6 h-[calc(100vh-2rem)] sticky top-4 overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-lg font-semibold text-violet-400">Answer Details</h3>
                <button 
                  onClick={() => setSelectedAnswer(null)}
                  className="text-gray-400 hover:text-violet-400 transition-colors"
                >
                  <span className="material-icons">close</span>
                </button>
              </div>
              
              <div className="space-y-6">
                {/* Selected Answer Content */}
                <div>
                  <p className="text-gray-300 leading-relaxed">{selectedAnswer.body}</p>
                  <div className="flex items-center gap-3 mt-4">
                    <img
                      src={selectedAnswer.userId.avatar || defaultAvatar}
                      alt={selectedAnswer.userId.username}
                      className="w-6 h-6 rounded-full border border-violet-500/30"
                    />
                    <div className="text-sm">
                      <span className="text-violet-400">{selectedAnswer.userId.username}</span>
                      <div className="text-gray-400">
                        answered {new Date(selectedAnswer.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comments Section */}
                <div>
                  <h4 className="text-violet-400 mb-4">Comments</h4>
                  <div className="space-y-4">
                    {/* Comment Input */}
                    <div className="space-y-4">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={user ? "Add a comment..." : "Please log in to comment"}
                        className="w-full h-20 bg-black/30 text-white rounded-lg border border-violet-500/30 p-3 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all resize-none placeholder-gray-500 text-sm"
                        disabled={!user}
                      />
                      <button
                        onClick={handleSubmitComment}
                        disabled={isSubmittingComment || !user}
                        className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                      >
                        {isSubmittingComment ? (
                          <>
                            <span className="material-icons animate-spin text-sm">refresh</span>
                            Posting...
                          </>
                        ) : (
                          <>
                            <span className="material-icons text-sm">comment</span>
                            Add Comment
                          </>
                        )}
                      </button>
                    </div>

                    {/* Comments List */}
                    <div className="space-y-4 mt-6">
                      {selectedAnswer.comments?.length > 0 ? (
                        selectedAnswer.comments.map(comment => (
                          <div key={comment._id} className="bg-black/30 rounded-lg p-3 border border-violet-500/20">
                            <p className="text-gray-300 text-sm mb-2">{comment.text}</p>
                            <div className="flex items-center gap-2 text-xs">
                              <img
                                src={comment.userId.avatar || defaultAvatar}
                                alt={comment.userId.username}
                                className="w-4 h-4 rounded-full border border-violet-500/30"
                              />
                              <span className="text-violet-400">{comment.userId.username}</span>
                              <span className="text-gray-400">
                                • {new Date(comment.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-400 text-sm text-center">No comments yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionDetail;
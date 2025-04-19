import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import defaultAvatar from '../assets/default-avatar.png';
import AskQuestion from './AskQuestion';

// Style constants - updated for dashboard integration
const Container = "w-full";
const Title = "text-2xl font-semibold text-violet-300 flex items-center gap-3 mb-2";
const SearchInput = "w-full p-3 pl-10 bg-gray-800/50 border border-violet-500/30 rounded-lg text-white placeholder-gray-400 focus:border-violet-500 transition-colors";
const FilterContainer = "flex items-center gap-4 mb-6 flex-wrap";
const FilterButton = "px-4 py-2 rounded-lg bg-gray-800/50 border border-violet-500/30 text-gray-300 hover:border-violet-500 hover:text-violet-400 transition-all";
const QuestionCard = "bg-gray-800/30 backdrop-blur border border-violet-500/20 rounded-lg p-6 hover:border-violet-500/40 transition-all group";
const QuestionTitle = "text-xl font-semibold text-violet-300 hover:text-violet-200 transition-colors mb-2";
const QuestionBody = "text-gray-300 mb-3 line-clamp-2";
const UserInfo = "flex flex-col text-sm text-gray-400";
const AnswerCard = "bg-gray-800/30 backdrop-blur border border-violet-500/20 rounded-lg p-6 hover:border-violet-500/40 transition-all mb-6";
const AnswerBody = "text-gray-300 mb-3";
const VoteButton = "p-1.5 hover:bg-violet-500/20 text-gray-400 hover:text-violet-400 transition-colors rounded group-hover:bg-violet-500/10";
const VoteCount = "text-violet-400 font-medium text-sm";
const CommentSection = "mt-4 pl-4 border-l-2 border-violet-500/30";
const CommentCard = "bg-gray-800/50 rounded-lg p-3 mb-3";

const DUMMY_QUESTIONS = [
  {
    _id: '1',
    title: 'How to implement authentication in React?',
    body: 'I\'m building a React application and need to implement user authentication. What\'s the best approach using JWT tokens and how should I handle protected routes?',
    tags: ['react', 'authentication', 'jwt'],
    userId: {
      username: 'reactdev',
      avatar: null
    },
    createdAt: '2025-04-19T10:00:00.000Z',
    views: 45,
    answers: [
      {
        _id: 'a1',
        body: 'I recommend using JWT tokens with localStorage. Here\'s how...',
        userId: {
          username: 'auth_expert',
          avatar: null
        },
        createdAt: '2025-04-19T11:00:00.000Z',
        upvotes: ['user1', 'user2'],
        downvotes: [],
        comments: [
          {
            _id: 'c1',
            body: 'Great explanation! Could you elaborate on refresh tokens?',
            userId: {
              username: 'learner',
              avatar: null
            },
            createdAt: '2025-04-19T12:00:00.000Z'
          }
        ]
      }
    ],
    upvotes: ['user1', 'user2', 'user3'],
    downvotes: ['user4']
  },
  {
    _id: '2',
    title: 'Best practices for state management in large React applications',
    body: 'As my React application grows, I\'m finding it harder to manage state effectively. Should I use Redux, Context API, or other alternatives? What are the pros and cons?',
    tags: ['react', 'redux', 'state-management'],
    userId: {
      username: 'frontend_guru',
      avatar: null
    },
    createdAt: '2025-04-18T15:30:00.000Z',
    views: 122,
    answers: ['answer1', 'answer2'],
    upvotes: ['user1', 'user2', 'user3', 'user4', 'user5'],
    downvotes: ['user6']
  },
  {
    _id: '3',
    title: 'Optimizing React performance with useMemo and useCallback',
    body: 'I\'ve noticed my React application is getting slower as it grows. When should I use useMemo and useCallback hooks? Are there any performance pitfalls to watch out for?',
    tags: ['react', 'performance', 'hooks'],
    userId: {
      username: 'performance_ninja',
      avatar: null
    },
    createdAt: '2025-04-20T09:15:00.000Z',
    views: 67,
    answers: ['answer1'],
    upvotes: ['user1', 'user2'],
    downvotes: []
  }
];

const HelpForum = ({ basePath = '' }) => {
  const [questions, setQuestions] = useState(DUMMY_QUESTIONS);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFilter, setCurrentFilter] = useState('all');
  const [showAskForm, setShowAskForm] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentName, setAttachmentName] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expandedAnswers, setExpandedAnswers] = useState(new Set());

  const handleAskQuestion = () => {
    setShowAskForm(true);
  };

  const handleCancelAsk = () => {
    setShowAskForm(false);
  };

  const handleQuestionSubmitSuccess = () => {
    setShowAskForm(false);
    toast.success('Question posted successfully!');
  };

  const handleVote = async (questionId, voteType) => {
    if (!user) {
      toast.info('Please log in to vote');
      return;
    }

    // Simulating vote update for dummy data
    setQuestions(prev => prev.map(q => {
      if (q._id === questionId) {
        if (voteType === 'upvote') {
          return {
            ...q,
            upvotes: [...q.upvotes, user.id],
            downvotes: q.downvotes.filter(id => id !== user.id)
          };
        } else {
          return {
            ...q,
            downvotes: [...q.downvotes, user.id],
            upvotes: q.upvotes.filter(id => id !== user.id)
          };
        }
      }
      return q;
    }));
    
    toast.success(voteType === 'upvote' ? 'Upvoted!' : 'Downvoted!');
  };

  const handleQuestionClick = (question) => {
    setSelectedQuestion(question);
  };

  const handleAttachmentChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAttachment(file);
      setAttachmentName(file.name);
    }
  };

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!answerText.trim()) return;

    try {
      const formData = new FormData();
      formData.append('body', answerText);
      if (attachment) {
        formData.append('attachment', attachment);
      }

      const response = await fetch(`/api/questions/${selectedQuestion._id}/answers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }

      const data = await response.json();
      // Add new answer to the list
      setQuestions(prev => prev.map(q => q._id === selectedQuestion._id ? { ...q, answers: [data.answer, ...q.answers] } : q));
      // Clear form
      setAnswerText('');
      setAttachment(null);
      setAttachmentName('');
    } catch (error) {
      console.error('Error submitting answer:', error);
      // Show error notification to user
    }
  };

  const handleAnswerVote = async (answerId, voteType) => {
    if (!user) {
      toast.info('Please log in to vote');
      return;
    }

    try {
      const response = await fetch(`/api/answers/${answerId}/${voteType}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to vote');
      }

      setQuestions(prev => prev.map(q => ({
        ...q,
        answers: q.answers?.map(a => {
          if (a._id === answerId) {
            const updatedAnswer = { ...a };
            if (voteType === 'upvote') {
              if (!updatedAnswer.upvotes.includes(user.id)) {
                updatedAnswer.upvotes = [...updatedAnswer.upvotes, user.id];
                updatedAnswer.downvotes = updatedAnswer.downvotes.filter(id => id !== user.id);
              }
            } else {
              if (!updatedAnswer.downvotes.includes(user.id)) {
                updatedAnswer.downvotes = [...updatedAnswer.downvotes, user.id];
                updatedAnswer.upvotes = updatedAnswer.upvotes.filter(id => id !== user.id);
              }
            }
            return updatedAnswer;
          }
          return a;
        })
      })));

      toast.success(voteType === 'upvote' ? 'Upvoted!' : 'Downvoted!');
    } catch (error) {
      toast.error('Failed to vote. Please try again.');
    }
  };

  const toggleAnswer = (answerId) => {
    setExpandedAnswers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(answerId)) {
        newSet.delete(answerId);
      } else {
        newSet.add(answerId);
      }
      return newSet;
    });
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         q.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         q.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    switch (currentFilter) {
      case 'unanswered':
        return q.answers?.length === 0 && matchesSearch;
      case 'answered':
        return (q.answers?.length || 0) > 0 && matchesSearch;
      case 'popular':
        return (q.views || 0) > 20 && matchesSearch;
      default:
        return matchesSearch;
    }
  });

  return (
    <div className={Container}>
      <div className="flex">
        {/* Left panel - Questions list */}
        <div className={`flex-1 ${selectedQuestion ? 'max-w-2xl border-r border-gray-800' : ''}`}>
          <div className="max-w-6xl mx-auto pr-6">
            {showAskForm ? (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-6">
                  <h1 className={Title}>
                    <span className="material-icons text-violet-400">help_outline</span>
                    Ask a Question
                  </h1>
                  <button
                    onClick={handleCancelAsk}
                    className="p-2 hover:bg-violet-500/20 text-gray-400 hover:text-violet-400 transition-colors rounded"
                  >
                    <span className="material-icons">close</span>
                  </button>
                </div>
                <AskQuestion onCancel={handleCancelAsk} onSuccess={handleQuestionSubmitSuccess} />
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                  <div>
                    <h1 className={Title}>Help Forum</h1>
                    <p className="text-gray-400">Get help from the community and share your knowledge</p>
                  </div>
                  <button
                    onClick={handleAskQuestion}
                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shadow-lg"
                  >
                    <span className="material-icons">add</span>
                    Ask Question
                  </button>
                </div>

                <div className="relative mb-6">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-icons">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search questions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={SearchInput}
                  />
                </div>

                <div className={FilterContainer}>
                  <button 
                    className={`${FilterButton} ${currentFilter === 'all' ? 'border-violet-500 text-violet-400' : ''}`}
                    onClick={() => setCurrentFilter('all')}
                  >
                    All Questions
                  </button>
                  <button 
                    className={`${FilterButton} ${currentFilter === 'unanswered' ? 'border-violet-500 text-violet-400' : ''}`}
                    onClick={() => setCurrentFilter('unanswered')}
                  >
                    Unanswered
                  </button>
                  <button 
                    className={`${FilterButton} ${currentFilter === 'answered' ? 'border-violet-500 text-violet-400' : ''}`}
                    onClick={() => setCurrentFilter('answered')}
                  >
                    Answered
                  </button>
                  <button 
                    className={`${FilterButton} ${currentFilter === 'popular' ? 'border-violet-500 text-violet-400' : ''}`}
                    onClick={() => setCurrentFilter('popular')}
                  >
                    Popular
                  </button>
                </div>
              </>
            )}

            {/* Questions list */}
            <div className="space-y-6">
              {loading ? (
                <div className="text-center py-20">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500"></div>
                </div>
              ) : filteredQuestions.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <span className="material-icons text-6xl mb-4">search_off</span>
                  <p className="text-xl">No questions found</p>
                  <p className="mt-2">Try adjusting your search or filters</p>
                </div>
              ) : (
                filteredQuestions.map(question => (
                  <div 
                    key={question._id} 
                    className={`${QuestionCard} cursor-pointer ${selectedQuestion?._id === question._id ? 'border-green-500' : ''}`}
                    onClick={() => handleQuestionClick(question)}
                  >
                    <div className="flex items-start gap-6">
                      {/* Vote buttons */}
                      <div className="flex flex-col items-center gap-1">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVote(question._id, 'upvote');
                          }}
                          className="p-1 hover:bg-violet-500/20 text-gray-400 hover:text-violet-400 transition-colors rounded"
                        >
                          <span className="material-icons text-xl">arrow_upward</span>
                        </button>
                        <span className="text-violet-400 font-medium">
                          {(question.upvotes?.length || 0) - (question.downvotes?.length || 0)}
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVote(question._id, 'downvote');
                          }}
                          className="p-1 hover:bg-violet-500/20 text-gray-400 hover:text-violet-400 transition-colors rounded"
                        >
                          <span className="material-icons text-xl">arrow_downward</span>
                        </button>
                      </div>

                      {/* Question content */}
                      <div className="flex-1">
                        <h2 className={QuestionTitle}>{question.title}</h2>
                        <p className={QuestionBody}>{question.body}</p>
                        
                        <div className="flex items-center justify-between">
                          <div className={UserInfo}>
                            <div className="flex items-center gap-2">
                              <img
                                src={question.userId.avatar || defaultAvatar}
                                alt={question.userId.username}
                                className="w-6 h-6 rounded-full border border-violet-500/30"
                              />
                              <span className="text-violet-400">{question.userId.username}</span>
                            </div>
                            <span className="text-sm text-gray-500 mt-1">
                              {new Date(question.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Answer section */}
                          <div className="flex flex-col items-end">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedQuestion(question);
                              }}
                              className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center gap-1"
                            >
                              <span className="material-icons text-sm">add</span>
                              Answer
                            </button>
                            <div className="mt-2 text-sm text-gray-400">
                              {question.answers?.length || 0} Answers
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right panel - Answers */}
        {selectedQuestion && (
          <div className="w-full max-w-xl pl-6">
            <div className="sticky top-0 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-violet-300">
                  <span className="material-icons mr-2">question_answer</span>
                  Answers ({selectedQuestion.answers?.length || 0})
                </h2>
                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="p-2 hover:bg-violet-500/20 text-gray-400 hover:text-violet-400 transition-colors rounded"
                >
                  <span className="material-icons">close</span>
                </button>
              </div>

              {/* Answer form */}
              <div className="mb-6">
                <form onSubmit={handleSubmitAnswer} className="space-y-4">
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Write your answer..."
                    rows="4"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-violet-500/30 rounded-lg focus:outline-none focus:border-violet-500 text-white placeholder-gray-500 resize-none"
                  />
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-violet-500/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors">
                      <span className="material-icons text-violet-400">attach_file</span>
                      <span className="text-gray-300">Add Attachment</span>
                      <input
                        type="file"
                        onChange={handleAttachmentChange}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                      />
                    </label>
                    {attachmentName && (
                      <div className="flex items-center gap-2 text-gray-300">
                        <span className="material-icons text-violet-400">description</span>
                        <span>{attachmentName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachment(null);
                            setAttachmentName('');
                          }}
                          className="p-1 hover:bg-violet-500/20 text-gray-400 hover:text-violet-400 rounded"
                        >
                          <span className="material-icons text-sm">close</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button 
                      type="submit"
                      disabled={!answerText.trim()}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      Post Answer
                    </button>
                  </div>
                </form>
              </div>

              {/* Answers list */}
              <div className="space-y-4">
                {selectedQuestion.answers?.length > 0 ? (
                  selectedQuestion.answers.map(answer => (
                    <div key={answer._id} className={AnswerCard}>
                      <div className="flex items-start gap-4">
                        {/* Vote buttons */}
                        <div className="flex flex-col items-center gap-1">
                          <button 
                            onClick={() => handleAnswerVote(answer._id, 'upvote')}
                            className={`${VoteButton} ${answer.upvotes?.includes(user?.id) ? 'text-violet-400' : ''}`}
                          >
                            <span className="material-icons text-xl">arrow_upward</span>
                          </button>
                          <span className={VoteCount}>
                            {(answer.upvotes?.length || 0) - (answer.downvotes?.length || 0)}
                          </span>
                          <button 
                            onClick={() => handleAnswerVote(answer._id, 'downvote')}
                            className={`${VoteButton} ${answer.downvotes?.includes(user?.id) ? 'text-violet-400' : ''}`}
                          >
                            <span className="material-icons text-xl">arrow_downward</span>
                          </button>
                        </div>

                        {/* Answer content */}
                        <div className="flex-1">
                          <div 
                            className={`${AnswerBody} cursor-pointer`}
                            onClick={() => toggleAnswer(answer._id)}
                          >
                            {expandedAnswers.has(answer._id) ? (
                              <p>{answer.body}</p>
                            ) : (
                              <p className="line-clamp-3">{answer.body}</p>
                            )}
                            {answer.body.length > 150 && (
                              <button className="text-violet-400 hover:text-violet-300 text-sm mt-2">
                                {expandedAnswers.has(answer._id) ? 'Show less' : 'Show more'}
                              </button>
                            )}
                          </div>

                          {/* User info and timestamp */}
                          <div className="flex items-center gap-3 text-sm text-gray-400 mb-4">
                            <img
                              src={answer.userId.avatar || defaultAvatar}
                              alt={answer.userId.username}
                              className="w-6 h-6 rounded-full border border-violet-500/30"
                            />
                            <span className="text-violet-400">{answer.userId.username}</span>
                            <span>•</span>
                            <span>{new Date(answer.createdAt).toLocaleDateString()}</span>
                          </div>

                          {/* Comments section */}
                          <div className={CommentSection}>
                            {answer.comments?.map(comment => (
                              <div key={comment._id} className={CommentCard}>
                                <p className="text-gray-300">{comment.body}</p>
                                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                  <img
                                    src={comment.userId.avatar || defaultAvatar}
                                    alt={comment.userId.username}
                                    className="w-4 h-4 rounded-full border border-violet-500/30"
                                  />
                                  <span className="text-violet-400">{comment.userId.username}</span>
                                  <span>•</span>
                                  <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                            
                            {/* Add comment form */}
                            <div className="mt-3 flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Add a comment..."
                                className="flex-1 px-3 py-2 bg-gray-800/50 border border-violet-500/30 rounded text-sm focus:outline-none focus:border-violet-500 text-white placeholder-gray-500"
                              />
                              <button className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded transition-colors flex items-center gap-1">
                                <span className="material-icons text-sm">send</span>
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <span className="material-icons text-4xl mb-2">question_answer</span>
                    <p>No answers yet</p>
                    <p className="text-sm mt-1">Be the first to answer this question!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HelpForum;
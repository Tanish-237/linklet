import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { handleApiError } from '../utlis/ErrorHandler';
import defaultAvatar from '../assets/default-avatar.png';

// --- Styled Components (using Tailwind classes) ---
const Container = "container mx-auto px-4 py-8 text-gray-200 font-['Poppins',sans-serif]";
const Header = "flex justify-between items-center mb-8 bg-gradient-to-r from-purple-900/60 to-indigo-900/40 p-6 rounded-xl backdrop-blur-sm border border-purple-500/20 shadow-lg";
const Title = "text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-violet-500";
const AskButton = "bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white font-bold py-3 px-6 rounded-lg transition duration-300 flex items-center gap-2 shadow-md hover:shadow-purple-500/20";
const FiltersContainer = "mb-8 flex flex-wrap gap-4 items-center bg-gray-900/60 p-6 rounded-xl backdrop-blur-md border border-purple-800/30 shadow-lg";
const SearchInput = "bg-gray-800 border border-purple-700/30 text-gray-200 text-sm rounded-lg focus:ring-violet-600 focus:border-violet-500 block w-full md:w-1/3 p-3 placeholder-gray-400";
const Select = "bg-gray-800 border border-purple-700/30 text-gray-200 text-sm rounded-lg focus:ring-violet-600 focus:border-violet-500 block p-3";
const QuestionList = "space-y-6";
const QuestionCard = "bg-gradient-to-b from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-purple-500/20 rounded-xl p-6 shadow-lg hover:shadow-purple-500/10 hover:border-purple-500/40 transition duration-300";
const VoteContainer = "flex items-center justify-center gap-2 mt-3";
const VoteButton = "flex items-center justify-center p-2 rounded-full transition-all duration-300 hover:bg-purple-900/30";
const ActiveVoteButton = "text-purple-400 bg-purple-900/30";
const VoteCount = "text-lg font-bold mx-1 text-purple-300";
const QuestionTitleLink = "text-2xl font-bold text-purple-300 hover:text-purple-200 transition duration-200 mb-3 block";
const QuestionBodyExcerpt = "text-gray-300 text-base mb-4 leading-relaxed";
const Tag = "inline-block bg-purple-900/40 text-purple-200 text-xs font-medium px-3 py-1 rounded-full border border-purple-700/30 mr-2 mb-2";
const QuestionMeta = "flex flex-wrap items-center justify-between text-sm text-gray-400 mt-4";
const UserInfo = "flex items-center gap-2";
const Avatar = "w-8 h-8 rounded-full object-cover border-2 border-purple-500/40";
const Username = "text-gray-300 hover:text-purple-300 font-medium";
const PaginationContainer = "mt-10 flex justify-center items-center gap-4";
const PageButton = "bg-gray-800 hover:bg-purple-900/50 text-gray-200 font-medium py-2 px-5 rounded-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-purple-700/30";
const LoadingMessage = "text-center py-12 text-gray-300 text-xl";
const ErrorMessage = "text-center py-12 text-red-400 text-xl";
const NoQuestionsMessage = "text-center py-20 text-gray-400 text-xl";
const AnswerButton = "bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white text-sm font-medium py-2 px-4 rounded-lg transition duration-300 flex items-center gap-2 shadow-md";
const QuestionActions = "flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-purple-900/30";

const HelpForum = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [userVotes, setUserVotes] = useState({});

  const { user } = useAuth();
  const navigate = useNavigate();

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const sort = searchParams.get('sort') || 'newest';
  const tags = searchParams.get('tags') || '';

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit,
        sort,
        ...(tags && { tags }),
        ...(searchTerm && { search: searchTerm }),
      };
      const response = await axios.get('http://localhost:5000/api/questions', { 
        params,
        withCredentials: true
      });
      
      if (response.data.success) {
        console.log('Questions response:', response.data.questions.docs);
        setQuestions(response.data.questions.docs || []);
        setTotalPages(response.data.questions.totalPages || 1);
        
        if (user) {
          const votes = {};
          response.data.questions.docs.forEach(q => {
            if (q.upvotes?.includes(user.id)) {
              votes[q._id] = 'upvote';
            } else if (q.downvotes?.includes(user.id)) {
              votes[q._id] = 'downvote';
            } else {
              votes[q._id] = null;
            }
          });
          setUserVotes(votes);
        }
      } else {
        throw new Error('Failed to fetch questions');
      }
    } catch (err) {
      console.error('Error fetching questions:', err);
      setError('Could not load questions. Please try again later.');
      handleApiError(err);
      setQuestions([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, limit, sort, tags, searchTerm, user]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleAskQuestion = () => {
    if (!user) {
      toast.info('Please log in to ask a question.');
      navigate('/login');
    } else {
      navigate('/ask-question');
    }
  };

  const handleVote = async (questionId, voteType) => {
    if (!user) {
      toast.info('Please log in to vote.');
      return;
    }

    try {
      const response = await axios.post(
        `http://localhost:5000/api/questions/${questionId}/vote`,
        { voteType },
        { withCredentials: true }
      );

      if (response.data.success) {
        setQuestions(prevQuestions => 
          prevQuestions.map(q => 
            q._id === questionId 
              ? {
                  ...q,
                  upvotes: Array(response.data.upvotes).fill(null),
                  downvotes: Array(response.data.downvotes).fill(null)
                }
              : q
          )
        );
        
        setUserVotes(prev => ({
          ...prev,
          [questionId]: response.data.userVote
        }));
        
        toast.success(
          response.data.userVote 
            ? `Question ${response.data.userVote}d` 
            : 'Vote removed'
        );
      }
    } catch (err) {
      handleApiError(err);
    }
  };

  const handleAnswerQuestion = (questionId) => {
    if (!user) {
      toast.info('Please log in to answer this question.');
      return;
    }
    navigate(`/question/${questionId}`);
  };

  const handleFilterChange = (key, value) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
      if (key !== 'page') {
        newParams.set('page', '1');
      }
      return newParams;
    });
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleFilterChange('search', searchTerm);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      handleFilterChange('page', newPage.toString());
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown date";
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime())
        ? "Invalid date"
        : date.toLocaleDateString("en-US", {
            year: 'numeric', month: 'short', day: 'numeric'
          });
    } catch {
      return "Invalid date";
    }
  };

  const calculateVotes = (q) => (q.upvotes?.length || 0) - (q.downvotes?.length || 0);

  return (
    <div className={Container}>
      <div className={Header}>
        <h1 className={Title}>Help Forum</h1>
        <button onClick={handleAskQuestion} className={AskButton}>
          <span className="material-icons">add_circle_outline</span>
          Ask Question
        </button>
      </div>

      <div className={FiltersContainer}>
        <input
          type="search"
          placeholder="Search questions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className={SearchInput}
        />
        <select
          value={sort}
          onChange={(e) => handleFilterChange('sort', e.target.value)}
          className={Select}
        >
          <option value="newest">Newest</option>
          <option value="votes">Most Votes</option>
          <option value="unanswered">Unanswered</option>
        </select>
      </div>

      {loading && <div className={LoadingMessage}>
        <div className="flex justify-center mb-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
        </div>
        Loading questions...
      </div>}
      
      {error && <div className={ErrorMessage}>{error}</div>}

      {!loading && !error && questions.length === 0 && (
        <div className={NoQuestionsMessage}>
          <div className="flex justify-center mb-6">
            <span className="material-icons text-5xl text-gray-500">help_outline</span>
          </div>
          No questions found. Be the first to ask!
        </div>
      )}

      {!loading && !error && questions.length > 0 && (
        <>
          <div className={QuestionList}>
            {questions.map((q) => (
                
              <div key={q._id} className={QuestionCard}>
                <div className="flex items-center justify-between">
                  <Link to={`/question/${q._id}`} className={QuestionTitleLink}>
                    {q.title}
                  </Link>
                  <div className="flex items-center gap-4 text-sm bg-gray-800/60 px-3 py-1 rounded-lg">
                    <span className="flex items-center gap-1 text-gray-300">
                      <span className="material-icons text-purple-400">visibility</span>
                      {q.views || 0}
                    </span>
                    <span className="flex items-center gap-1 text-gray-300">
                      <span className="material-icons text-purple-400">question_answer</span>
                      {q.answers?.length || 0}
                    </span>
                  </div>
                </div>
                
                <p className={QuestionBodyExcerpt}>
                  {q.body?.substring(0, 200)}{q.body?.length > 200 ? '...' : ''}
                </p>
                
                <div className="mb-3">
                  {q.tags?.map((tag) => (
                    <span key={tag} className={Tag}>{tag}</span>
                  ))}
                </div>
                
                <div className={QuestionMeta}>
                  <div className={UserInfo}>
                    <img
                      src={q.userId?.avatar || defaultAvatar}
                      alt="User avatar"
                      className={Avatar}
                    />
                    <span className={Username}>
                      {q.userId ? (
                        q.userId.username || q.userId.name || q.userId.fullName || 
                        (typeof q.userId === 'string' ? 'User ' + q.userId.substring(0, 5) : 'Anonymous')
                      ) : 'Anonymous'}
                    </span>
                    <span className="text-gray-500">
                      asked {formatDate(q.createdAt)}
                    </span>
                  </div>
                </div>
                
                <div className={QuestionActions}>
                  <div className={VoteContainer}>
                    <button 
                      onClick={() => handleVote(q._id, 'upvote')}
                      className={`${VoteButton} ${userVotes[q._id] === 'upvote' ? ActiveVoteButton : 'text-gray-400'}`}
                      aria-label="Upvote"
                    >
                      <span className="material-icons">thumb_up</span>
                    </button>
                    
                    <span className={VoteCount}>{calculateVotes(q)}</span>
                    
                    <button 
                      onClick={() => handleVote(q._id, 'downvote')}
                      className={`${VoteButton} ${userVotes[q._id] === 'downvote' ? ActiveVoteButton : 'text-gray-400'}`}
                      aria-label="Downvote"
                    >
                      <span className="material-icons">thumb_down</span>
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => handleAnswerQuestion(q._id)}
                    className={AnswerButton}
                    disabled={!user}
                  >
                    <span className="material-icons">question_answer</span>
                    Answer
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className={PaginationContainer}>
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className={PageButton}
              >
                <span className="flex items-center">
                  <span className="material-icons mr-1">arrow_back</span>
                  Previous
                </span>
              </button>
              <span className="text-gray-300 bg-gray-800/60 px-4 py-2 rounded-lg border border-purple-700/30">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className={PageButton}
              >
                <span className="flex items-center">
                  Next
                  <span className="material-icons ml-1">arrow_forward</span>
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HelpForum;
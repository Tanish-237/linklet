import express from 'express';
import { isLoggedIn } from '../middlewares/isLoggedIn.js';
import {
    createQuestion,
    getAllQuestions,
    getQuestionById,
    updateQuestion,
    deleteQuestion,
    voteQuestion
} from '../controllers/question-controller.js';

const router = express.Router();

// Create a new question (requires login)
router.post('/api/questions', isLoggedIn, createQuestion);

// Get all questions (public) - with filtering/sorting options via query params
router.get('/api/questions', getAllQuestions);

// Get a specific question by ID (public)
router.get('/api/questions/:questionId', getQuestionById);

// Update a question (requires login, author only)
router.put('/api/questions/:questionId', isLoggedIn, updateQuestion);

// Delete a question (requires login, author only)
router.delete('/api/questions/:questionId', isLoggedIn, deleteQuestion);

// Vote on a question (requires login)
router.post('/api/questions/:questionId/vote', isLoggedIn, voteQuestion);

export { router };
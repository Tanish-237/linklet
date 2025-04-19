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
router.post('/', isLoggedIn, createQuestion);

// Get all questions (public) - with filtering/sorting options via query params
router.get('/', getAllQuestions);

// Get a specific question by ID (public)
router.get('/:questionId', getQuestionById);

// Update a question (requires login, author only)
router.put('/:questionId', isLoggedIn, updateQuestion);

// Delete a question (requires login, author only)
router.delete('/:questionId', isLoggedIn, deleteQuestion);

// Vote on a question (requires login)
router.post('/:questionId/vote', isLoggedIn, voteQuestion);

export { router as questionRouter }; 
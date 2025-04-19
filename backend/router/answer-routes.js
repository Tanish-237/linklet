import express from 'express';
import { isLoggedIn } from '../middlewares/isLoggedIn.js';
import { documentUploadMiddleware } from '../middlewares/multer.js';
import {
    createAnswer,
    getAnswersForQuestion,
    updateAnswer,
    deleteAnswer,
    voteAnswer,
    acceptAnswer
} from '../controllers/answer-controller.js';

const router = express.Router();

// Create a new answer for a specific question (requires login)
router.post('/api/questions/:questionId/answers', isLoggedIn, documentUploadMiddleware.single('attachment'), createAnswer);

// Get all answers for a specific question (public)
router.get('/api/questions/:questionId/answers', getAnswersForQuestion);

// Update an answer (requires login, author only)
router.put('/api/answers/:answerId', isLoggedIn, updateAnswer);

// Delete an answer (requires login, author only)
router.delete('/api/answers/:answerId', isLoggedIn, deleteAnswer);

// Vote on an answer (requires login)
router.post('/api/answers/:answerId/vote', isLoggedIn, voteAnswer);

// Accept an answer (requires login, question author only)
router.post('/api/answers/:answerId/accept', isLoggedIn, acceptAnswer);

export { router }; // Use a distinct name
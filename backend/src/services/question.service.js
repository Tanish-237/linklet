import * as questionRepository from "../repositories/question.repository.js";
import { AppError } from "../utils/error.js";

export const createQuestion = async (userId, questionData) => {
  if (!questionData.title || !questionData.body) {
    throw new AppError("Title and body are required", 400);
  }

  return await questionRepository.createQuestion({
    userId,
    title: questionData.title,
    body: questionData.body,
    tags: questionData.tags || [],
  });
};

export const getQuestionsFeed = async (cursor, limit) => {
  const questions = await questionRepository.getQuestionsFeed(cursor, parseInt(limit) || 10);
  const nextCursor = questions.length > 0 ? questions[questions.length - 1].createdAt : null;
  return { questions, nextCursor };
};

export const getQuestion = async (questionId) => {
  const question = await questionRepository.findQuestionById(questionId);
  if (!question) {
    throw new AppError("Question not found", 404);
  }
  return question;
};

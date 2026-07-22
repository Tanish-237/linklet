import * as questionService from "../services/question.service.js";

export const createQuestion = async (req, res, next) => {
  try {
    const question = await questionService.createQuestion(req.user._id, req.body);
    res.status(201).json({ success: true, data: question });
  } catch (error) {
    next(error);
  }
};

export const getQuestions = async (req, res, next) => {
  try {
    const { cursor, limit } = req.query;
    const feedData = await questionService.getQuestionsFeed(cursor, limit);
    
    res.status(200).json({ 
      success: true, 
      data: feedData.questions,
      nextCursor: feedData.nextCursor
    });
  } catch (error) {
    next(error);
  }
};

export const getQuestion = async (req, res, next) => {
  try {
    const question = await questionService.getQuestion(req.params.questionId);
    res.status(200).json({ success: true, data: question });
  } catch (error) {
    next(error);
  }
};

import { Question } from "../../models/question.js";

export const createQuestion = async (questionData) => {
  const question = new Question(questionData);
  return await question.save();
};

export const findQuestionById = async (id) => {
  return await Question.findById(id).populate("userId", "username avatar");
};

export const getQuestionsFeed = async (cursor, limit = 10) => {
  const query = {};
  if (cursor) query.createdAt = { $lt: new Date(cursor) };

  return await Question.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "username avatar")
    .lean();
};

export const deleteQuestion = async (id) => {
  return await Question.findByIdAndDelete(id);
};

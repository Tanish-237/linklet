import { Question } from "../models/question.js";
import { Answer } from "../models/answer.js";
import { User } from "../models/users.js";
import wrapAsync from "../utils/wrapAsync.js";
import apiError from "../utils/apiError.js";
import mongoose from "mongoose";

// Create a new question
export const createQuestion = wrapAsync(async (req, res) => {
  const { title, body, tags } = req.body;
  const userId = req.user.id;

  if (!title || !body) {
    throw new apiError(400, "Title and body are required");
  }

  const question = await Question.create({
    userId,
    title,
    body,
    tags: tags ? tags.split(',').map(tag => tag.trim().toLowerCase()) : [],
  });

  res.status(201).json({ success: true, question });
});

// Get all questions (with pagination, filtering by tags, search)
export const getAllQuestions = wrapAsync(async (req, res) => {
    const { page = 1, limit = 10, tags, search, sort = 'newest' } = req.query;

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        populate: { path: 'userId', select: 'username avatar' }, // Populate user details
    };

    // Determine sort order
    switch (sort) {
        case 'votes':
            // For simplicity, sorting by upvotes count for now
             options.sort = { $expr: { $subtract: [ { $size: "$upvotes" }, { $size: "$downvotes" } ] }, createdAt: -1 }; // Sort by net votes desc, then newest
            break;
        case 'unanswered':
            options.sort = { createdAt: -1 }; // Sort by newest first
            break;
        case 'newest':
        default:
            options.sort = { createdAt: -1 }; // Default sort by newest
            break;
    }


    const query = {};
    if (tags) {
        query.tags = { $in: tags.split(',').map(tag => tag.trim().toLowerCase()) };
    }
     if (search) {
        const regex = new RegExp(search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i'); // Escape regex special chars
        query.$or = [{ title: regex }, { body: regex }];
    }
     if (sort === 'unanswered') {
        query.answers = { $size: 0 }; // Filter for questions with no answers
    }


    const questions = await Question.paginate(query, options);

    res.status(200).json({ success: true, questions });
});


// Get a specific question by ID
export const getQuestionById = wrapAsync(async (req, res) => {
  const { questionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(questionId)) {
      throw new apiError(400, "Invalid question ID format");
  }

  // Increment views atomically
  const question = await Question.findByIdAndUpdate(
      questionId,
      { $inc: { views: 1 } },
      { new: true } // Return the updated document
  )
  .populate('userId', 'username avatar') // Populate question author details
  .populate({ // Populate answers and their authors
      path: 'answers',
      populate: {
          path: 'userId',
          select: 'username avatar'
      },
      options: { sort: { createdAt: -1 } } // Sort answers by newest
  });


  if (!question) {
    throw new apiError(404, "Question not found");
  }

  res.status(200).json({ success: true, question });
});

// Update a question
export const updateQuestion = wrapAsync(async (req, res) => {
  const { questionId } = req.params;
  const { title, body, tags } = req.body;
  const userId = req.user.id;

   if (!mongoose.Types.ObjectId.isValid(questionId)) {
      throw new apiError(400, "Invalid question ID format");
  }

  const question = await Question.findById(questionId);

  if (!question) {
    throw new apiError(404, "Question not found");
  }

  if (question.userId.toString() !== userId) {
    throw new apiError(403, "You don't have permission to update this question");
  }

  question.title = title || question.title;
  question.body = body || question.body;
  if (tags !== undefined) {
      question.tags = tags ? tags.split(',').map(tag => tag.trim().toLowerCase()) : [];
  }


  await question.save();

  res.status(200).json({ success: true, question });
});

// Delete a question (and its answers)
export const deleteQuestion = wrapAsync(async (req, res) => {
  const { questionId } = req.params;
  const userId = req.user.id;

   if (!mongoose.Types.ObjectId.isValid(questionId)) {
      throw new apiError(400, "Invalid question ID format");
  }

  const question = await Question.findById(questionId);

  if (!question) {
    throw new apiError(404, "Question not found");
  }

  if (question.userId.toString() !== userId) {
    throw new apiError(403, "You don't have permission to delete this question");
  }

  // Delete all associated answers first
  await Answer.deleteMany({ questionId: question._id });

  // Then delete the question
  await Question.findByIdAndDelete(questionId);

  res.status(200).json({ success: true, message: "Question and associated answers deleted successfully" });
});

// Vote on a question (upvote/downvote)
export const voteQuestion = wrapAsync(async (req, res) => {
    const { questionId } = req.params;
    const { voteType } = req.body; // 'upvote' or 'downvote'
    const userId = req.user.id; // Assuming user ID is available from auth middleware

    if (!mongoose.Types.ObjectId.isValid(questionId)) {
        throw new apiError(400, "Invalid question ID format");
    }

    if (!['upvote', 'downvote'].includes(voteType)) {
        throw new apiError(400, "Invalid vote type. Must be 'upvote' or 'downvote'.");
    }

    const question = await Question.findById(questionId);
    if (!question) {
        throw new apiError(404, "Question not found");
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    const upvoteIndex = question.upvotes.findIndex(id => id.equals(userIdObj));
    const downvoteIndex = question.downvotes.findIndex(id => id.equals(userIdObj));

    if (voteType === 'upvote') {
        if (upvoteIndex !== -1) {
            // User already upvoted, remove upvote
            question.upvotes.splice(upvoteIndex, 1);
        } else {
            // Add upvote
            question.upvotes.push(userIdObj);
            // If user had downvoted, remove downvote
            if (downvoteIndex !== -1) {
                question.downvotes.splice(downvoteIndex, 1);
            }
        }
    } else if (voteType === 'downvote') {
        if (downvoteIndex !== -1) {
            // User already downvoted, remove downvote
            question.downvotes.splice(downvoteIndex, 1);
        } else {
            // Add downvote
            question.downvotes.push(userIdObj);
            // If user had upvoted, remove upvote
            if (upvoteIndex !== -1) {
                question.upvotes.splice(upvoteIndex, 1);
            }
        }
    }

    await question.save();

    // Return the updated vote counts
    res.status(200).json({
        success: true,
        upvotes: question.upvotes.length,
        downvotes: question.downvotes.length,
        userVote: upvoteIndex !== -1 ? 'upvote' : (downvoteIndex !== -1 ? 'downvote' : null) // Indicate current user's vote status
    });
});
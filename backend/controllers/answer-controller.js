import { Answer } from "../models/answer.js";
import { Question } from "../models/question.js";
import wrapAsync from "../utils/wrapAsync.js";
import apiError from "../utils/apiError.js";
import mongoose from "mongoose";

// Create a new answer for a question
export const createAnswer = wrapAsync(async (req, res) => {
  const { questionId } = req.params;
  const { body } = req.body;
  const userId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(questionId)) {
      throw new apiError(400, "Invalid question ID format");
  }

  if (!body) {
    throw new apiError(400, "Answer body is required");
  }

  const question = await Question.findById(questionId);
  if (!question) {
    throw new apiError(404, "Question not found");
  }

  const answer = await Answer.create({
    userId,
    questionId,
    body,
  });

  // Add answer reference to the question
  question.answers.push(answer._id);
  await question.save();

  // Populate user details for the response
  const populatedAnswer = await Answer.findById(answer._id).populate('userId', 'username avatar');


  res.status(201).json({ success: true, answer: populatedAnswer });
});

// Get all answers for a specific question
export const getAnswersForQuestion = wrapAsync(async (req, res) => {
  const { questionId } = req.params;

   if (!mongoose.Types.ObjectId.isValid(questionId)) {
      throw new apiError(400, "Invalid question ID format");
  }

  const answers = await Answer.find({ questionId })
    .populate('userId', 'username avatar') // Populate user details
    .sort({ createdAt: -1 }); // Sort by newest first, consider sorting by votes later

  res.status(200).json({ success: true, answers });
});

// Update an answer
export const updateAnswer = wrapAsync(async (req, res) => {
  const { answerId } = req.params;
  const { body } = req.body;
  const userId = req.user.id;

   if (!mongoose.Types.ObjectId.isValid(answerId)) {
      throw new apiError(400, "Invalid answer ID format");
  }

  const answer = await Answer.findById(answerId);

  if (!answer) {
    throw new apiError(404, "Answer not found");
  }

  if (answer.userId.toString() !== userId) {
    throw new apiError(403, "You don't have permission to update this answer");
  }

  answer.body = body || answer.body;
  await answer.save();

  // Populate user details for the response
  const populatedAnswer = await Answer.findById(answer._id).populate('userId', 'username avatar');

  res.status(200).json({ success: true, answer: populatedAnswer });
});

// Delete an answer
export const deleteAnswer = wrapAsync(async (req, res) => {
  const { answerId } = req.params;
  const userId = req.user.id;

   if (!mongoose.Types.ObjectId.isValid(answerId)) {
      throw new apiError(400, "Invalid answer ID format");
  }

  const answer = await Answer.findById(answerId);

  if (!answer) {
    throw new apiError(404, "Answer not found");
  }

  if (answer.userId.toString() !== userId) {
    // Allow question author to delete answers as well? Maybe later feature.
    throw new apiError(403, "You don't have permission to delete this answer");
  }

  // Remove answer reference from the question
  await Question.findByIdAndUpdate(answer.questionId, {
    $pull: { answers: answer._id },
  });

  // Delete the answer
  await Answer.findByIdAndDelete(answerId);

  res.status(200).json({ success: true, message: "Answer deleted successfully" });
});

// Vote on an answer (upvote/downvote)
export const voteAnswer = wrapAsync(async (req, res) => {
    const { answerId } = req.params;
    const { voteType } = req.body; // 'upvote' or 'downvote'
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(answerId)) {
        throw new apiError(400, "Invalid answer ID format");
    }

    if (!['upvote', 'downvote'].includes(voteType)) {
        throw new apiError(400, "Invalid vote type. Must be 'upvote' or 'downvote'.");
    }

    const answer = await Answer.findById(answerId);
    if (!answer) {
        throw new apiError(404, "Answer not found");
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    const upvoteIndex = answer.upvotes.findIndex(id => id.equals(userIdObj));
    const downvoteIndex = answer.downvotes.findIndex(id => id.equals(userIdObj));

    if (voteType === 'upvote') {
        if (upvoteIndex !== -1) {
            answer.upvotes.splice(upvoteIndex, 1);
        } else {
            answer.upvotes.push(userIdObj);
            if (downvoteIndex !== -1) {
                answer.downvotes.splice(downvoteIndex, 1);
            }
        }
    } else if (voteType === 'downvote') {
        if (downvoteIndex !== -1) {
            answer.downvotes.splice(downvoteIndex, 1);
        } else {
            answer.downvotes.push(userIdObj);
            if (upvoteIndex !== -1) {
                answer.upvotes.splice(upvoteIndex, 1);
            }
        }
    }

    await answer.save();

    res.status(200).json({
        success: true,
        upvotes: answer.upvotes.length,
        downvotes: answer.downvotes.length,
        userVote: upvoteIndex !== -1 ? 'upvote' : (downvoteIndex !== -1 ? 'downvote' : null)
    });
});

// Accept an answer (only by the question author)
export const acceptAnswer = wrapAsync(async (req, res) => {
    const { answerId } = req.params;
    const userId = req.user.id; // ID of the user making the request

    if (!mongoose.Types.ObjectId.isValid(answerId)) {
        throw new apiError(400, "Invalid answer ID format");
    }

    const answer = await Answer.findById(answerId).populate('questionId'); // Populate the related question
    if (!answer) {
        throw new apiError(404, "Answer not found");
    }
    if (!answer.questionId) {
         throw new apiError(500, "Answer is not associated with a question"); // Data integrity check
    }


    // Check if the user making the request is the author of the question
    if (answer.questionId.userId.toString() !== userId) {
        throw new apiError(403, "Only the question author can accept an answer.");
    }

    // Find if another answer is already accepted for this question
    const alreadyAccepted = await Answer.findOne({ questionId: answer.questionId, isAccepted: true });

    // Toggle acceptance: If this answer is already accepted, unaccept it.
    if (answer.isAccepted) {
        answer.isAccepted = false;
    } else {
        // If another answer was accepted, unaccept it first
        if (alreadyAccepted && alreadyAccepted._id.toString() !== answer._id.toString()) {
            alreadyAccepted.isAccepted = false;
            await alreadyAccepted.save();
        }
        // Accept the current answer
        answer.isAccepted = true;
    }


    await answer.save();

    res.status(200).json({ success: true, answer });
});
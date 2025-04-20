import mongoose from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const questionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    answers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Answer",
      },
    ],
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    downvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    views: {
      type: Number,
      default: 0,
    },
  },
  title: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200,
  },
  body: { 
    type: String, 
    required: true 
  },
  tags: [
    {
      type: String,
      trim: true,
      lowercase: true,
    }
  ],
  upvotes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }
  ],
  downvotes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }
  ],
  views: {
    type: Number,
    default: 0,
  },
  answers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Answer',
    }
  ],
}, { timestamps: true });

questionSchema.plugin(aggregatePaginate);

export const Question = mongoose.model('Question', questionSchema);

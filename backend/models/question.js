import mongoose from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

// Predefined categories for the help forum
export const QUESTION_CATEGORIES = [
  "Academic",
  "Technical",
  "Campus Life",
  "Career & Placement",
  "Research",
  "Events & Clubs",
  "Hostel & Facilities",
  "General",
];

// Predefined tag suggestions (users can also add custom ones)
export const SUGGESTED_TAGS = [
  // Academic
  "exam", "assignment", "project", "syllabus", "attendance", "cgpa",
  "marks", "grading", "lab", "viva", "internship", "sem",
  // Technical
  "react", "nodejs", "python", "java", "cpp", "javascript",
  "html", "css", "mongodb", "sql", "git", "linux", "dsa",
  "algorithms", "machine-learning", "web-dev", "competitive-coding",
  // Campus
  "hostel", "mess", "wi-fi", "library", "sports", "fest",
  "scholarship", "noc", "bonafide", "transfer-cert",
  // Career
  "placement", "resume", "interview", "internship", "hackathon",
  "open-source", "gsoc", "github",
  // General
  "tips", "help", "advice", "discussion",
];

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
      default: "",
    },
    category: {
      type: String,
      enum: QUESTION_CATEGORIES,
      default: "General",
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
    acceptedAnswers: [
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
    isClosed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Text index for full-text search on title, body, and tags
questionSchema.index({ title: "text", body: "text", tags: "text" });
// Index for efficient category+date filtering
questionSchema.index({ category: 1, createdAt: -1 });
// Compound index for vote count sorting
questionSchema.index({ createdAt: -1 });
// Compound indexes for tag filtering and user questions list
questionSchema.index({ tags: 1, createdAt: -1 });
questionSchema.index({ userId: 1, createdAt: -1 });

questionSchema.plugin(aggregatePaginate);

export const Question = mongoose.model("Question", questionSchema);

import mongoose from "mongoose";

const postReportSchema = new mongoose.Schema(
  {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    postAuthorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    captionSnippet: {
      type: String,
      default: "",
    },
    reason: {
      type: String,
      default: "Reported by user",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "dismissed"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

postReportSchema.index({ createdAt: -1 });
postReportSchema.index({ status: 1, createdAt: -1 });

export const PostReport = mongoose.model("PostReport", postReportSchema);

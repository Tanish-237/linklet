import mongoose from "mongoose";

const messageReportSchema = new mongoose.Schema(
  {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    messageContent: {
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

messageReportSchema.index({ createdAt: -1 });
messageReportSchema.index({ status: 1, createdAt: -1 });

export const MessageReport = mongoose.model("MessageReport", messageReportSchema);
